"""
Jobs router — query job status and results.
"""
from __future__ import annotations
from typing import List

from fastapi import APIRouter, HTTPException

import job_store
from models import GradingJob, JobListItem, JobStatus

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
def list_jobs():
    """Return summary list of all grading jobs."""
    jobs = job_store.list_jobs()
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
