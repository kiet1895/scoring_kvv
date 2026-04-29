import { useState, useEffect, useCallback } from 'react';
import BatchUpload from '../components/BatchUpload';
import JobDashboard from '../components/JobDashboard';
import { fetchJobs, fetchHealth } from '../api';
import { BookOpen, Cpu, Wifi, WifiOff, RefreshCw, ChevronDown, Bot, ArrowLeft } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const { subjectId } = useParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState(null);
  const [health, setHealth] = useState(null);
  const [polling, setPolling] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
  });
  const [showModelMenu, setShowModelMenu] = useState(false);

  const models = [
    { id: 'gemini-2.5-flash', name: '2.5 Flash', desc: 'Standard (Fast)' },
    { id: 'gemini-2.0-flash', name: '2.0 Flash', desc: 'Efficiency' },
    { id: 'gemini-2.5-pro', name: '2.5 Pro', desc: 'Premium Intelligence' },
    { id: 'gemini-flash-latest', name: 'Flash Latest', desc: 'Always newest Flash' },
  ];

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs(subjectId);
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  const loadHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, []);

  const loadSubject = useCallback(async () => {
    if (!subjectId) return;
    try {
      const { data } = await axios.get(`http://localhost:8001/subjects/${subjectId}`);
      setSubject(data);
    } catch (err) {
      console.error('Failed to fetch subject', err);
    }
  }, [subjectId]);

  useEffect(() => {
    loadJobs();
    loadHealth();
    loadSubject();
  }, [loadJobs, loadHealth, loadSubject]);

  // Poll every 2s when there are active jobs
  useEffect(() => {
    let intervalId;
    const hasActive = jobs.some(j => j.status === 'processing' || j.status === 'pending');
    
    if (hasActive) {
      intervalId = setInterval(loadJobs, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobs, loadJobs]);

  const handleJobCreated = () => {
    setTimeout(loadJobs, 1000);
  };

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    localStorage.setItem('gemini_model', modelId);
    setShowModelMenu(false);
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
            <Link to="/" className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shadow-lg glow-blue hover:scale-105 transition-transform">
              {subjectId ? <ArrowLeft className="w-5 h-5 text-white" /> : <BookOpen className="w-5 h-5 text-white" />}
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gradient-blue">
                {subject ? subject.name : 'scoring_k'}
              </h1>
              <p className="text-xs text-slate-500">
                {subjectId ? 'Phòng chấm thi' : 'AI Batch Exam Grader'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Health & Model indicator */}
            {health !== null && (
              <div className="flex items-center gap-1">
                <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-l-lg border-y border-l ${
                  health.status === 'ok'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {health.status === 'ok' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {health.status === 'ok' ? (health.demo_mode ? 'Demo Mode' : 'Online') : 'Offline'}
                </div>
                
                <div className="relative">
                  <button
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-r-lg bg-navy-800 border border-white/10 text-slate-300 hover:bg-navy-700 hover:text-white transition-all"
                  >
                    <Bot className="w-3.5 h-3.5 text-brand-400" />
                    <span className="font-semibold">{models.find(m => m.id === selectedModel)?.name}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showModelMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowModelMenu(false)} />
                      <div className="absolute right-0 mt-2 w-56 rounded-xl bg-navy-800 border border-white/10 shadow-2xl z-20 py-2 animate-fade-in">
                        <div className="px-3 py-1 mb-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select AI Model</p>
                        </div>
                        {models.map(m => (
                          <button
                            key={m.id}
                            onClick={() => handleModelChange(m.id)}
                            className={`w-full px-4 py-2 text-left hover:bg-white/5 transition-colors flex flex-col ${
                              selectedModel === m.id ? 'bg-brand-500/10' : ''
                            }`}
                          >
                            <span className={`text-sm font-semibold ${selectedModel === m.id ? 'text-brand-400' : 'text-slate-200'}`}>
                              {m.name}
                            </span>
                            <span className="text-[10px] text-slate-500">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
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
            <BatchUpload 
              onJobCreated={handleJobCreated} 
              modelName={selectedModel} 
              subjectId={subjectId}
              initialAnswerKey={subject?.answer_key}
            />
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
