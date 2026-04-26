import { useState, useEffect, useCallback } from 'react';
import BatchUpload from '../components/BatchUpload';
import JobDashboard from '../components/JobDashboard';
import { fetchJobs, fetchHealth } from '../api';
import { BookOpen, Cpu, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [polling, setPolling] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadHealth();
  }, [loadJobs, loadHealth]);

  // Poll every 3s when there are active jobs
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'processing' || j.status === 'pending');
    if (hasActive && !polling) {
      setPolling(true);
      const id = setInterval(loadJobs, 3000);
      return () => { clearInterval(id); setPolling(false); };
    }
  }, [jobs, polling, loadJobs]);

  const handleJobCreated = () => {
    setTimeout(loadJobs, 1000);
  };

  const handleJobDeleted = (jobId) => {
    setJobs(prev => prev.filter(j => j.job_id !== jobId));
  };

  const hasActive = jobs.some(j => j.status === 'processing' || j.status === 'pending');

  return (
    <div className="min-h-screen bg-navy-900">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/5 bg-navy-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shadow-lg glow-blue">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient-blue">scoring_k</h1>
              <p className="text-xs text-slate-500">AI Batch Exam Grader</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Health indicator */}
            {health !== null && (
              <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
                health.status === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {health.status === 'ok' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {health.status === 'ok' ? (
                  health.demo_mode ? '🎭 Demo Mode' : '🤖 Gemini Active'
                ) : 'Backend Offline'}
              </div>
            )}

            {/* Live polling indicator */}
            {hasActive && (
              <div className="flex items-center gap-1.5 text-xs text-brand-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Live
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Cpu className="w-3.5 h-3.5" />
              {jobs.length} job{jobs.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="relative max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8 items-start">
          {/* Left: Upload panel */}
          <div className="xl:sticky xl:top-24">
            <BatchUpload onJobCreated={handleJobCreated} />
          </div>

          {/* Right: Job list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Grading Queue</h2>
              <button
                onClick={loadJobs}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton h-24 rounded-xl" />
                ))}
              </div>
            ) : (
              <JobDashboard jobs={jobs} onDeleted={handleJobDeleted} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
