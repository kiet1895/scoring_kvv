"""
File-based subject store for scoring_k.
Persists subject data to subjects.json.
"""
from __future__ import annotations
import json
import threading
from pathlib import Path
from typing import Dict, Optional, List

from models import Subject

SUBJECTS_FILE = Path("subjects.json")
_lock = threading.Lock()

def _load_all() -> Dict[str, Subject]:
    if not SUBJECTS_FILE.exists():
        return {}
    try:
        with open(SUBJECTS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
            return {sid: Subject.model_validate(data) for sid, data in raw.items()}
    except Exception as e:
        print(f"[SubjectStore] Warning: Could not load {SUBJECTS_FILE}: {e}")
        return {}

def _save_all(subjects: Dict[str, Subject]):
    try:
        with open(SUBJECTS_FILE, "w", encoding="utf-8") as f:
            data = {sid: s.model_dump() for sid, s in subjects.items()}
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[SubjectStore] Error: Could not save to {SUBJECTS_FILE}: {e}")

# Initial load
_subjects = _load_all()

def create_subject(subject: Subject) -> Subject:
    with _lock:
        _subjects[subject.subject_id] = subject
        _save_all(_subjects)
    return subject

def get_subject(subject_id: str) -> Optional[Subject]:
    with _lock:
        return _subjects.get(subject_id)

def list_subjects() -> List[Subject]:
    with _lock:
        return sorted(_subjects.values(), key=lambda s: s.created_at or "", reverse=True)

def update_subject(subject: Subject) -> None:
    with _lock:
        _subjects[subject.subject_id] = subject
        _save_all(_subjects)

def delete_subject(subject_id: str) -> bool:
    with _lock:
        if subject_id in _subjects:
            del _subjects[subject_id]
            _save_all(_subjects)
            return True
    return False
