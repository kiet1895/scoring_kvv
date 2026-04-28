import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, AlertTriangle, XCircle, ChevronRight, Download, Trash2, BarChart2, Eye, RotateCcw } from 'lucide-react';
import { deleteJob, exportCSV, fetchJob, retryJob } from '../api';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     cls: 'badge-pending',    Icon: Clock },
  processing:  { label: 'Processing',  cls: 'badge-processing', Icon: Clock },
  completed:   { label: 'Completed',   cls: 'badge-completed',  Icon: CheckCircle },
  needs_review:{ label: 'Needs Review',cls: 'badge-review',     Icon: AlertTriangle },
  failed:      { label: 'Failed',      cls: 'badge-failed',     Icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`badge ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function JobRow({ job, onDeleted }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const pct = job.total_students > 0
    ? Math.round((job.completed_students / job.total_students) * 100)
    : job.progress;

  const avgPct = job.total_students > 0 && job.avg_score !== undefined
    ? ((job.avg_score / 1) * 100).toFixed(0)  // adjust if max varies
    : null;

  const handleDelete = async () => {
    if (!window.confirm('Delete this grading job?')) return;
    setDeleting(true);
    try {
      await deleteJob(job.job_id);
      toast.success('Job deleted');
      onDeleted?.(job.job_id);
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const full = await fetchJob(job.job_id);
      exportCSV(full);
      toast.success('CSV exported');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const handleRetry = async () => {
    try {
      await retryJob(job.job_id);
      toast.success('Retrying failed students...');
    } catch { toast.error('Failed to start retry'); }
  };

  return (
    <div className="glass glass-hover rounded-xl p-4 animate-slide-up">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-navy-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-5 h-5 text-brand-400" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-white font-semibold truncate">{job.filename}</h3>
            <StatusBadge status={job.status} />
            {job.flagged_count > 0 && (
              <span className="badge badge-review">⚠ {job.flagged_count} flagged</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-400 mb-3 flex-wrap">
            <span className="flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5" />
              {job.completed_students}/{job.total_students} students
            </span>
            {job.avg_score > 0 && (
              <span className="text-emerald-400 font-medium">
                Avg: {job.avg_score.toFixed(1)} pts
              </span>
            )}
          </div>

          {/* Progress bar */}
          {(job.status === 'processing' || job.status === 'pending') && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Processing…</span><span>{pct}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {job.status === 'needs_review' && (
            <button
              onClick={() => navigate(`/review/${job.job_id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Review
            </button>
          )}
          {(job.status === 'completed' || job.status === 'needs_review' || job.status === 'failed') && (
            <>
              <button
                onClick={handleRetry}
                className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors flex items-center justify-center"
                title="Retry failed students"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate(`/results/${job.job_id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-400 text-sm font-medium hover:bg-brand-500/25 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                Results
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-8 h-8 rounded-lg bg-navy-700 border border-navy-600 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors flex items-center justify-center"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-8 h-8 rounded-lg bg-navy-700 border border-navy-600 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors flex items-center justify-center"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobDashboard({ jobs, onDeleted }) {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-navy-700 mx-auto flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-slate-400 font-medium">No grading jobs yet</p>
        <p className="text-slate-500 text-sm mt-1">Upload a PDF batch to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map(job => (
        <JobRow key={job.job_id} job={job} onDeleted={onDeleted} />
      ))}
    </div>
  );
}
