"""
PDF splitting service.
Splits a multi-student PDF into per-student image sets.
Each student's pages are rendered as PIL Images.
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import List, Tuple

import fitz  # PyMuPDF
from PIL import Image


def split_pdf_into_students(
    pdf_path: str,
    pages_per_student: int,
    output_dir: str,
    job_id: str,
) -> List[Tuple[str, List[str]]]:
    """
    Split a PDF into per-student image sets.

    Args:
        pdf_path: Absolute path to the uploaded PDF.
        pages_per_student: How many PDF pages = one student paper.
        output_dir: Base directory to save rendered page images.
        job_id: Used to namespace the output files.

    Returns:
        List of (student_id, [image_paths]) tuples.
    """
    base_out = Path(output_dir) / job_id / "pages"
    base_out.mkdir(parents=True, exist_ok=True)

    # Render all pages to PIL images (200 DPI for quality)
    doc = fitz.open(pdf_path)
    all_pages: List[Image.Image] = []
    
    zoom = 200 / 72.0
    mat = fitz.Matrix(zoom, zoom)
    
    for page in doc:
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        all_pages.append(img)
    
    doc.close()

    total_pages = len(all_pages)
    num_students = max(1, total_pages // pages_per_student)
    students: List[Tuple[str, List[str]]] = []

    for student_idx in range(num_students):
        student_id = f"student_{student_idx + 1:03d}"
        start_page = student_idx * pages_per_student
        end_page = start_page + pages_per_student
        student_pages = all_pages[start_page:end_page]

        image_paths: List[str] = []
        for page_idx, page_img in enumerate(student_pages):
            img_filename = f"{student_id}_page_{page_idx + 1}.png"
            img_path = base_out / img_filename
            page_img.save(str(img_path), "PNG")
            image_paths.append(str(img_path))

        students.append((student_id, image_paths))

    return students


def get_answer_sheet_page(image_paths: List[str]) -> str:
    """Return the path of the primary answer sheet page (first page)."""
    if not image_paths:
        raise ValueError("No image paths provided")
    return image_paths[0]
