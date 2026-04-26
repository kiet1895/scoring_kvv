"""
Image extraction service.
Crops a specific question's region from an answer-sheet image.
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image


# Approximate layout constants for a standard bubble-sheet answer paper.
# These assume the answer bubbles are laid out in a single column/grid.
# You can tune these percentages to match your actual paper layout.

ANSWER_AREA_TOP_FRACTION = 0.15     # where answer rows start (% from top)
ANSWER_AREA_BOTTOM_FRACTION = 0.90  # where answer rows end (% from top)
ANSWER_AREA_LEFT_FRACTION = 0.0     # left edge of the crop
ANSWER_AREA_RIGHT_FRACTION = 1.0    # right edge of the crop


def crop_question_region(
    page_image_path: str,
    question_no: int,
    total_questions: int,
    crop_output_dir: str,
    student_id: str,
    job_id: str,
) -> Optional[str]:
    """
    Extract the image region for a specific question from an answer sheet page.

    Args:
        page_image_path: Path to the full-page rendered image.
        question_no: 1-indexed question number.
        total_questions: Total number of questions on the sheet.
        crop_output_dir: Base directory to save crop images.
        student_id: Used to namespace output files.
        job_id: Used to namespace output directory.

    Returns:
        Path to the saved crop image, or None on failure.
    """
    try:
        img = Image.open(page_image_path)
        width, height = img.size

        # Calculate the answer area bounds in pixels
        area_top = int(height * ANSWER_AREA_TOP_FRACTION)
        area_bottom = int(height * ANSWER_AREA_BOTTOM_FRACTION)
        area_height = area_bottom - area_top

        # Calculate each question row height
        row_height = area_height / total_questions
        # Add padding around the question row
        padding = max(5, int(row_height * 0.1))

        q_idx = question_no - 1
        row_top = int(area_top + q_idx * row_height) - padding
        row_bottom = int(area_top + (q_idx + 1) * row_height) + padding

        left = int(width * ANSWER_AREA_LEFT_FRACTION)
        right = int(width * ANSWER_AREA_RIGHT_FRACTION)

        # Clamp to image bounds
        row_top = max(0, row_top)
        row_bottom = min(height, row_bottom)

        cropped = img.crop((left, row_top, right, row_bottom))

        # Save crop
        out_dir = Path(crop_output_dir) / job_id / "crops"
        out_dir.mkdir(parents=True, exist_ok=True)
        crop_filename = f"{student_id}_q{question_no:03d}.png"
        crop_path = out_dir / crop_filename
        cropped.save(str(crop_path), "PNG")

        return str(crop_path)

    except Exception as e:
        print(f"[ImageExtractor] Failed to crop Q{question_no} for {student_id}: {e}")
        return None

def crop_name_region(
    page_image_path: str,
    crop_output_dir: str,
    student_id: str,
    job_id: str,
) -> Optional[str]:
    """
    Extract the top portion (name/header region) of the answer sheet.
    """
    try:
        img = Image.open(page_image_path)
        width, height = img.size

        # Crop the top 15% of the page
        area_bottom = int(height * ANSWER_AREA_TOP_FRACTION)
        
        cropped = img.crop((0, 0, width, area_bottom))

        out_dir = Path(crop_output_dir) / job_id / "crops"
        out_dir.mkdir(parents=True, exist_ok=True)
        crop_filename = f"{student_id}_name_header.png"
        crop_path = out_dir / crop_filename
        cropped.save(str(crop_path), "PNG")

        return str(crop_path)

    except Exception as e:
        print(f"[ImageExtractor] Failed to crop name region for {student_id}: {e}")
        return None
