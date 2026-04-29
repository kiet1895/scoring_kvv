"""
Pydantic data models for scoring_k.
"""
from __future__ import annotations
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    NEEDS_REVIEW = "needs_review"
    FAILED = "failed"


class QuestionStatus(str, Enum):
    AUTO_GRADED = "auto_graded"
    NEEDS_REVIEW = "needs_review"
    REVIEWED = "reviewed"


class AmbiguityReason(str, Enum):
    MULTIPLE_MARKS = "multiple_marks_detected"
    CROSSED_OUT = "crossed_out_answer"
    DOUBLE_CIRCLED = "double_circled_option"
    LOW_CONFIDENCE = "low_confidence"
    UNCLEAR_MARK = "unclear_mark"
    NO_ANSWER = "no_answer_detected"
    NONE = "none"


# ---------------------------------------------------------------------------
# Per-question result
# ---------------------------------------------------------------------------

class QuestionResult(BaseModel):
    question_no: int
    status: QuestionStatus = QuestionStatus.AUTO_GRADED
    selected_answer: Optional[str] = None      # e.g. "A", "B", "C", "D"
    correct_answer: Optional[str] = None
    score: float = 0.0                         # 1.0 = correct, 0.0 = wrong
    ai_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    reason: AmbiguityReason = AmbiguityReason.NONE
    crop_image_path: Optional[str] = None      # relative URL for the crop
    teacher_override: Optional[str] = None     # "correct" | "wrong"
    coord_y: Optional[float] = None            # Vertical position (0-1000) from AI


# ---------------------------------------------------------------------------
# Per-student paper
# ---------------------------------------------------------------------------

class StudentResult(BaseModel):
    student_id: str                            # e.g. "student_01"
    paper_image_paths: List[str] = []         # rendered page images
    results: List[QuestionResult] = []
    total_score: float = 0.0
    max_score: float = 0.0
    flagged_count: int = 0
    name_crop_image_path: Optional[str] = None # Crop for the student name/header
    annotated_pdf_path: Optional[str] = None  # Path to the PDF with marks/scores
    error_message: Optional[str] = None       # Why it failed (e.g. 429 Quota)


# ---------------------------------------------------------------------------
# Job (one PDF batch)
# ---------------------------------------------------------------------------

class GradingJob(BaseModel):
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    status: JobStatus = JobStatus.PENDING
    progress: int = 0                          # 0-100
    total_students: int = 0
    completed_students: int = 0
    students: List[StudentResult] = []
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    pages_per_student: int = 2
    answer_key: dict = Field(default_factory=dict)  # {"1": "A", "2": "B", ...}
    subject_id: Optional[str] = None
    model_name: str = "gemini-2.5-flash"


# ---------------------------------------------------------------------------
# API request / response models
# ---------------------------------------------------------------------------

class UploadResponse(BaseModel):
    job_id: str
    message: str


class JobListItem(BaseModel):
    job_id: str
    filename: str
    status: JobStatus
    progress: int
    total_students: int
    completed_students: int
    flagged_count: int
    avg_score: float


class ReviewOverrideRequest(BaseModel):
    student_id: str
    question_no: int
    decision: str   # "correct" | "wrong"


class ReviewOverrideResponse(BaseModel):
    student_id: str
    question_no: int
    new_score: float
    new_total: float
    message: str


# ---------------------------------------------------------------------------
# Subject Management
# ---------------------------------------------------------------------------

class Subject(BaseModel):
    subject_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    answer_key: dict = Field(default_factory=dict)  # {"1": "A", "2": "B", ...}
    created_at: Optional[str] = None
