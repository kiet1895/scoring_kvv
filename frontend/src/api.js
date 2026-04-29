// Centralized API client
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8001',
  timeout: 30000,
});

// ── Jobs ──────────────────────────────────────────────────────────
export const fetchJobs = (subjectId = null) => {
  const url = subjectId ? `/jobs?subject_id=${subjectId}` : '/jobs';
  return api.get(url).then(r => r.data);
};
export const fetchJob  = (jobId) => api.get(`/jobs/${jobId}`).then(r => r.data);
export const deleteJob = (jobId) => api.delete(`/jobs/${jobId}`).then(r => r.data);
export const retryJob = (jobId) => api.post(`/jobs/${jobId}/retry`).then(r => r.data);
export const fetchHealth = () => api.get('/health').then(r => r.data);
export const generateStudentPDF = (jobId, studentId) => 
  api.post(`/jobs/${jobId}/students/${studentId}/generate-pdf`).then(r => r.data);

// ── Upload ────────────────────────────────────────────────────────
export const uploadBatch = (formData, onProgress) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  }).then(r => r.data);

// ── Review ────────────────────────────────────────────────────────
export const fetchFlagged  = (jobId) => api.get(`/review/${jobId}/flagged`).then(r => r.data);
export const submitOverride = (jobId, payload) =>
  api.post(`/review/${jobId}/override`, payload).then(r => r.data);

// ── Subjects ──────────────────────────────────────────────────────
export const fetchSubjects = () => api.get('/subjects').then(r => r.data);
export const createSubject = (data) => api.post('/subjects', data).then(r => r.data);
export const updateSubject = (sid, data) => api.patch(`/subjects/${sid}`, data).then(r => r.data);
export const deleteSubject = (sid) => api.delete(`/subjects/${sid}`).then(r => r.data);
export const extractKeyFromTemplate = (sid, formData) => 
  api.post(`/subjects/${sid}/extract-key`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

// ── Export (client-side CSV) ───────────────────────────────────────
export const exportCSV = (job) => {
  const rows = [['Student ID', 'Score', 'Max Score', 'Percentage', 'Flagged']];
  for (const s of job.students) {
    const pct = s.max_score > 0 ? ((s.total_score / s.max_score) * 100).toFixed(1) : '0';
    rows.push([s.student_id, s.total_score, s.max_score, pct + '%', s.flagged_count]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${job.filename.replace('.pdf', '')}_results.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default api;
