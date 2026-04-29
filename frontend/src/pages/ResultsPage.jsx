import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, BarChart2, Loader, Users } from 'lucide-react';
import ScoreCard from '../components/ScoreCard';
import { fetchJob, exportCSV } from '../api';
import toast from 'react-hot-toast';

function StatBox({ label, value, sub, color }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ResultsPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJob(jobId)
      .then(setJob)
      .catch(() => toast.error('Failed to load results'))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <Loader className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <p className="text-slate-400">Job not found.</p>
      </div>
    );
  }

  const totalStudents = job.students?.length || 0;
  const avgScore = totalStudents > 0
    ? (job.students.reduce((a, s) => a + s.total_score, 0) / totalStudents).toFixed(1)
    : 0;
  const maxScore = job.students?.[0]?.max_score || 0;
  const avgPct = maxScore > 0 ? ((avgScore / maxScore) * 100).toFixed(0) : 0;
  const passCount = job.students?.filter(s => maxScore > 0 && (s.total_score / maxScore) >= 0.6).length || 0;
  const flagCount = job.students?.reduce((a, s) => a + (s.flagged_count || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-navy-900">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-emerald-500/6 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/5 bg-navy-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(job?.subject_id ? `/subject/${job.subject_id}` : '/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Về Dashboard
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-brand-400" />
            <h1 className="text-white font-semibold truncate">{job.filename}</h1>
          </div>
          <button
            onClick={() => { exportCSV(job); toast.success('CSV downloaded'); }}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox label="Students" value={totalStudents} color="text-brand-400"
            sub={<span className="flex items-center gap-1 justify-center"><Users className="w-3 h-3" /> Graded</span>} />
          <StatBox label="Avg Score" value={`${avgScore}/${maxScore}`} color="text-white"
            sub={`${avgPct}%`} />
          <StatBox label="Pass Rate" value={`${totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0}%`}
            color="text-emerald-400" sub={`${passCount}/${totalStudents} passed`} />
          <StatBox label="Flagged" value={flagCount} color={flagCount > 0 ? 'text-amber-400' : 'text-slate-400'}
            sub="manual reviews" />
        </div>

        {/* Student cards */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Student Results</h2>
          <div className="space-y-3">
            {(job.students || []).map(s => (
              <ScoreCard key={s.student_id} student={s} jobId={jobId} onOverride={async (student_id, question_no, decision) => {
                try {
                  const resp = await import('../api').then(m => m.submitOverride(jobId, { student_id, question_no, decision }));
                  setJob(prev => {
                    const next = { ...prev };
                    const student = next.students.find(st => st.student_id === student_id);
                    const q = student.results.find(qu => qu.question_no === question_no);
                    q.score = resp.new_score;
                    q.teacher_override = decision;
                    student.total_score = resp.new_total;
                    return next;
                  });
                  toast.success(`Q${question_no} marked as ${decision}`);
                } catch (err) {
                  toast.error('Failed to apply override');
                }
              }} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
