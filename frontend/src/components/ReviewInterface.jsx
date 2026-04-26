import { useState } from 'react';
import { CheckCircle, XCircle, SkipForward, ZoomIn, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';

const REASON_LABELS = {
  multiple_marks_detected: 'Multiple marks',
  crossed_out_answer: 'Crossed-out answer',
  double_circled_option: 'Double-circled',
  low_confidence: 'Low AI confidence',
  unclear_mark: 'Unclear mark',
  no_answer_detected: 'No answer',
  none: 'Flagged',
};

const OPTION_COLORS = {
  A: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  B: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  C: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  D: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
};

function OptionBadge({ option }) {
  if (!option) return <span className="text-slate-500 italic text-sm">None detected</span>;
  const cls = OPTION_COLORS[option] || 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border font-bold text-lg ${cls}`}>
      {option}
    </span>
  );
}

export default function ReviewInterface({ items, onDecision, isSubmitting }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [imageZoomed, setImageZoomed] = useState(false);

  const pendingItems = items.filter(i => !i.teacher_override);
  const reviewedItems = items.filter(i => i.teacher_override);

  if (pendingItems.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center animate-fade-in">
        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">All Reviewed!</h3>
        <p className="text-slate-400">
          {reviewedItems.length} questions reviewed. Return to dashboard to export results.
        </p>
      </div>
    );
  }

  const item = pendingItems[Math.min(currentIdx, pendingItems.length - 1)];
  const progress = Math.round((reviewedItems.length / items.length) * 100);

  const handleDecision = async (decision) => {
    await onDecision(item.student_id, item.question_no, decision);
    if (currentIdx >= pendingItems.length - 1) {
      setCurrentIdx(Math.max(0, pendingItems.length - 2));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress */}
      <div className="glass rounded-xl p-4">
        <div className="flex justify-between text-sm text-slate-300 mb-2">
          <span className="font-medium">Review Progress</span>
          <span className="text-brand-400">{reviewedItems.length} / {items.length} reviewed</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">{item.student_id}</p>
            <h3 className="text-white font-semibold text-lg">Question {item.question_no}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-review">
              <AlertTriangle className="w-3 h-3" />
              {REASON_LABELS[item.reason] || 'Flagged'}
            </span>
            <span className="text-xs text-slate-500">
              AI confidence: {Math.round((item.ai_confidence || 0) * 100)}%
            </span>
          </div>
        </div>

        {/* Split view */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          {/* Left: Student answer image */}
          <div className="p-6">
            {item.name_crop_image_url && (
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">
                  Student Details
                </p>
                <div className="relative group">
                  <img
                    src={`http://localhost:8001${item.name_crop_image_url}`}
                    alt="Student Name Crop"
                    className="w-full max-h-32 object-contain rounded-xl border border-white/10 bg-white/5"
                  />
                </div>
              </div>
            )}
            
            <p className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">
              Student's Answer (Q{item.question_no})
            </p>
            {item.crop_image_url ? (
              <div className="relative group">
                <img
                  src={`http://localhost:8001${item.crop_image_url}`}
                  alt={`Q${item.question_no} student answer`}
                  className={`rounded-xl border border-white/10 transition-all cursor-zoom-in ${
                    imageZoomed ? 'w-full' : 'w-full max-h-48 object-contain bg-white/5'
                  }`}
                  onClick={() => setImageZoomed(z => !z)}
                />
                <button
                  onClick={() => setImageZoomed(z => !z)}
                  className="absolute top-2 right-2 w-7 h-7 bg-navy-800/80 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            ) : (
              <div className="w-full h-48 rounded-xl bg-navy-700/50 border border-white/5 flex items-center justify-center">
                <p className="text-slate-500 text-sm">No crop image available</p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-slate-400">AI detected:</span>
              <OptionBadge option={item.selected_answer} />
            </div>
          </div>

          {/* Right: Correct answer */}
          <div className="p-6">
            <p className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">
              Answer Key
            </p>
            <div className="flex flex-col gap-4">
              {['A', 'B', 'C', 'D'].map(opt => (
                <div
                  key={opt}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    opt === item.correct_answer
                      ? 'bg-emerald-500/15 border-emerald-500/40'
                      : 'bg-navy-700/30 border-white/5'
                  }`}
                >
                  <OptionBadge option={opt} />
                  <span className={`text-sm font-medium ${opt === item.correct_answer ? 'text-emerald-300' : 'text-slate-400'}`}>
                    Option {opt}
                    {opt === item.correct_answer && (
                      <span className="ml-2 text-xs text-emerald-400/70">✓ Correct answer</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-4">
          <button
            onClick={() => setCurrentIdx(i => Math.min(pendingItems.length - 1, i + 1))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-700 border border-navy-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all text-sm font-medium"
          >
            <SkipForward className="w-4 h-4" />
            Skip
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDecision('wrong')}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25 hover:border-rose-500/60 transition-all font-semibold disabled:opacity-50 glow-rose"
            >
              <ThumbsDown className="w-4 h-4" />
              Mark Wrong
            </button>
            <button
              onClick={() => handleDecision('correct')}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/60 transition-all font-semibold disabled:opacity-50 glow-emerald"
            >
              <ThumbsUp className="w-4 h-4" />
              Mark Correct
            </button>
          </div>
        </div>
      </div>

      {/* Reviewed list */}
      {reviewedItems.length > 0 && (
        <div className="glass rounded-xl p-4">
          <p className="text-sm font-medium text-slate-400 mb-3">Recently Reviewed</p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {reviewedItems.slice().reverse().map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-300">{item.student_id} · Q{item.question_no}</span>
                {item.teacher_override === 'correct' ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                    <CheckCircle className="w-3 h-3" /> Correct
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-400 text-xs font-medium">
                    <XCircle className="w-3 h-3" /> Wrong
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
