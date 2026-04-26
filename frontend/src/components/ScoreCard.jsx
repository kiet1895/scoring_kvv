import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, User, Check, X, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { generateStudentPDF } from '../api';
import toast from 'react-hot-toast';

const ScoreBar = ({ score, max }) => {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-white min-w-[3rem] text-right">
        {score.toFixed(1)}/{max}
      </span>
      <span className="text-xs text-slate-400 min-w-[3rem]">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
};

const QuestionDot = ({ q }) => {
  if (q.teacher_override) {
    const correct = q.teacher_override === 'correct';
    return (
      <div
        title={`Q${q.question_no}: ${correct ? 'Correct (teacher)' : 'Wrong (teacher)'}`}
        className={`w-7 h-7 rounded-md flex flex-col items-center justify-center text-[10px] font-bold border relative ${
          correct
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
            : 'bg-rose-500/20 border-rose-500/50 text-rose-400'
        }`}
      >
        <span>{q.question_no}</span>
        {correct ? <Check className="w-2.5 h-2.5 absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5" /> : <X className="w-2.5 h-2.5 absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5" />}
      </div>
    );
  }
  if (q.status === 'needs_review') {
    return (
      <div
        title={`Q${q.question_no}: Needs review`}
        className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold bg-amber-500/20 border border-amber-500/50 text-amber-400"
      >
        {q.question_no}
      </div>
    );
  }
  const correct = q.score > 0;
  return (
    <div
      title={`Q${q.question_no}: ${correct ? `Correct (${q.selected_answer})` : `Wrong – chose ${q.selected_answer}, correct: ${q.correct_answer}`}`}
      className={`w-7 h-7 rounded-md flex flex-col items-center justify-center text-[10px] font-bold border relative ${
        correct
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
      }`}
    >
      <span>{q.question_no}</span>
      {correct ? <Check className="w-2.5 h-2.5 absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5" /> : <X className="w-2.5 h-2.5 absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5" />}
    </div>
  );
};

export default function ScoreCard({ student, jobId, onOverride }) {
  const [expanded, setExpanded] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const handleGeneratePdf = async (e) => {
    e.stopPropagation();
    setLoadingPdf(true);
    try {
      const resp = await generateStudentPDF(jobId, student.student_id);
      // We update the local state via the parent if needed, 
      // but here we can just update the student object since it's passed by ref in many React patterns 
      // or just wait for the user to refresh. Better: use a toast.
      student.annotated_pdf_path = resp.annotated_pdf_url.startsWith('/') 
        ? resp.annotated_pdf_url.substring(1) 
        : resp.annotated_pdf_url;
      toast.success('File PDF đã được tạo!');
    } catch (err) {
      toast.error('Không thể tạo file PDF');
    } finally {
      setLoadingPdf(false);
    }
  };
  const pct = student.max_score > 0 ? (student.total_score / student.max_score) * 100 : 0;
  const grade =
    pct >= 90 ? { label: 'Excellent', color: 'text-emerald-400' } :
    pct >= 75 ? { label: 'Good',      color: 'text-brand-400' } :
    pct >= 60 ? { label: 'Pass',      color: 'text-amber-400' } :
                { label: 'Fail',      color: 'text-rose-400' };

  const correctCount = student.results.filter(q => q.score > 0).length;
  const totalCount = student.results.length;

  return (
    <div className="glass rounded-xl overflow-hidden animate-slide-up">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Student name crop or fallback icon */}
        {student.name_crop_image_path ? (
          <div className="h-12 max-w-[220px] rounded-lg overflow-hidden border border-white/10 bg-white flex-shrink-0">
            <img
              src={`http://localhost:8001/${student.name_crop_image_path.replace(/\\\\/g, '/')}`}
              alt={student.student_id}
              className="h-full w-auto object-contain"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-brand-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-slate-400 text-xs font-mono">{student.student_id}</span>
            {student.flagged_count > 0 && (
              <span className="badge badge-review text-xs">
                <AlertTriangle className="w-2.5 h-2.5" />
                {student.flagged_count}
              </span>
            )}
          </div>
          <ScoreBar score={student.total_score} max={student.max_score} />
        </div>

        <div className="text-right flex-shrink-0 mr-2 flex flex-col items-end gap-2">
          <div className="flex flex-col items-end">
            <span className={`text-sm font-bold ${grade.color}`}>{grade.label}</span>
            <span className="text-[10px] text-slate-500 font-medium">Đúng: {correctCount}/{totalCount} câu</span>
          </div>
          
          <div className="flex flex-col gap-1.5 items-end">
            <button
              onClick={handleGeneratePdf}
              disabled={loadingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-700 border border-white/10 text-[10px] text-slate-300 hover:bg-navy-600 hover:text-white transition-all font-semibold"
            >
              {loadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {student.annotated_pdf_path ? 'Cập nhật PDF' : 'Tạo file PDF'}
            </button>

            {student.annotated_pdf_path && !loadingPdf && (
              <a
                href={`http://localhost:8001/${student.annotated_pdf_path.replace(/\\\\/g, '/')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/20 border border-brand-500/40 text-[10px] text-brand-300 hover:bg-brand-500/30 hover:border-brand-500/60 transition-all font-bold uppercase tracking-wider"
                onClick={(e) => e.stopPropagation()}
              >
                <FileText className="w-3.5 h-3.5" />
                Tải PDF
              </a>
            )}
          </div>
        </div>

        <div className="text-slate-500 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/5 px-5 py-4 animate-fade-in">
          {/* Question grid */}
          <div className="mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Questions</p>
            <div className="flex flex-wrap gap-1.5">
              {student.results.map(q => <QuestionDot key={q.question_no} q={q} />)}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30 inline-block" /> Correct</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/30 inline-block" /> Wrong</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30 inline-block" /> Flagged</span>
            </div>
          </div>

          {/* Detail table */}
          <div className="rounded-xl overflow-hidden border border-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-800/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Q#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Selected</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Correct</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Result</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {student.results.map(q => {
                  const isCorrect = q.score > 0;
                  const isReview = q.status === 'needs_review';
                  const hasOverride = !!q.teacher_override;
                  return (
                    <tr key={q.question_no} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2 text-slate-300 font-mono">{q.question_no}</td>
                      <td className="px-4 py-2">
                        <span className={`font-semibold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {q.selected_answer || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-300 font-semibold">{q.correct_answer}</td>
                      <td className="px-4 py-2">
                        {isReview && !hasOverride ? (
                          <span className="flex items-center gap-1 text-amber-400 text-xs">
                            <AlertTriangle className="w-3 h-3" /> Review
                          </span>
                        ) : isCorrect ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs">
                            <CheckCircle className="w-3 h-3" />
                            {hasOverride ? 'Override ✓' : 'Correct'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-400 text-xs">
                            <XCircle className="w-3 h-3" />
                            {hasOverride ? 'Override ✗' : 'Wrong'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-500 text-xs">
                        {Math.round((q.ai_confidence || 0) * 100)}%
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            title="Force Correct"
                            onClick={(e) => { e.stopPropagation(); onOverride?.(student.student_id, q.question_no, 'correct'); }}
                            className={`px-2 py-1 rounded text-xs transition-colors ${q.teacher_override === 'correct' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'}`}
                          >
                            ✓ Correct
                          </button>
                          <button
                            title="Force Wrong"
                            onClick={(e) => { e.stopPropagation(); onOverride?.(student.student_id, q.question_no, 'wrong'); }}
                            className={`px-2 py-1 rounded text-xs transition-colors ${q.teacher_override === 'wrong' ? 'bg-rose-500 text-white' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'}`}
                          >
                            ✗ Wrong
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
