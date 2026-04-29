"""
Jobs router — query job status and results.
"""
from __future__ import annotations
from typing import List, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
import io
import xlsxwriter

import job_store
from models import GradingJob, JobListItem, JobStatus, StudentResult
from services.pdf_annotator import annotate_student_pdf
import os

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _count_flagged(job: GradingJob) -> int:
    return sum(
        1
        for s in job.students
        for q in s.results
        if q.status == "needs_review"
    )


def _avg_score(job: GradingJob) -> float:
    scores = [s.total_score for s in job.students if s.max_score > 0]
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 2)


@router.get("", response_model=List[JobListItem])
def list_jobs(subject_id: Optional[str] = None):
    """Return summary list of all grading jobs, optionally filtered by subject."""
    jobs = job_store.list_jobs()
    
    # Filter by subject if provided
    if subject_id:
        jobs = [j for j in jobs if j.subject_id == subject_id]
        
    items = []
    for job in jobs:
        items.append(
            JobListItem(
                job_id=job.job_id,
                filename=job.filename,
                status=job.status,
                progress=job.progress,
                total_students=job.total_students,
                completed_students=job.completed_students,
                flagged_count=_count_flagged(job),
                avg_score=_avg_score(job),
            )
        )
    # Most recent first
    return sorted(items, key=lambda x: x.job_id, reverse=True)


@router.get("/{job_id}", response_model=GradingJob)
def get_job(job_id: str):
    """Return full details for a single job including all student results."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@router.delete("/{job_id}")
def delete_job(job_id: str):
    """Remove a job from the store."""
    removed = job_store.delete_job(job_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return {"message": f"Job {job_id} deleted"}


@router.post("/{job_id}/students/{student_id}/generate-pdf")
def generate_student_pdf_endpoint(job_id: str, student_id: str):
    """Force generation of the annotated PDF for a specific student."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    student = next((s for s in job.students if s.student_id == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    s_idx = next((i for i, s in enumerate(job.students) if s.student_id == student_id), 0)
    
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    pdf_path = os.path.join(upload_dir, "pdfs", job.filename)

    annotated_path = annotate_student_pdf(
        pdf_path=pdf_path,
        student_result=student,
        student_idx=s_idx,
        pages_per_student=job.pages_per_student,
        output_dir=upload_dir,
        job_id=job.job_id,
    )
    student.annotated_pdf_path = annotated_path
    job_store.update_job(job)
    
    return {"status": "success", "annotated_pdf_url": f"/{annotated_path.replace(os.sep, '/')}"}
@router.post("/{job_id}/retry")
def retry_failed_students_endpoint(job_id: str, background_tasks: BackgroundTasks):
    """Restart grading only for students who failed (status was not set or error_message exists)."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    pdf_path = os.path.join(upload_dir, "pdfs", job.filename)

    from services.pipeline import run_grading_pipeline
    background_tasks.add_task(
        run_grading_pipeline,
        job_id=job.job_id,
        pdf_path=pdf_path,
        answer_key=job.answer_key,
        pages_per_student=job.pages_per_student,
        model_name=job.model_name,
        upload_dir=upload_dir,
        retry_only_failed=True
    )
    
    return {"message": "Retry started for failed students"}

@router.get("/{job_id}/export-excel")
def export_excel_endpoint(job_id: str):
    """Generate an Excel file with student name images embedded."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output)
    worksheet = workbook.add_worksheet("Results")

    # Define formats
    header_fmt = workbook.add_format({
        'bold': True, 'bg_color': '#1E293B', 'font_color': 'white',
        'border': 1, 'align': 'center', 'valign': 'vcenter'
    })
    cell_fmt = workbook.add_format({
        'border': 1, 'align': 'center', 'valign': 'vcenter'
    })
    
    # Set column widths
    worksheet.set_column('A:A', 15)  # Student ID
    worksheet.set_column('B:B', 45)  # Name Crop
    worksheet.set_column('C:C', 10)  # Score
    worksheet.set_column('D:D', 10)  # Max
    worksheet.set_column('E:E', 12)  # %
    worksheet.set_column('F:F', 10)  # Flagged

    # Header row
    headers = ["Student ID", "Name Header (Image)", "Score", "Max Score", "Percentage", "Flagged"]
    for col, text in enumerate(headers):
        worksheet.write(0, col, text, header_fmt)
    worksheet.set_row(0, 30) # Header height

    # Data rows
    for row_idx, s in enumerate(job.students, start=1):
        # Set row height to fit image better
        worksheet.set_row(row_idx, 60)
        
        pct = (s.total_score / s.max_score * 100) if s.max_score > 0 else 0
        
        worksheet.write(row_idx, 0, s.student_id, cell_fmt)
        worksheet.write(row_idx, 2, s.total_score, cell_fmt)
        worksheet.write(row_idx, 3, s.max_score, cell_fmt)
        worksheet.write(row_idx, 4, f"{pct:.1f}%", cell_fmt)
        worksheet.write(row_idx, 5, s.flagged_count, cell_fmt)

        # Insert Image if exists
        if s.name_crop_image_path and os.path.exists(s.name_crop_image_path):
            try:
                from PIL import Image as PILImage
                with PILImage.open(s.name_crop_image_path) as img:
                    img_w, img_h = img.size
                
                # Target dimensions in Excel (approx pixels)
                # Col width 45 is ~335px, Row height 60 is ~80px
                target_w = 330
                target_h = 75
                
                scale_w = target_w / img_w
                scale_h = target_h / img_h
                scale = min(scale_w, scale_h, 1.0) # Don't upscale, only downscale
                
                worksheet.insert_image(row_idx, 1, s.name_crop_image_path, {
                    'x_scale': scale,
                    'y_scale': scale,
                    'x_offset': 5,
                    'y_offset': 3,
                    'object_position': 1
                })
            except Exception as e:
                print(f"Error inserting image: {e}")
                worksheet.write(row_idx, 1, "[Image Error]", cell_fmt)

    workbook.close()
    output.seek(0)
    
    safe_filename = job.filename.replace('.pdf', '').replace(' ', '_')
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=Results_{safe_filename}.xlsx"}
    )
