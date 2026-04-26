"""
In-memory job store for scoring_k.
In production, replace with Redis or a database.
"""
from __future__ import annotations
from typing import Dict, Optional
from models import GradingJob
import threading

_lock = threading.Lock()
_jobs: Dict[str, GradingJob] = {}


def create_job(job: GradingJob) -> GradingJob:
    with _lock:
        _jobs[job.job_id] = job
    return job


def get_job(job_id: str) -> Optional[GradingJob]:
    return _jobs.get(job_id)


def list_jobs() -> list[GradingJob]:
    return list(_jobs.values())


def update_job(job: GradingJob) -> None:
    with _lock:
        _jobs[job.job_id] = job


def delete_job(job_id: str) -> bool:
    with _lock:
        if job_id in _jobs:
            del _jobs[job_id]
            return True
    return False
