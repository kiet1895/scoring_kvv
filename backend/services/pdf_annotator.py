"""
PDF Annotation Service.
Draws a professional, high-visibility grading summary table onto the PDF.
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import List, Dict
import fitz  # PyMuPDF

from models import StudentResult, QuestionStatus

def annotate_student_pdf(
    pdf_path: str,
    student_result: StudentResult,
    student_idx: int,
    pages_per_student: int,
    output_dir: str,
    job_id: str,
) -> str:
    """
    Creates a high-visibility annotated PDF with an improved results table and score banner.
    """
    try:
        if not os.path.exists(pdf_path):
            return ""

        doc = fitz.open(pdf_path)
        start_page = student_idx * pages_per_student
        end_page = start_page + pages_per_student
        
        new_doc = fitz.open()
        new_doc.insert_pdf(doc, from_page=start_page, to_page=min(end_page - 1, len(doc)-1))
        doc.close()
        
        if len(new_doc) == 0:
            return ""

        page = new_doc[0]
        width, height = page.rect.width, page.rect.height
        
        # --- 1. Enhanced Score Banner ---
        pct = (student_result.total_score / student_result.max_score * 100) if student_result.max_score > 0 else 0
        banner_color = (0, 0.5, 0.2) if pct >= 80 else (0.8, 0.4, 0) if pct >= 50 else (0.8, 0, 0)
        
        banner_rect = fitz.Rect(width - 250, 20, width - 20, 70)
        # Background with border
        page.draw_rect(banner_rect, color=banner_color, fill=banner_color, fill_opacity=0.1, width=2)
        
        # "DIEM" Label
        page.insert_text((width - 240, 40), "TONG DIEM:", fontsize=12, color=banner_color)
        # Big Score
        score_val = f"{student_result.total_score} / {student_result.max_score}"
        page.insert_text((width - 240, 62), score_val, fontsize=20, color=banner_color)
        # Percentage
        page.insert_text((width - 70, 62), f"{int(pct)}%", fontsize=14, color=banner_color)

        # --- 2. High-Visibility Results Table ---
        questions = student_result.results
        num_cols = 1 if len(questions) <= 25 else 2
        
        table_start_y = 90
        row_h = 20 # Taller rows
        col_widths = [40, 50, 50] 
        table_w = sum(col_widths)
        
        for col_idx in range(num_cols):
            start_idx = col_idx * 25
            end_idx = min((col_idx + 1) * 25, len(questions))
            if start_idx >= len(questions): break

            col_x = (width - 160) if num_cols == 1 else (width - 310 + col_idx * 155)
            
            # Header
            h_rect = fitz.Rect(col_x, table_start_y, col_x + table_w, table_start_y + row_h)
            page.draw_rect(h_rect, color=(0, 0, 0), fill=(0, 0, 0), fill_opacity=1, width=0)
            page.insert_text((col_x + 8, table_start_y + 14), "CAU", fontsize=10, color=(1,1,1))
            page.insert_text((col_x + 50, table_start_y + 14), "KQ", fontsize=10, color=(1,1,1))
            page.insert_text((col_x + 100, table_start_y + 14), "D/A", fontsize=10, color=(1,1,1))

            # Rows
            for i in range(start_idx, end_idx):
                q = questions[i]
                row_y = table_start_y + row_h + (i - start_idx) * row_h
                r_rect = fitz.Rect(col_x, row_y, col_x + table_w, row_y + row_h)
                
                # Striping
                if (i % 2) == 0:
                    page.draw_rect(r_rect, color=None, fill=(0.92, 0.92, 0.92), fill_opacity=1, width=0)
                
                # Borders
                page.draw_rect(r_rect, color=(0.4, 0.4, 0.4), width=0.8)

                is_correct = q.score > 0
                is_flagged = q.status == QuestionStatus.NEEDS_REVIEW
                
                res_text = "DUNG" if is_correct else "SAI"
                if is_flagged: res_text = "???"
                
                res_color = (0, 0.5, 0.2) if is_correct else (0.8, 0, 0)
                if is_flagged: res_color = (0.8, 0.5, 0)

                # Question No
                page.insert_text((col_x + 10, row_y + 14), str(q.question_no), fontsize=10, color=(0,0,0))
                # Result
                page.insert_text((col_x + 50, row_y + 14), res_text, fontsize=9, color=res_color)
                
                # Correct Answer - ONLY show if NOT flagged
                if not is_flagged:
                    page.insert_text((col_x + 105, row_y + 14), q.correct_answer or "-", fontsize=10, color=(0,0,0))
                else:
                    # Leave blank for flagged questions as requested
                    pass

        # --- 3. Save ---
        out_dir = Path(output_dir) / job_id / "annotated"
        out_dir.mkdir(parents=True, exist_ok=True)
        
        import time
        pdf_filename = f"{student_result.student_id}_graded_{int(time.time())}.pdf"
        out_path = out_dir / pdf_filename
        
        new_doc.save(str(out_path))
        new_doc.close()
        
        return str(out_path)

    except Exception as e:
        print(f"[PDFAnnotator] Error: {e}")
        return ""
