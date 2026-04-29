"""
Review router — list flagged questions and accept teacher overrides.
"""
from __future__ import annotations
from typing import List

from fastapi import APIRouter, HTTPException

import job_store
from models import (
    GradingJob,
    QuestionResult,
    QuestionStatus,
    ReviewOverrideRequest,
    ReviewOverrideResponse,
    StudentResult,
)
from services.pdf_annotator import annotate_student_pdf
import os

router = APIRouter(prefix="/review", tags=["review"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _recalculate_total(student: StudentResult) -> float:
    return sum(q.score for q in student.results)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/{job_id}/flagged")
def get_flagged_questions(job_id: str):
    """
    Return all questions needing manual review for a job.
    Each item includes the crop image path for the UI to display.
    """
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    flagged = []
    for student in job.students:
        for q in student.results:
            if q.status == QuestionStatus.NEEDS_REVIEW:
                flagged.append(
                    {
                        "student_id": student.student_id,
                        "question_no": q.question_no,
                        "selected_answer": q.selected_answer,
                        "correct_answer": q.correct_answer,
                        "reason": q.reason,
                        "ai_confidence": q.ai_confidence,
                        "crop_image_url": (
                            f"/{q.crop_image_path.replace(chr(92), '/')}"
                            if q.crop_image_path
                            else None
                        ),
                        "name_crop_image_url": (
                            f"/{student.name_crop_image_path.replace(chr(92), '/')}"
                            if student.name_crop_image_path
                            else None
                        ),
                        "annotated_pdf_url": (
                            f"/{student.annotated_pdf_path.replace(chr(92), '/')}"
                            if student.annotated_pdf_path
                            else None
                        ),
                        "teacher_override": q.teacher_override,
                        "current_score": q.score,
                    }
                )
    return {
        "job_id": job_id, 
        "subject_id": job.subject_id,
        "flagged_count": len(flagged), 
        "items": flagged
    }


@router.post("/{job_id}/override", response_model=ReviewOverrideResponse)
def submit_override(job_id: str, payload: ReviewOverrideRequest):
    """
    Teacher submits a manual decision for a flagged question.
    Updates the question score and recalculates the student total.
    """
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # Find the student
    student = next(
        (s for s in job.students if s.student_id == payload.student_id), None
    )
    if not student:
        raise HTTPException(
            status_code=404, detail=f"Student {payload.student_id} not found in job"
        )

    # Find the question
    question = next(
        (q for q in student.results if q.question_no == payload.question_no), None
    )
    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question {payload.question_no} not found for student {payload.student_id}",
        )

    # Validate decision
    if payload.decision not in ("correct", "wrong"):
        raise HTTPException(
            status_code=422, detail="decision must be 'correct' or 'wrong'"
        )

    # Apply override
    if question.status == QuestionStatus.NEEDS_REVIEW:
        student.flagged_count = max(0, student.flagged_count - 1)
    
    question.teacher_override = payload.decision
    question.score = 1.0 if payload.decision == "correct" else 0.0
    question.status = QuestionStatus.REVIEWED

    # Recalculate student total
    student.total_score = _recalculate_total(student)

    # Regenerate annotated PDF with new scores
    # We need to find the student index
    s_idx = next((i for i, s in enumerate(job.students) if s.student_id == payload.student_id), 0)
    
    # Regenerate annotated PDF ONLY when all flags for this student are resolved
    if student.flagged_count == 0:
        # Get original PDF path
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

    # Check if all flags are resolved — update job status
    all_reviewed = all(
        q.status != QuestionStatus.NEEDS_REVIEW
        for s in job.students
        for q in s.results
    )
    if all_reviewed and job.status.value == "needs_review":
        from models import JobStatus
        job.status = JobStatus.COMPLETED

    job_store.update_job(job)

    return ReviewOverrideResponse(
        student_id=payload.student_id,
        question_no=payload.question_no,
        new_score=question.score,
        new_total=student.total_score,
        message=f"Override applied: Q{payload.question_no} marked as '{payload.decision}'",
    )
