"""
Grading pipeline — orchestrates PDF splitting, image extraction, and AI grading.
Called as a FastAPI background task.
"""
from __future__ import annotations
import os
from typing import Dict

import job_store
from models import (
    GradingJob,
    JobStatus,
    QuestionResult,
    QuestionStatus,
    AmbiguityReason,
    StudentResult,
)
from services.pdf_splitter import split_pdf_into_students, get_answer_sheet_page
from services.image_extractor import crop_question_region, crop_name_region
from services.gemini_grader import grade_student_paper, build_demo_result
from services.pdf_annotator import annotate_student_pdf

DEMO_MODE = not bool(os.getenv("GEMINI_API_KEY"))


def run_grading_pipeline(
    job_id: str,
    pdf_path: str,
    answer_key: Dict[str, str],
    pages_per_student: int,
    model_name: str,
    upload_dir: str,
    retry_only_failed: bool = False,
) -> None:
    """
    Full grading pipeline run as a background task.
    Supports 'retry_only_failed' to only process students with error_message.
    """
    job = job_store.get_job(job_id)
    if not job:
        return

    try:
        # --- Update status to processing ---
        job.status = JobStatus.PROCESSING
        job_store.update_job(job)

        # --- Step 1: Split PDF (Only if not retrying or pages missing) ---
        students_pages = split_pdf_into_students(
            pdf_path=pdf_path,
            pages_per_student=pages_per_student,
            output_dir=upload_dir,
            job_id=job_id,
        )

        job.total_students = len(students_pages)
        
        # If retrying, we might already have some student objects. 
        # We need to map students_pages to the right student index.
        if not retry_only_failed or not job.students:
            job.students = [None] * job.total_students
        
        job_store.update_job(job)

        total_questions = len(answer_key)
        has_review = False

        # --- Step 2: Grade each student in parallel ---
        student_results = [None] * job.total_students
        import concurrent.futures
        
        def process_student(idx_student_data):
            idx, (student_id, image_paths) = idx_student_data
            error_msg = None
            
            if DEMO_MODE:
                ai_result = build_demo_result(student_id, answer_key)
            else:
                ai_result = grade_student_paper(image_paths, answer_key, student_id, model_name=model_name)
                # No more forced sleep for paid/optimized tier

            if ai_result is None or "error" in ai_result:
                error_msg = ai_result.get("error") if ai_result else "Unknown AI error"
                ai_result = _fallback_needs_review(student_id, answer_key)

            answer_sheet_page = get_answer_sheet_page(image_paths)
            question_results = []
            local_has_review = False
            
            for q_data in ai_result.get("results", []):
                q_no = q_data["question_no"]
                correct = answer_key.get(str(q_no), "?")
                selected = q_data.get("selected_answer")
                status = q_data.get("status", "auto_graded")
                reason = q_data.get("reason", "none")
                confidence = float(q_data.get("ai_confidence", 1.0))

                is_correct = (selected == correct) if selected else False
                score = 1.0 if (is_correct and status == "auto_graded") else 0.0

                crop_path = None
                if status == "needs_review":
                    local_has_review = True
                    crop_path = crop_question_region(
                        page_image_path=answer_sheet_page,
                        question_no=q_no,
                        total_questions=total_questions,
                        crop_output_dir=upload_dir,
                        student_id=student_id,
                        job_id=job_id,
                    )

                question_results.append(
                    QuestionResult(
                        question_no=q_no,
                        status=QuestionStatus(status),
                        selected_answer=selected,
                        correct_answer=correct,
                        score=score,
                        ai_confidence=confidence,
                        reason=AmbiguityReason(reason) if reason in [r.value for r in AmbiguityReason] else AmbiguityReason.NONE,
                        crop_image_path=crop_path,
                        coord_y=float(q_data.get("coord_y")) if q_data.get("coord_y") is not None else None,
                    )
                )

            total_score = sum(q.score for q in question_results)
            flagged = sum(1 for q in question_results if q.status == QuestionStatus.NEEDS_REVIEW)

            name_crop_path = crop_name_region(
                page_image_path=answer_sheet_page,
                crop_output_dir=upload_dir,
                student_id=student_id,
                job_id=job_id,
            )

            annotated_path = None
            if flagged == 0 and error_msg is None:
                annotated_path = annotate_student_pdf(
                    pdf_path=pdf_path,
                    student_result=StudentResult(
                        student_id=student_id,
                        results=question_results,
                        total_score=total_score,
                        max_score=float(total_questions),
                    ),
                    student_idx=idx,
                    pages_per_student=pages_per_student,
                    output_dir=upload_dir,
                    job_id=job_id,
                )

            return idx, local_has_review, StudentResult(
                student_id=student_id,
                paper_image_paths=image_paths,
                results=question_results,
                total_score=total_score,
                max_score=float(total_questions),
                flagged_count=flagged,
                name_crop_image_path=name_crop_path,
                annotated_pdf_path=annotated_path,
                error_message=error_msg,
            )

        # Adjust parallel workers based on available API keys
        # Read parallel workers from .env (default to 1 for safety)
        max_workers_env = int(os.getenv("MAX_WORKERS", "1"))
        n_workers = min(max_workers_env, job.total_students) if job.total_students > 0 else 1
        
        # Prepare list of tasks (filter out already successful students if retrying)
        student_results = [None] * job.total_students
        tasks = []
        already_completed_count = 0

        # Pre-fill student_results with existing data if retrying
        existing_students = {s.student_id: s for s in job.students if s}
        
        for idx, item in enumerate(students_pages):
            student_id = item[0]
            existing = existing_students.get(student_id)
            
            # If retry and student succeeded previously, skip them
            if retry_only_failed and existing and existing.error_message is None and existing.results:
                student_results[idx] = existing
                already_completed_count += 1
                if any(q.status == QuestionStatus.NEEDS_REVIEW for q in existing.results):
                    has_review = True
            else:
                tasks.append((idx, item))

        completed = already_completed_count
        # Initialize progress
        job.completed_students = completed
        job.progress = int(completed / job.total_students * 100)
        job.students = [s for s in student_results if s is not None]
        job_store.update_job(job)

        with concurrent.futures.ThreadPoolExecutor(max_workers=n_workers) as executor:
            future_to_student = {executor.submit(process_student, item): item for item in tasks}
            for future in concurrent.futures.as_completed(future_to_student):
                idx, local_has_review, s_result = future.result()
                student_results[idx] = s_result
                if local_has_review:
                    has_review = True
                
                completed += 1
                job.completed_students = completed
                job.progress = int(completed / job.total_students * 100)
                # Keep the list flat (no Nones for not-yet-completed) to avoid frontend crashes
                job.students = [s for s in student_results if s is not None]
                job_store.update_job(job)

        # --- Step 3: Final status ---
        job.students = student_results
        job.status = JobStatus.NEEDS_REVIEW if has_review else JobStatus.COMPLETED
        job.progress = 100
        job_store.update_job(job)

    except Exception as e:
        job = job_store.get_job(job_id)
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job_store.update_job(job)
        print(f"[Pipeline] Fatal error for job {job_id}: {e}")
        raise


def _fallback_needs_review(student_id: str, answer_key: Dict[str, str]) -> dict:
    """Return a result dict with all questions flagged for review."""
    results = [
        {
            "question_no": int(q),
            "selected_answer": None,
            "status": "needs_review",
            "reason": "low_confidence",
            "ai_confidence": 0.0,
        }
        for q in answer_key
    ]
    return {"student_id": student_id, "results": results}
