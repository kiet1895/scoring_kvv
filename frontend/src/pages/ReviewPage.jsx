import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import ReviewInterface from '../components/ReviewInterface';
import { fetchFlagged, submitOverride } from '../api';
import toast from 'react-hot-toast';

export default function ReviewPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadFlagged = async () => {
    try {
      const result = await fetchFlagged(jobId);
      setData(result);
    } catch (err) {
      toast.error('Failed to load flagged questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFlagged(); }, [jobId]);

  const handleDecision = async (studentId, questionNo, decision) => {
    setSubmitting(true);
    try {
      await submitOverride(jobId, {
        student_id: studentId,
        question_no: questionNo,
        decision,
      });
      toast.success(`Q${questionNo} marked as ${decision}`);
      // Refresh flagged list to reflect override
      await loadFlagged();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Override failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/6 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/5 bg-navy-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(data?.subject_id ? `/subject/${data.subject_id}` : '/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Về Dashboard
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h1 className="text-white font-semibold">Manual Review</h1>
          </div>
          {data && (
            <span className="badge badge-review ml-auto">
              {data.flagged_count} flagged
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="relative max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <Loader className="w-8 h-8 text-brand-400 animate-spin" />
              <p className="text-slate-400">Loading flagged questions…</p>
            </div>
          </div>
        ) : data && data.items.length > 0 ? (
          <ReviewInterface
            items={data.items}
            onDecision={handleDecision}
            isSubmitting={submitting}
          />
        ) : (
          <div className="text-center py-24">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">No Flagged Questions</h2>
            <p className="text-slate-400 mb-6">All questions were auto-graded with high confidence.</p>
            <button
              onClick={() => navigate(data?.subject_id ? `/subject/${data.subject_id}` : '/')}
              className="px-6 py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-400 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
