"""
Subjects router — manages exam subjects and answer key extraction.
"""
from __future__ import annotations
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

import subject_store
from models import Subject
from services.gemini_grader import extract_answer_key
import fitz
from PIL import Image

router = APIRouter(prefix="/subjects", tags=["subjects"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

class SubjectCreate(BaseModel):
    name: str
    answer_key: Optional[dict] = None

@router.get("", response_model=List[Subject])
async def list_subjects():
    return subject_store.list_subjects()

@router.post("", response_model=Subject)
async def create_subject(data: SubjectCreate):
    subject = Subject(
        name=data.name,
        answer_key=data.answer_key or {},
        created_at=datetime.now(timezone.utc).isoformat()
    )
    return subject_store.create_subject(subject)

@router.get("/{subject_id}", response_model=Subject)
async def get_subject(subject_id: str):
    subject = subject_store.get_subject(subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    answer_key: Optional[dict] = None

@router.patch("/{subject_id}", response_model=Subject)
async def update_subject(subject_id: str, data: SubjectUpdate):
    subject = subject_store.get_subject(subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    if data.name is not None:
        subject.name = data.name
    if data.answer_key is not None:
        subject.answer_key = data.answer_key
        
    subject_store.update_subject(subject)
    return subject

@router.delete("/{subject_id}")
async def delete_subject(subject_id: str):
    if subject_store.delete_subject(subject_id):
        return {"message": "Subject deleted"}
    raise HTTPException(status_code=404, detail="Subject not found")

@router.post("/{subject_id}/extract-key")
async def extract_key_from_template(
    subject_id: str,
    template_file: UploadFile = File(...),
    model_name: Optional[str] = Form(None),
):
    """
    Upload a template PDF or image to extract the answer key.
    Updates the subject's answer_key in place.
    """
    subject = subject_store.get_subject(subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Save temp file
    temp_dir = Path(UPLOAD_DIR) / "templates"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    file_ext = Path(template_file.filename).suffix.lower()
    temp_path = temp_dir / f"{subject_id}_template{file_ext}"
    
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(template_file.file, f)

    image_paths = []
    
    if file_ext == ".pdf":
        # Convert ALL pages to images
        doc = fitz.open(temp_path)
        zoom = 200 / 72.0
        mat = fitz.Matrix(zoom, zoom)
        
        for i in range(len(doc)):
            page = doc[i]
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_path = temp_dir / f"{subject_id}_template_p{i+1}.png"
            img.save(str(img_path), "PNG")
            image_paths.append(str(img_path))
        doc.close()
    else:
        # Assume it's an image
        image_paths.append(str(temp_path))

    try:
        answer_key = extract_answer_key(image_paths, model_name=model_name)
        subject.answer_key = answer_key
        subject_store.update_subject(subject)
        return {"message": "Answer key extracted successfully", "answer_key": answer_key}
    except Exception as e:
        print(f"[Subjects] Error extracting key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract answer key: {e}")
