import asyncio
import os
import json
from pathlib import Path
from services.pipeline import run_grading_pipeline
from models import GradingJob, JobStatus
import job_store

def test_pipeline():
    # Setup dummy pdf
    upload_dir = "uploads"
    Path(upload_dir).mkdir(parents=True, exist_ok=True)
    pdf_path = f"{upload_dir}/test.pdf"
    
    # Let's create a real, minimal PDF using PyMuPDF (fitz)
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(fitz.Point(50, 50), "Test Answer Sheet Page 1")
    doc.save(pdf_path)
    doc.close()

    answer_key = {"1": "A", "2": "B"}
    
    job = GradingJob(
        filename="test.pdf",
        status=JobStatus.PENDING,
        pages_per_student=1,
        answer_key=answer_key,
        created_at="now"
    )
    job_store.create_job(job)
    
    print(f"Running pipeline for job {job.job_id}...")
    run_grading_pipeline(job.job_id, pdf_path, answer_key, 1, upload_dir)
    
    updated_job = job_store.get_job(job.job_id)
    print(f"Job Status: {updated_job.status}")
    if updated_job.error_message:
        print(f"Error: {updated_job.error_message}")

if __name__ == "__main__":
    test_pipeline()
