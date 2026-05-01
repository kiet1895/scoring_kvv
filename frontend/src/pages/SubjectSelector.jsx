import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSubjects, createSubject, deleteSubject, extractKeyFromTemplate, updateSubject } from '../api';
import { 
  Plus, 
  Trash2, 
  BookOpen, 
  FileUp, 
  ChevronRight, 
  Loader2, 
  GraduationCap,
  Sparkles,
  Search,
  MoreVertical,
  CheckCircle2,
  X,
  Save
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubjectSelector() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSubject, setEditingSubject] = useState(null);

  const loadSubjects = async () => {
    try {
      const data = await fetchSubjects();
      setSubjects(data);
    } catch (err) {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setCreating(true);
    try {
      await createSubject({ name: newSubjectName });
      toast.success('Subject created');
      setNewSubjectName('');
      setShowAddModal(false);
      loadSubjects();
    } catch (err) {
      toast.error('Failed to create subject');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      await deleteSubject(id);
      toast.success('Subject deleted');
      loadSubjects();
    } catch (err) {
      toast.error('Failed to delete subject');
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 selection:bg-brand-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 text-brand-400 mb-2 font-medium tracking-wide uppercase text-xs">
              <Sparkles className="w-4 h-4" />
              AI Grading Workspace
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Quản lý <span className="text-gradient-blue">Môn học</span>
            </h1>
            <p className="mt-3 text-slate-400 max-w-md text-lg">
              Chọn một môn học để bắt đầu chấm điểm hoặc tạo môn học mới bằng file mẫu.
            </p>
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            Tạo môn học mới
          </button>
        </header>

        {/* Search & Stats */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Tìm kiếm môn học..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/5 focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 rounded-2xl py-3.5 pl-12 pr-4 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="flex items-center gap-4 px-4 bg-slate-900/30 rounded-2xl border border-white/5 text-sm">
            <span className="text-slate-500">Tổng cộng:</span>
            <span className="text-white font-bold">{subjects.length} môn</span>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
            <p className="text-slate-500 animate-pulse">Đang tải danh sách môn học...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="bg-slate-900/20 border border-dashed border-white/10 rounded-3xl p-20 text-center">
            <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Chưa có môn học nào</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">Hãy bắt đầu bằng cách tạo môn học đầu tiên để thực hiện chấm điểm tự động.</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="text-brand-400 font-bold hover:text-brand-300 underline-offset-4 hover:underline"
            >
              Tạo môn học ngay →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubjects.map(subject => (
              <SubjectCard 
                key={subject.subject_id} 
                subject={subject} 
                onDelete={(e) => handleDelete(subject.subject_id, e)}
                onUpdate={loadSubjects}
                onEdit={() => setEditingSubject(subject)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Answer Key Modal */}
      {editingSubject && (
        <AnswerKeyModal 
          subject={editingSubject} 
          onClose={() => setEditingSubject(null)} 
          onSave={() => {
            loadSubjects();
            setEditingSubject(null);
          }}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-black/60">
          <div className="bg-navy-900 border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 pt-8 pb-6">
              <h3 className="text-2xl font-black text-white mb-2">Môn học mới</h3>
              <p className="text-slate-400 text-sm">Nhập tên môn học. Bạn có thể trích xuất đáp án từ file mẫu sau khi tạo.</p>
              
              <form onSubmit={handleCreate} className="mt-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tên môn học</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Ví dụ: Tin học 4 - HK2"
                    className="w-full bg-slate-800/50 border border-white/10 focus:border-brand-500 rounded-xl py-3 px-4 outline-none transition-all text-white"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    disabled={creating || !newSubjectName.trim()}
                    className="flex-1 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Tạo môn học'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectCard({ subject, onDelete, onUpdate, onEdit }) {
  const [extracting, setExtracting] = useState(false);
  
  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('template_file', file);

    setExtracting(true);
    const tid = toast.loading('Đang trích xuất đáp án từ file mẫu...');
    try {
      await extractKeyFromTemplate(subject.subject_id, formData);
      toast.success('Đã trích xuất đáp án!', { id: tid });
      onUpdate();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Lỗi không xác định';
      toast.error(`Lỗi khi trích xuất đáp án: ${msg}`, { id: tid });
    } finally {
      setExtracting(false);
    }
  };

  const questionCount = Object.keys(subject.answer_key || {}).length;

  return (
    <div className="group relative bg-slate-900/40 border border-white/5 hover:border-brand-500/30 rounded-3xl p-6 transition-all hover:shadow-2xl hover:shadow-brand-500/5 hover:-translate-y-1 overflow-hidden">
      {/* Decorative accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-brand-500/10 to-transparent rounded-bl-full translate-x-8 -translate-y-8 group-hover:translate-x-4 group-hover:-translate-y-4 transition-transform" />
      
      <div className="relative flex flex-col h-full">
        <div className="flex items-start justify-between mb-6">
          <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-all duration-300">
            <BookOpen className="w-6 h-6" />
          </div>
          <button 
            onClick={onDelete}
            className="p-2 text-slate-600 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-brand-300 transition-colors">
          {subject.name}
        </h3>
        
        <div className="flex items-center gap-2 mb-8">
          <div className="px-2 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {questionCount} Câu hỏi
          </div>
          <button 
            onClick={(e) => { e.preventDefault(); onEdit(); }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
              questionCount > 0 ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400'
            }`}
          >
            {questionCount > 0 ? <><CheckCircle2 className="w-3 h-3" /> Xem đáp án</> : 'Chưa có đáp án'}
          </button>
        </div>

        <div className="mt-auto space-y-3">
          <Link 
            to={`/subject/${subject.subject_id}`}
            className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all group/btn"
          >
            Bắt đầu chấm điểm
            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </Link>

          <label className="flex items-center justify-center gap-2 w-full border border-white/5 hover:bg-white/5 text-slate-400 hover:text-white text-sm font-semibold py-3 rounded-xl cursor-pointer transition-all">
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {questionCount > 0 ? 'Cập nhật file mẫu' : 'Trích xuất từ file mẫu'}
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,image/*" 
              onChange={handleTemplateUpload}
              disabled={extracting}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function AnswerKeyModal({ subject, onClose, onSave }) {
  const [localKey, setLocalKey] = useState({ ...subject.answer_key });
  const [localName, setLocalName] = useState(subject.name);
  const [bulkCount, setBulkCount] = useState(10);
  const [newQNum, setNewQNum] = useState('');
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSubject(subject.subject_id, { 
        answer_key: localKey,
        name: localName
      });
      toast.success('Đã cập nhật môn học');
      onSave();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Lỗi không xác định';
      toast.error(`Lỗi khi lưu thông tin: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const updateVal = (q, val) => {
    setLocalKey(prev => ({ ...prev, [q]: val.toUpperCase() }));
  };

  const removeQuestion = (q) => {
    const nextKey = { ...localKey };
    delete nextKey[q];
    setLocalKey(nextKey);
  };

  const addSpecificQuestion = () => {
    if (!newQNum) return;
    setLocalKey(prev => ({ ...prev, [newQNum]: '?' }));
    setNewQNum('');
  };

  const addQuestion = () => {
    // Find first gap or next max
    const keys = Object.keys(localKey).map(k => parseInt(k)).filter(k => !isNaN(k));
    let nextQ = 1;
    if (keys.length > 0) {
      const max = Math.max(...keys);
      // Check for gaps
      for (let i = 1; i <= max; i++) {
        if (!localKey[i]) {
          nextQ = i;
          break;
        }
      }
      if (nextQ === 1 && localKey[1]) nextQ = max + 1;
    }
    setLocalKey(prev => ({ ...prev, [nextQ]: '?' }));
  };

  const addBulkQuestions = () => {
    const currentCount = Object.keys(localKey).length;
    const newKey = { ...localKey };
    for (let i = 1; i <= bulkCount; i++) {
      newKey[currentCount + i] = '?';
    }
    setLocalKey(newKey);
  };

  const sortedQs = Object.keys(localKey).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/60">
      <div className="bg-navy-900 border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-brand-500/5 to-transparent">
          <div className="flex-1 mr-4">
            <input 
              type="text" 
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              className="text-2xl font-black text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-500 focus:outline-none w-full transition-all"
              placeholder="Tên môn học..."
            />
            <p className="text-slate-400 text-sm mt-1">ID: {subject.subject_id.split('-')[0]}... • Kiểm tra và sửa đổi đáp án</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 bg-navy-950/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {sortedQs.map(q => (
              <div key={q} className="group relative bg-slate-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-2 hover:border-brand-500/30 transition-all">
                <button 
                  onClick={() => removeQuestion(q)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 shadow-lg"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Câu {q}</span>
                <input 
                  type="text" 
                  value={localKey[q]}
                  onChange={(e) => updateVal(q, e.target.value)}
                  maxLength={1}
                  className="w-10 h-10 bg-slate-800 border border-white/10 rounded-xl text-center font-bold text-white focus:border-brand-500 outline-none transition-all uppercase"
                />
              </div>
            ))}
            <button 
              onClick={addQuestion}
              className="border border-dashed border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-brand-400 hover:border-brand-400/50 transition-all hover:bg-brand-500/5"
              title="Tự động thêm câu tiếp theo hoặc câu còn thiếu"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-bold">Thêm câu</span>
            </button>

            <div className="flex flex-col gap-2 p-3 border border-dashed border-white/10 rounded-2xl bg-brand-500/5">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="#"
                  value={newQNum}
                  onChange={(e) => setNewQNum(e.target.value.replace(/\D/g, ''))}
                  className="w-10 bg-slate-800 border border-white/10 rounded-xl px-1 py-1 text-center text-sm font-bold text-white focus:border-brand-500 outline-none"
                />
                <button 
                  onClick={addSpecificQuestion}
                  className="bg-brand-500 hover:bg-brand-400 text-white p-2 rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <span className="text-[10px] font-bold text-brand-400 text-center uppercase">Chèn số</span>
            </div>

            <div className="flex flex-col gap-2 p-3 border border-dashed border-white/10 rounded-2xl bg-white/2">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-2 py-1 text-center text-sm font-bold text-white focus:border-brand-500 outline-none"
                />
                <button 
                  onClick={addBulkQuestions}
                  className="bg-brand-500 hover:bg-brand-400 text-white p-2 rounded-xl transition-all"
                  title="Thêm nhiều câu"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <span className="text-[10px] font-bold text-slate-500 text-center uppercase">Thêm nhiều</span>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-white/2 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-2xl transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand-500 hover:bg-brand-400 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Lưu thông tin</>}
          </button>
        </div>
      </div>
    </div>
  );
}
