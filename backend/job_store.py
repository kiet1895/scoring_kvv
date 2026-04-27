"""
File-based job store for scoring_k.
Persists job data to jobs.json to survive backend restarts.
"""
from __future__ import annotations
import json
import threading
from pathlib import Path
from typing import Dict, Optional, List

from models import GradingJob

JOBS_FILE = Path("jobs.json")
_lock = threading.Lock()

def _load_all() -> Dict[str, GradingJob]:
    if not JOBS_FILE.exists():
        return {}
    try:
        with open(JOBS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
            return {jid: GradingJob.model_validate(data) for jid, data in raw.items()}
    except Exception as e:
        print(f"[JobStore] Warning: Could not load {JOBS_FILE}: {e}")
        return {}

def _save_all(jobs: Dict[str, GradingJob]):
    try:
        with open(JOBS_FILE, "w", encoding="utf-8") as f:
            # Pydantic's model_dump handles serialization of nested models
            data = {jid: job.model_dump() for jid, job in jobs.items()}
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[JobStore] Error: Could not save to {JOBS_FILE}: {e}")

# Initial load
_jobs = _load_all()


def create_job(job: GradingJob) -> GradingJob:
    with _lock:
        _jobs[job.job_id] = job
        _save_all(_jobs)
    return job


def get_job(job_id: str) -> Optional[GradingJob]:
    with _lock:
        return _jobs.get(job_id)


def list_jobs() -> List[GradingJob]:
    with _lock:
        # Sort by creation time if available, otherwise just return list
        return sorted(_jobs.values(), key=lambda j: j.created_at or "", reverse=True)


def update_job(job: GradingJob) -> None:
    with _lock:
        _jobs[job.job_id] = job
        _save_all(_jobs)


def delete_job(job_id: str) -> bool:
    with _lock:
        if job_id in _jobs:
            del _jobs[job_id]
            _save_all(_jobs)
            return True
    return False
