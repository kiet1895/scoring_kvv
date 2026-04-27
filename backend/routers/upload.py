"""
Upload router — accepts PDF batch + answer key JSON.
Launches background grading task immediately.
"""
from __future__ import annotations
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

import job_store
from models import GradingJob, JobStatus, UploadResponse
from services.pipeline import run_grading_pipeline

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


@router.post("", response_model=UploadResponse)
async def upload_batch(
    background_tasks: BackgroundTasks,
    pdf_file: UploadFile = File(..., description="PDF exam batch"),
    answer_key_json: str = Form(
        ...,
        description='JSON string mapping question numbers to answers. e.g. {"1":"A","2":"B"}'
    ),
    pages_per_student: int = Form(2, description="How many PDF pages = one student paper"),
    model_name: str = Form("gemini-1.5-flash", description="Gemini model version to use"),
):
    """
    Upload a PDF batch and answer key to start grading.
    Returns immediately with a job_id; grading happens in the background.
    """
    # Validate answer key
    try:
        answer_key: dict = json.loads(answer_key_json)
        if not answer_key:
            raise ValueError("Answer key is empty")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Invalid answer_key_json: {e}")

    # Persist uploaded PDF
    pdf_dir = Path(UPLOAD_DIR) / "pdfs"
    pdf_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(pdf_file.filename).name if pdf_file.filename else "upload.pdf"
    pdf_path = pdf_dir / safe_name

    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(pdf_file.file, f)

    # Create job record
    job = GradingJob(
        filename=safe_name,
        status=JobStatus.PENDING,
        pages_per_student=pages_per_student,
        answer_key=answer_key,
        model_name=model_name,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    job_store.create_job(job)

    # Launch background grading
    background_tasks.add_task(
        run_grading_pipeline,
        job_id=job.job_id,
        pdf_path=str(pdf_path),
        answer_key=answer_key,
        pages_per_student=pages_per_student,
        model_name=model_name,
        upload_dir=UPLOAD_DIR,
    )

    return UploadResponse(
        job_id=job.job_id,
        message=f"Job {job.job_id} created. Grading started in background.",
    )
