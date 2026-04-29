import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { uploadBatch } from '../api';
import toast from 'react-hot-toast';

const DEFAULT_ANSWER_KEY = {
  "1": "A", "2": "B", "3": "C", "4": "D", "5": "A",
  "6": "B", "7": "C", "8": "D", "9": "A", "10": "B"
};

export default function BatchUpload({ onJobCreated, modelName, subjectId, initialAnswerKey }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [pagesPerStudent, setPagesPerStudent] = useState(() => {
    const saved = localStorage.getItem('pagesPerStudent');
    return saved ? parseInt(saved, 10) : 2;
  });
  const [answerKeyText, setAnswerKeyText] = useState(() => {
    if (initialAnswerKey) return JSON.stringify(initialAnswerKey, null, 2);
    const saved = localStorage.getItem('answerKeyText');
    return saved || JSON.stringify(DEFAULT_ANSWER_KEY, null, 2);
  });

  useEffect(() => {
    if (initialAnswerKey) {
      setAnswerKeyText(JSON.stringify(initialAnswerKey, null, 2));
    }
  }, [initialAnswerKey]);

  useEffect(() => {
    localStorage.setItem('pagesPerStudent', pagesPerStudent);
  }, [pagesPerStudent]);

  useEffect(() => {
    localStorage.setItem('answerKeyText', answerKeyText);
  }, [answerKeyText]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [keyError, setKeyError] = useState(null);

  const validateKey = (text) => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Must be an object');
      setKeyError(null);
      return parsed;
    } catch (e) {
      setKeyError(e.message);
      return null;
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
    else toast.error('Please drop a PDF file');
  }, []);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Please select a PDF file'); return; }
    const parsed = validateKey(answerKeyText);
    if (!parsed) { toast.error('Fix answer key JSON first'); return; }

    setUploading(true);
    setUploadProgress(0);

    try {
      const fd = new FormData();
      fd.append('pdf_file', file);
      if (subjectId) {
        fd.append('subject_id', subjectId);
      } else {
        fd.append('answer_key_json', JSON.stringify(parsed));
      }
      fd.append('pages_per_student', pagesPerStudent);
      fd.append('model_name', modelName);

      const result = await uploadBatch(fd, setUploadProgress);
      toast.success(`Job created! ID: ${result.job_id.slice(0, 8)}…`);
      setFile(null);
      onJobCreated?.(result.job_id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
          <Upload className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Upload Exam Batch</h2>
          <p className="text-sm text-slate-400">PDF + Answer Key → AI Grading</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Drop zone */}
        <div
          className={`drop-zone rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('pdf-input').click()}
        >
          <input id="pdf-input" type="file" accept=".pdf" className="hidden" onChange={onFileChange} />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-slate-400 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-brand-400" />
              </div>
              <div>
                <p className="text-white font-medium">Drop PDF here or click to browse</p>
                <p className="text-slate-400 text-sm mt-1">Multi-student batch PDF supported</p>
              </div>
            </div>
          )}
        </div>

        {/* Pages per student */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Pages per Student
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPagesPerStudent(p => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-lg bg-navy-700 border border-navy-600 text-slate-300 hover:border-brand-500 transition-colors flex items-center justify-center">
              <Trash2 className="w-3 h-3" />
            </button>
            <span className="text-white font-semibold text-lg w-8 text-center">{pagesPerStudent}</span>
            <button type="button" onClick={() => setPagesPerStudent(p => p + 1)}
              className="w-8 h-8 rounded-lg bg-navy-700 border border-navy-600 text-slate-300 hover:border-brand-500 transition-colors flex items-center justify-center">
              <Plus className="w-3 h-3" />
            </button>
            <span className="text-slate-400 text-sm">pages = 1 student paper</span>
          </div>
        </div>

        {/* Answer key - only show if not using a subject */}
        {!subjectId ? (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Answer Key <span className="text-slate-500">(JSON: question → answer)</span>
            </label>
            <textarea
              rows={6}
              value={answerKeyText}
              onChange={(e) => { setAnswerKeyText(e.target.value); validateKey(e.target.value); }}
              className={`w-full bg-navy-800 border rounded-xl px-4 py-3 text-sm font-mono text-slate-200 resize-none focus:outline-none focus:ring-2 transition-all ${
                keyError ? 'border-rose-500 focus:ring-rose-500/30' : 'border-navy-600 focus:ring-brand-500/30 focus:border-brand-500'
              }`}
              placeholder='{"1": "A", "2": "B", ...}'
            />
            {keyError && (
              <p className="flex items-center gap-1 mt-1 text-rose-400 text-xs">
                <AlertCircle className="w-3 h-3" /> {keyError}
              </p>
            )}
            <p className="text-slate-500 text-xs mt-1">
              {Object.keys(JSON.parse(answerKeyText.replace(/[\s\n]/g, '') || '{}')).length || 0} questions defined
            </p>
          </div>
        ) : (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-4 h-4" />
             </div>
             <div>
                <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Môn học đã chọn</p>
                <p className="text-slate-300 text-sm">Sử dụng đáp án từ hệ thống ({Object.keys(initialAnswerKey || {}).length} câu)</p>
             </div>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Uploading…</span><span>{uploadProgress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={uploading || !!keyError}
          className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed
            bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 
            shadow-lg hover:shadow-brand-500/25 active:scale-[0.98]"
        >
          {uploading ? 'Uploading…' : '🚀 Start Grading'}
        </button>
      </form>
    </div>
  );
}
