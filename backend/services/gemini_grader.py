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
You are an expert exam grader AI for multiple-choice answer papers.
You will receive:
  1. An image of a student's answer sheet (one or more pages).
  2. The official answer key as a JSON object mapping question numbers to correct answers.

Your task:
- For each question in the answer key, determine which option (A, B, C, or D) the student selected.
- The student may mark their choice by:
    * Filling in a bubble or a box.
    * Circling the letter (e.g., circling 'A') or the entire option.
    * Placing a tick (check) or X mark inside or next to the option.
    * Underlining the correct option.
- LOOK EXTREMELY CLOSELY at all options for each question. A choice is considered "selected" if it has a clear mark (circle, fill, tick, etc.) that distinguishes it from the other choices.
- Note: Question numbers on the paper might be labeled simply as '1', '2', ... or with Vietnamese prefixes like 'Câu 1', 'Câu 2', 'Bài 1', etc.
- Carefully detect ambiguous situations:
    * Multiple choices marked: if one is clearly crossed out/erased and another is marked, pick the marked one.
    * If multiple are equally marked, set status="needs_review" and reason="multiple_marks_detected".
    * If no clear mark is detected, set selected_answer=null and reason="no_answer_detected".

Output ONLY valid JSON.
The JSON must follow this exact schema:

{
  "student_id": "auto",
  "results": [
    {
      "question_no": <integer>,
      "selected_answer": "<A|B|C|D|null>",
      "status": "<auto_graded|needs_review>",
      "reason": "<none|multiple_marks_detected|crossed_out_answer|double_circled_option|low_confidence|unclear_mark|no_answer_detected>",
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


def grade_student_paper(
    image_paths: List[str],
    answer_key: Dict[str, str],
    student_id: str,
) -> Optional[dict]:
    """
    Send student answer sheet images to Gemini and get grading results.

    Args:
        image_paths: List of paths to rendered page images for this student.
        answer_key: Dict mapping question number strings to correct answers.
                    e.g. {"1": "A", "2": "C", ...}
        student_id: Identifier for logging purposes.

    Returns:
        Parsed JSON dict from Gemini, or None on failure.
    """
    import time
    from google.api_core.exceptions import ResourceExhausted

    max_retries = 5
    base_delay = 10

    for attempt in range(max_retries):
        try:
            _configure_gemini()
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            print(f"[Gemini] Using model: {model_name} for student {student_id}")
            model = genai.GenerativeModel(
                model_name=model_name,
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
            print(f"[Gemini] JSON parse error for {student_id}: {e}")
            if 'raw_text' in locals():
                print(f"[Gemini] Raw response: {raw_text[:500]}")
            return None
        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "Too Many Requests" in err_msg or isinstance(e, ResourceExhausted):
                if attempt < max_retries - 1:
                    print(f"[Gemini] 429 Too Many Requests for {student_id}. Sleeping {base_delay}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(base_delay)
                    base_delay *= 1.5  # Exponential backoff
                    continue
            print(f"[Gemini] Error grading {student_id}: {e}")
            return None
    return None


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
