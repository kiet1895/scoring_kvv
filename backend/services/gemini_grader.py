"""
Gemini AI grading service for scoring_k.
Sends rendered answer-sheet images to Gemini 1.5 Pro Vision
and returns structured JSON grading results.
"""
from __future__ import annotations
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional

import google.generativeai as genai
from PIL import Image

# ---------------------------------------------------------------------------
# System instruction for Gemini
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTION = """
You are a highly precise exam grader AI. Your goal is to identify student answers with 100% accuracy and flag ANY ambiguity for human review.

Your task for EACH question in the answer key:
1. Independently scan every option (A, B, C, and D).
2. Detect any marking (circle, tick, fill, underline, or X) on each option.
3. COUNT the number of marked options:
    - If MORE THAN ONE option is marked:
        * If one is clearly crossed out (with a large X or strike-through) and another is clean, you may select the clean one.
        * OTHERWISE (if two or more clear marks exist, like two circles), you MUST set status="needs_review", reason="multiple_marks_detected", and ai_confidence=0.0.
        * In this case, set selected_answer to a string of all detected letters (e.g., "A,C").
    - If EXACTLY ONE option is marked:
        * Set status="auto_graded", selected_answer to that letter, and reason="none".
    - If NO options are marked:
        * Set status="needs_review", selected_answer=null, and reason="no_answer_detected".

CRITICAL: If you see two circles (even if one is slightly lighter), it is a "multiple_marks_detected" case. Human safety first!

Output ONLY valid JSON.
The JSON must follow this exact schema:

{
  "student_id": "auto",
  "results": [
    {
      "question_no": <integer>,
      "selected_answer": "<A|B|C|D|A,C|null>",
      "status": "<auto_graded|needs_review>",
      "reason": "<none|multiple_marks_detected|crossed_out_answer|low_confidence|no_answer_detected>",
      "ai_confidence": <float 0.0–1.0>,
      "coord_y": <float 0-1000>
    }
  ]
}
"""


# ---------------------------------------------------------------------------
# Multi-Key Manager
# ---------------------------------------------------------------------------

class KeyManager:
    def __init__(self):
        raw_keys = os.getenv("GEMINI_API_KEY", "")
        self.keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
        self.current_idx = 0
        if not self.keys:
            print("[WARNING] No GEMINI_API_KEY found in environment variables.")

    def get_key(self):
        if not self.keys:
            raw_keys = os.getenv("GEMINI_API_KEY", "")
            self.keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
        
        if not self.keys:
            return None
        key = self.keys[self.current_idx]
        self.current_idx = (self.current_idx + 1) % len(self.keys)
        return key

    def key_count(self):
        return len(self.keys)

_key_manager = KeyManager()

def _configure_gemini() -> None:
    api_key = _key_manager.get_key()
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set or empty.")
    genai.configure(api_key=api_key)

import threading
_genai_lock = threading.Lock()

def grade_student_paper(
    image_paths: List[str],
    answer_key: Dict[str, str],
    student_id: str,
    model_name: Optional[str] = None,
) -> dict:
    """
    Send student answer sheet images to Gemini and get grading results.
    Returns a dict with 'results' on success, or 'error' on failure.
    """
    import time
    from google.api_core.exceptions import ResourceExhausted

    max_retries = 5
    base_delay = 10
    last_error = "Unknown error"

    for attempt in range(max_retries):
        try:
            with _genai_lock:
                _configure_gemini()
                selected_model = model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
                print(f"[Gemini] Using model: {selected_model} for student {student_id}")
                model = genai.GenerativeModel(
                    model_name=selected_model,
                    system_instruction=SYSTEM_INSTRUCTION,
                )

            # Build the prompt parts: images + answer key
            parts = []
            for img_path in image_paths:
                img = Image.open(img_path)
                parts.append(img)

            answer_key_text = (
                f"Answer Key (JSON):\n{json.dumps(answer_key, ensure_ascii=False, indent=2)}\n\n"
                f"Student ID: {student_id}\n\n"
                "Please grade every question listed in the answer key."
            )
            parts.append(answer_key_text)

            # Fire the AI request (Now outside the lock to allow parallelism)
            response = model.generate_content(
                parts,
                generation_config=genai.GenerationConfig(
                    temperature=0.0,            # deterministic grading
                    response_mime_type="application/json",
                ),
            )

            raw_text = response.text.strip()

            # Strip markdown code fences if model ignores mime type
            raw_text = re.sub(r"^```(?:json)?\n?", "", raw_text)
            raw_text = re.sub(r"\n?```$", "", raw_text)

            result = json.loads(raw_text)
            result["student_id"] = student_id
            return result

        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}"
            print(f"[Gemini] {last_error} for {student_id}")
            return {"error": last_error}
        except Exception as e:
            last_error = str(e)
            if "429" in last_error or "Too Many Requests" in last_error or isinstance(e, ResourceExhausted):
                if attempt < max_retries - 1:
                    print(f"[Gemini] 429 Too Many Requests for {student_id}. Sleeping {base_delay}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(base_delay)
                    base_delay *= 1.5  # Exponential backoff
                    continue
            print(f"[Gemini] Error grading {student_id}: {e}")
            return {"error": last_error}
            
    return {"error": f"Failed after {max_retries} attempts. Last error: {last_error}"}


def build_demo_result(
    student_id: str,
    answer_key: Dict[str, str],
) -> dict:
    """
    Generate a plausible demo result without a real Gemini call.
    Used when GEMINI_API_KEY is not set (demo / development mode).
    """
    import random
    options = ["A", "B", "C", "D"]
    results = []
    for q_str, correct in answer_key.items():
        q_no = int(q_str)
        # Simulate ~80% correct, ~15% wrong, ~5% needs review
        roll = random.random()
        if roll < 0.05:
            selected = random.choice(options)
            status = "needs_review"
            reason = random.choice([
                "multiple_marks_detected",
                "crossed_out_answer",
                "low_confidence",
            ])
            confidence = round(random.uniform(0.3, 0.74), 2)
        elif roll < 0.20:
            selected = random.choice([o for o in options if o != correct])
            status = "auto_graded"
            reason = "none"
            confidence = round(random.uniform(0.8, 0.99), 2)
        else:
            selected = correct
            status = "auto_graded"
            reason = "none"
            confidence = round(random.uniform(0.85, 1.0), 2)

        results.append({
            "question_no": q_no,
            "selected_answer": selected,
            "status": status,
            "reason": reason,
            "ai_confidence": confidence,
        })

    return {"student_id": student_id, "results": results}


def extract_answer_key(
    image_paths: List[str],
    model_name: Optional[str] = None,
) -> Dict[str, str]:
    """
    Send a sample/template answer sheet to Gemini and extract the correct answers.
    Returns a dict mapping question numbers to answers.
    """
    if not os.getenv("GEMINI_API_KEY"):
        # Demo mode: return dummy key
        return {"1": "A", "2": "B", "3": "C", "4": "D", "5": "A", "6": "B", "7": "C", "8": "D", "9": "A", "10": "B"}

    _configure_gemini()
    selected_model = model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    extraction_instruction = """
    You are an expert exam key extractor with 100% precision.
    Your task is to analyze the provided image of a CORRECT/SAMPLE answer sheet and extract the answer key.
    
    INSTRUCTIONS:
    1. Scan the ENTIRE document from top to bottom, left to right.
    2. Identify EVERY question number and its corresponding marked answer (A, B, C, or D).
    3. Look for circles, ticks, X marks, or filled-in bubbles.
    4. Do not miss any question. If you see a question number but no clear mark, use '?' as the answer.
    5. Continue until you have reached the very last question on the page.
    
    Output ONLY valid JSON in this format:
    {
      "1": "A",
      "2": "B",
      "3": "C",
      ...
    }
    """
    
    import time
    from google.api_core.exceptions import ResourceExhausted

    max_retries = 3
    base_delay = 5

    for attempt in range(max_retries):
        try:
            model = genai.GenerativeModel(
                model_name=selected_model,
                system_instruction=extraction_instruction,
            )

            parts_input = []
            for img_path in image_paths:
                img = Image.open(img_path)
                parts_input.append(img)
            
            parts_input.append("Please extract EVERY question and its marked answer from this sample sheet. Ensure you do not stop until the end of the page. Use '?' if a question is unmarked.")

            response = model.generate_content(
                parts_input,
                generation_config=genai.GenerationConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                ),
            )

            raw_text = response.text.strip()
            raw_text = re.sub(r"^```(?:json)?\n?", "", raw_text)
            raw_text = re.sub(r"\n?```$", "", raw_text)
            
            return json.loads(raw_text)

        except (ResourceExhausted, Exception) as e:
            last_error = str(e)
            if attempt < max_retries - 1 and ("429" in last_error or isinstance(e, ResourceExhausted)):
                print(f"[Gemini] Quota hit during extraction. Retrying in {base_delay}s...")
                time.sleep(base_delay)
                base_delay *= 2
                continue
            print(f"[Gemini] Extraction error: {e}")
            raise e
