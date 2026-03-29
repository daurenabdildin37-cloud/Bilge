import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Check, 
  X, 
  Loader2, 
  ChevronRight, 
  Save, 
  Edit3, 
  Trash2,
  AlertCircle,
  Search,
  Lock,
  Unlock,
  Key,
  AlertTriangle,
  Settings,
  Eye,
  Link as LinkIcon
} from 'lucide-react';
import { 
  searchKnowledgeBase,
  deleteChunk
} from '../services/knowledgeBaseService';
import { KBChunkDraft, KBCategory, KBChunk } from '../types';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Users, Shield, User as UserIcon, Mail, Calendar as CalendarIcon, MoreVertical, UserPlus, UserMinus } from 'lucide-react';

interface AdminKBViewProps {
  kbBackground: any;
  showToast?: (msg: string) => void;
}

const AdminKBView = ({ kbBackground, showToast }: AdminKBViewProps) => {
  const { user } = useAuth();
  const isAdmin = user && (
    user.email?.toLowerCase().trim() === 'nurghaliieva1977@mail.ru' || 
    user.email?.toLowerCase().trim() === 'abdildindauren4@gmail.com' || 
    user.email?.toLowerCase().trim() === 'daurenabdildin464@gmail.com' || 
    user.email?.toLowerCase().trim() === 'abdildindauren95@gmail.com' || 
    user.uid === import.meta.env.VITE_ADMIN_UID || 
    (import.meta.env.VITE_ADMIN_UID && user.email?.toLowerCase().trim() === import.meta.env.VITE_ADMIN_UID.toLowerCase().trim()) || 
    user.role === 'admin'
  );

  const [activeTab, setActiveTab] = useState<'upload' | 'search' | 'diagnostics' | 'users'>('users');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Password protection states
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [isLoadingPassword, setIsLoadingPassword] = useState(true);
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  // Fetch password from Firestore
  useEffect(() => {
    const fetchPassword = async () => {
      try {
        const docRef = doc(db, 'settings', 'kb_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setStoredPassword(docSnap.data().password);
        }
      } catch (err) {
        console.error("Error fetching KB password:", err);
      } finally {
        setIsLoadingPassword(false);
      }
    };
    fetchPassword();
  }, []);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const handleUnlock = async () => {
    if (!storedPassword) {
      // First time setting password
      if (passwordInput.length < 4) {
        alert("Құпия сөз кемінде 4 таңбадан тұруы керек!");
        return;
      }
      setIsSettingPassword(true);
      try {
        await setDoc(doc(db, 'settings', 'kb_config'), {
          password: passwordInput,
          updatedAt: new Date()
        });
        setStoredPassword(passwordInput);
        setIsUnlocked(true);
      } catch (err) {
        alert("Құпия сөзді сақтау қатесі!");
      } finally {
        setIsSettingPassword(false);
      }
    } else {
      if (passwordInput === storedPassword) {
        setIsUnlocked(true);
      } else {
        alert("Құпия сөз қате!");
      }
    }
  };

  const handleChangePassword = async () => {
    if (newPasswordInput.length < 4) {
      alert("Жаңа құпия сөз кемінде 4 таңбадан тұруы керек!");
      return;
    }
    
    setIsSettingPassword(true);
    try {
      await setDoc(doc(db, 'settings', 'kb_config'), {
        password: newPasswordInput,
        updatedAt: new Date()
      });
      setStoredPassword(newPasswordInput);
      setIsChangingPassword(false);
      setNewPasswordInput('');
      alert("Құпия сөз сәтті өзгертілді! ✅");
    } catch (err) {
      alert("Құпия сөзді өзгерту қатесі!");
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  // Use values from kbBackground
  const { 
    status, 
    progress: uploadProgress, 
    drafts, 
    startIngestion, 
    saveDrafts, 
    setDrafts,
    autoSave,
    setAutoSave
  } = kbBackground;

  const isUploading = status === 'processing';
  const isSaving = status === 'saving';

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useState<{
    category?: KBCategory;
    subject?: string;
    grade?: string;
  }>({});
  const [searchResults, setSearchResults] = useState<KBChunk[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'basic' | 'semantic'>('basic');
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [viewingChunk, setViewingChunk] = useState<KBChunk | null>(null);
  const [isReProcessing, setIsReProcessing] = useState(false);

  useEffect(() => {
    const checkApiKey = () => {
      const key = localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('gemini_api_key') || '';
      setIsApiKeyMissing(!key);
    };
    checkApiKey();
    // Listen for storage changes in case user adds key in another tab
    window.addEventListener('storage', checkApiKey);
    // Also check periodically or on focus
    const interval = setInterval(checkApiKey, 5000);
    return () => {
      window.removeEventListener('storage', checkApiKey);
      clearInterval(interval);
    };
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">Рұқсат жоқ</h2>
        <p className="text-slate-500">Бұл бетке тек администратор кіре алады.</p>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await startIngestion(file);
      setActiveTab('upload');
    } catch (err: any) {
      setError(`Файлды өңдеу қатесі: ${err.message}`);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && !searchParams.category && !searchParams.subject) return;
    
    setIsSearching(true);
    try {
      let results;
      if (searchMode === 'semantic' && searchQuery.trim()) {
        const { semanticSearch } = await import('../services/knowledgeBaseService');
        results = await semanticSearch(searchQuery, searchParams);
      } else {
        results = await searchKnowledgeBase({
          ...searchParams,
          topic: searchQuery
        });
      }
      setSearchResults(results);
    } catch (err: any) {
      console.error(err);
      setError(`Іздеу қатесі: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteChunk = async (id: string) => {
    if (!confirm("Бұл бөлімді өшіруді растайсыз ба?")) return;
    try {
      await deleteChunk(id);
      setSearchResults(prev => prev.filter(c => c.id !== id));
      if (viewingChunk?.id === id) setViewingChunk(null);
    } catch (err: any) {
      alert(`Өшіру қатесі: ${err.message}`);
    }
  };

  const handleReProcessAll = async () => {
    if (!confirm("Барлық мәліметтерді қайта реттеуді (метадеректерді жаңартуды) растайсыз ба? Бұл AI ресурстарын қажет етеді.")) return;
    
    setIsReProcessing(true);
    setError(null);
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const { extractMetadataWithAI, updateChunkMetadata } = await import('../services/knowledgeBaseService');
      
      const snapshot = await getDocs(collection(db, 'knowledge_base'));
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KBChunk));
      
      let count = 0;
      const BATCH_SIZE = 2; // Process 2 chunks at once
      
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        if (isReProcessing === false) break;
        
        const batch = docs.slice(i, i + BATCH_SIZE);
        console.log(`Re-processing batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
        
        await Promise.all(batch.map(async (chunk) => {
          try {
            const newMeta = await extractMetadataWithAI(chunk.content.substring(0, 10000), chunk.sourceFile || chunk.title);
            await updateChunkMetadata(chunk.id!, newMeta);
            count++;
          } catch (e) {
            console.error(`Failed to re-process chunk ${chunk.id}:`, e);
          }
        }));

        // Small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < docs.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      alert(`Сәтті аяқталды! ${count} бөлім жаңартылды. ✅`);
      handleSearch(); // Refresh results
    } catch (err: any) {
      console.error(err);
      setError(`Қайта реттеу қатесі: ${err.message}`);
    } finally {
      setIsReProcessing(false);
    }
  };

  const handleSaveAll = async () => {
    if (drafts.length === 0) return;
    
    try {
      const success = await saveDrafts(drafts);
      if (success) {
        alert("Барлық бөлімдер сәтті сақталды! ✅");
      }
    } catch (err: any) {
      console.error(err);
      alert(`Сақтау қатесі: ${err.message}`);
    }
  };

  const handleUpdateDraft = (index: number, updated: Partial<KBChunkDraft>) => {
    setDrafts(prev => prev.map((d, i) => i === index ? { ...d, ...updated } : d));
  };

  const removeDraft = (index: number) => {
    setDrafts(prev => prev.filter((_, i) => i !== index));
  };

  if (isLoadingPassword) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
        <p className="text-slate-500 font-medium">Қауіпсіздік тексерілуде...</p>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 card bg-white dark:bg-slate-900 shadow-2xl border-emerald-100 dark:border-emerald-900/30">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
            <Lock size={32} />
          </div>
          
          <div>
            <h2 className="text-2xl font-black">Білім базасы құлыпталған</h2>
            
            {isApiKeyMissing && (
              <div className="w-full p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-left my-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-bold mb-1">Gemini API кілті табылмады</p>
                  <p>Файлдарды өңдеу үшін API кілті қажет. Оны басты беттегі баптаулардан енгізіңіз.</p>
                </div>
              </div>
            )}

            <p className="text-slate-500 mt-2">
              {!storedPassword 
                ? "Админ ретінде бірінші рет кіріп тұрсыз. Білім базасын қорғау үшін құпия сөз орнатыңыз." 
                : "Жалғастыру үшін құпия сөзді енгізіңіз."}
            </p>
          </div>

          <div className="w-full space-y-4">
            <div className="fg">
              <label className="flabel">Құпия сөз</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  className="inp !pl-14" 
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  autoFocus
                />
              </div>
            </div>
            
            <button 
              className={`btn btn-primary w-full h-12 text-lg ${isSettingPassword ? 'opacity-50' : ''}`}
              onClick={handleUnlock}
              disabled={isSettingPassword}
            >
              {isSettingPassword ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                !storedPassword ? "Құпия сөзді орнату" : "Кіру"
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertCircle size={14} />
            <span>Бұл бөлім тек администратор үшін қолжетімді</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 border-2 border-emerald-100 shadow-sm">
          <Shield size={32} />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-slate-900">Админ панелі</h1>
            <button 
              onClick={() => setAutoSave(!autoSave)}
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${autoSave ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200'}`}
            >
              Авто-сақтау
            </button>
          </div>
          <p className="text-slate-500">Білім базасы мен пайдаланушыларды басқару</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <button 
            className="btn btn-ghost btn-sm text-emerald-600 h-10 px-4 rounded-xl border-emerald-100 hover:bg-emerald-50"
            onClick={() => setIsChangingPassword(true)}
          >
            <Key size={16} className="mr-2" />
            Құпия сөзді өзгерту
          </button>

          <div className="flex items-center gap-3">
            {drafts.length > 0 && (
              <button 
                className="btn btn-primary h-10"
                onClick={handleSaveAll}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                {isSaving ? 'Сақталуда...' : `Сақтау (${drafts.length})`}
              </button>
            )}
            
            <label className="btn btn-ghost h-10 border-slate-200 cursor-pointer flex items-center px-4 rounded-xl">
              <Upload className="mr-2" size={18} />
              Файл жүктеу
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.txt" />
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button 
          className={`pill ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} className="mr-2 inline-block" />
          Пайдаланушылар
        </button>
        <button 
          className={`pill ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <Upload size={16} className="mr-2 inline-block" />
          Жүктеу және Өңдеу
        </button>
        <button 
          className={`pill ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <Search size={16} className="mr-2 inline-block" />
          Іздеу
        </button>
        <button 
          className={`pill ${activeTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          <Settings size={16} className="mr-2 inline-block" />
          Диагностика
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {isUploading && (
        <div className="card overflow-hidden bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30">
          <div className="p-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 relative">
                <Loader2 className="animate-spin text-emerald-600" size={32} />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                  <Upload className="text-emerald-600" size={12} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-end mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Жүйе өңдеуде</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                      {uploadProgress.stage}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-emerald-600 tabular-nums">
                      {uploadProgress.percent}<span className="text-sm ml-0.5">%</span>
                    </div>
                  </div>
                </div>
                <div className="relative w-full bg-emerald-100 dark:bg-emerald-900/40 rounded-full h-4 overflow-hidden p-1">
                  <div 
                    className="bg-emerald-600 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)] relative" 
                    style={{ width: `${uploadProgress.percent}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
                <div className="mt-3 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Басталды</span>
                  <span>Аяқталуда</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isChangingPassword && (
        <div className="modal-ov show">
          <div className="modal-box">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Құпия сөзді өзгерту</h3>
              <button onClick={() => setIsChangingPassword(false)}><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Білім базасын қорғау үшін жаңа құпия сөзді енгізіңіз.
            </p>
            <div className="fg mb-6">
              <label className="flabel">Жаңа құпия сөз</label>
              <input 
                type="password" 
                className="inp" 
                placeholder="••••••••" 
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button 
                className="btn btn-ghost flex-1" 
                onClick={() => setIsChangingPassword(false)}
              >
                Болдырмау
              </button>
              <button 
                className={`btn btn-primary flex-1 ${isSettingPassword ? 'opacity-50' : ''}`} 
                onClick={handleChangePassword}
                disabled={isSettingPassword}
              >
                {isSettingPassword ? <Loader2 className="animate-spin" /> : 'Сақтау'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'upload' ? (
        <>
          {drafts.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20} className="text-emerald-600" />
                Өңделудегі бөлімдер
              </h2>
              
              <div className="grid grid-cols-1 gap-8">
                {drafts.map((draft, idx) => (
                  <div key={idx} className="card border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-2xl transition-all duration-300 group">
                    <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 font-black text-xs border border-slate-100 dark:border-slate-700">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Бөлім тақырыбы</div>
                          <input 
                            className="bg-transparent font-black border-none focus:ring-0 p-0 text-base w-full placeholder:text-slate-300 text-slate-900 dark:text-white"
                            value={draft.title}
                            placeholder="Тақырыпты енгізіңіз..."
                            onChange={(e) => handleUpdateDraft(idx, { title: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button 
                          className="w-10 h-10 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-slate-300 hover:text-red-500 transition-all"
                          onClick={() => removeDraft(idx)}
                          title="Бөлімді өшіру"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-0 grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white dark:bg-slate-900">
                      <div className="lg:col-span-8 p-6 border-r border-slate-50 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Мазмұны</label>
                          </div>
                          <div className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[10px] text-slate-400 font-mono font-bold">
                            {draft.content.split(/\s+/).length} сөз
                          </div>
                        </div>
                        <div className="relative group/text">
                          <textarea 
                            className="w-full h-80 p-5 text-sm bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none resize-none font-sans leading-relaxed shadow-inner transition-all"
                            value={draft.content}
                            onChange={(e) => handleUpdateDraft(idx, { content: e.target.value })}
                            placeholder="Мазмұнды осы жерге енгізіңіз..."
                          />
                        </div>
                      </div>
                      
                      <div className="lg:col-span-4 p-6 bg-slate-50/30 dark:bg-slate-900/10 space-y-6">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Settings size={12} />
                            Метадеректер
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Категория</label>
                              <select 
                                className="w-full p-2.5 text-xs rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                value={draft.category}
                                onChange={(e) => handleUpdateDraft(idx, { category: e.target.value as KBCategory })}
                              >
                                <option value="standard">Стандарт</option>
                                <option value="book">Оқулық</option>
                                <option value="curriculum">Бағдарлама</option>
                                <option value="lesson_plan">ҚМЖ</option>
                                <option value="method">Әдістеме</option>
                                <option value="assessment">Бағалау</option>
                              </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Пән</label>
                                <input 
                                  className="w-full p-2.5 text-xs rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium shadow-sm"
                                  placeholder="Пән"
                                  value={draft.subject || ''}
                                  onChange={(e) => handleUpdateDraft(idx, { subject: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Сынып</label>
                                <input 
                                  className="w-full p-2.5 text-xs rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium shadow-sm"
                                  placeholder="Сынып"
                                  value={draft.grade || ''}
                                  onChange={(e) => handleUpdateDraft(idx, { grade: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Тақырып</label>
                              <input 
                                className="w-full p-2.5 text-xs rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium shadow-sm"
                                placeholder="Тақырып атауы..."
                                value={draft.topic || ''}
                                onChange={(e) => handleUpdateDraft(idx, { topic: e.target.value })}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Тегтер</label>
                              <input 
                                className="w-full p-2.5 text-xs rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none font-medium shadow-sm"
                                placeholder="тег1, тег2..."
                                value={draft.tags?.join(', ') || ''}
                                onChange={(e) => handleUpdateDraft(idx, { tags: e.target.value.split(',').map(s => s.trim()) })}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20">
                          <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <FileText size={10} />
                            Дереккөз файл
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-50 dark:border-emerald-900/20 shadow-inner">
                            {draft.sourceFile}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
              <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
                <Upload className="text-slate-400" size={32} />
              </div>
              <h3 className="text-lg font-bold mb-1">Файлдарды осы жерге жүктеңіз</h3>
              <p className="text-slate-500 text-sm max-w-xs text-center mb-6">
                PDF, DOCX, XLSX немесе TXT файлдарын таңдаңыз. Сканерленген PDF файлдары AI OCR көмегімен автоматты түрде танылады.
              </p>
              <label className="btn btn-primary cursor-pointer">
                Файл таңдау
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.txt,.xlsx,.xls,.csv" />
              </label>
            </div>
          )}
        </>
      ) : activeTab === 'search' ? (
        <div className="space-y-6">
          <div className="card card-pad border-slate-200 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  className="inp !pl-14" 
                  placeholder={searchMode === 'semantic' ? "Сұрақ қойыңыз (мысалы: 7-сыныпқа арналған теңдеулер туралы не бар?)" : "Тақырып немесе мазмұн бойынша іздеу..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Loader2 className="animate-spin" size={18} /> : 'Іздеу'}
              </button>
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex gap-3 flex-wrap">
                <select 
                  className="p-2 text-xs rounded-lg border border-slate-200 bg-white"
                  value={searchParams.category || ''}
                  onChange={(e) => setSearchParams({ ...searchParams, category: e.target.value as KBCategory || undefined })}
                >
                  <option value="">Барлық категориялар</option>
                  <option value="standard">Стандарт</option>
                  <option value="book">Оқулық</option>
                  <option value="curriculum">Бағдарлама</option>
                  <option value="lesson_plan">ҚМЖ</option>
                  <option value="method">Әдістеме</option>
                  <option value="assessment">Бағалау</option>
                </select>

                <input 
                  className="p-2 text-xs rounded-lg border border-slate-200 w-32"
                  placeholder="Пән"
                  value={searchParams.subject || ''}
                  onChange={(e) => setSearchParams({ ...searchParams, subject: e.target.value })}
                />

                <input 
                  className="p-2 text-xs rounded-lg border border-slate-200 w-20"
                  placeholder="Сынып"
                  value={searchParams.grade || ''}
                  onChange={(e) => setSearchParams({ ...searchParams, grade: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button 
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${searchMode === 'basic' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
                  onClick={() => setSearchMode('basic')}
                >
                  Қарапайым
                </button>
                <button 
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${searchMode === 'semantic' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
                  onClick={() => setSearchMode('semantic')}
                >
                  AI-Іздеу (Semantic)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {searchResults.map((chunk) => (
              <div key={chunk.id} className="group relative bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 hover:shadow-xl hover:border-emerald-200 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setViewingChunk(chunk)}>
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-width-0">
                      <h3 className="font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors truncate pr-4">{chunk.title}</h3>
                      <div className="flex gap-2 mt-1.5">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-blue-100/50">{chunk.category}</span>
                        {chunk.subject && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-purple-100/50">{chunk.subject}</span>}
                        {chunk.grade && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-emerald-100/50">{chunk.grade}-сынып</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-all"
                      onClick={() => setViewingChunk(chunk)}
                      title="Ашып көру"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                      onClick={() => handleDeleteChunk(chunk.id!)}
                      title="Өшіру"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="relative group/preview cursor-pointer" onClick={() => setViewingChunk(chunk)}>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 italic leading-relaxed">
                    {chunk.content}
                  </p>
                  <div className="absolute inset-0 bg-emerald-600/0 group-hover/preview:bg-emerald-600/5 transition-all rounded-2xl flex items-center justify-center opacity-0 group-hover/preview:opacity-100">
                    <span className="bg-white px-4 py-2 rounded-full shadow-lg text-[10px] font-black uppercase tracking-widest text-emerald-600">Толығырақ көру</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex gap-2 flex-wrap">
                    {chunk.tags?.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">#{tag}</span>
                    ))}
                    {chunk.tags && chunk.tags.length > 3 && <span className="text-[9px] font-bold text-slate-300">+{chunk.tags.length - 3}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
                    <LinkIcon size={10} />
                    <span className="truncate max-w-[150px]">{chunk.sourceFile}</span>
                  </div>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && !isSearching && (
              <div className="text-center py-20 text-slate-400">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p>Нәтижелер жоқ. Іздеу сұранысын енгізіңіз.</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'diagnostics' ? (
        <DiagnosticPanel onReProcess={handleReProcessAll} isReProcessing={isReProcessing} />
      ) : (
        <UsersPanel showToast={showToast} />
      )}

      {viewingChunk && (
        <div className="modal-ov show" onClick={() => setViewingChunk(null)}>
          <div className="modal-box max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-[2.5rem] shadow-2xl border-none" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="relative p-10 pb-8 bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shadow-inner">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-3">{viewingChunk.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-100">{viewingChunk.category}</span>
                      {viewingChunk.subject && <span className="px-3 py-1 bg-purple-50 text-purple-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-purple-100">{viewingChunk.subject}</span>}
                      {viewingChunk.grade && <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100">{viewingChunk.grade}-сынып</span>}
                    </div>
                  </div>
                </div>
                <button 
                  className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-all text-slate-400 hover:text-slate-600"
                  onClick={() => setViewingChunk(null)}
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 h-full">
                {/* Content Area */}
                <div className="lg:col-span-8 p-10 lg:border-r border-slate-50 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Мазмұны</h4>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap font-sans leading-relaxed text-slate-700 dark:text-slate-300 text-lg">
                      {viewingChunk.content}
                    </div>
                  </div>
                </div>
                
                {/* Sidebar Area */}
                <div className="lg:col-span-4 p-10 bg-slate-50/30 dark:bg-slate-900/10 space-y-10">
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <Settings size={14} />
                      Метадеректер
                    </h4>
                    <div className="space-y-4">
                      <div className="group p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Тақырып</div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug">{viewingChunk.topic || '—'}</div>
                      </div>
                      <div className="group p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Дереккөз файл</div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all leading-relaxed">{viewingChunk.sourceFile || '—'}</div>
                      </div>
                      <div className="group p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Бөлім реті</div>
                        <div className="flex items-end gap-1">
                          <span className="text-2xl font-black text-emerald-600">{viewingChunk.chunkIndex + 1}</span>
                          <span className="text-slate-400 font-bold mb-1">/ {viewingChunk.totalChunks}</span>
                        </div>
                      </div>
                    </div>
                  </section>
                  
                  <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <Shield size={14} />
                      Тегтер
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingChunk.tags?.map((tag, i) => (
                        <span key={i} className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700 rounded-2xl text-[11px] font-bold shadow-sm transition-all hover:border-emerald-200 hover:text-emerald-600">
                          #{tag}
                        </span>
                      )) || <span className="text-slate-400 italic text-sm">Тегтер жоқ</span>}
                    </div>
                  </section>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-10 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
              <button 
                className="flex items-center gap-2 text-red-500 hover:text-red-600 font-black text-sm uppercase tracking-widest transition-all group"
                onClick={() => handleDeleteChunk(viewingChunk.id!)}
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-all">
                  <Trash2 size={18} />
                </div>
                Бөлімді өшіру
              </button>
              <button 
                className="btn btn-primary px-16 h-14 rounded-[1.25rem] text-lg font-black shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => setViewingChunk(null)}
              >
                Жабу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const UsersPanel = ({ showToast }: { showToast?: (msg: string) => void }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      if (showToast) showToast("Пайдаланушыларды жүктеу қатесі: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (userId: string, currentRole: string) => {
    setUpdatingId(userId);
    try {
      const newRole = currentRole === 'admin' ? 'teacher' : 'admin';
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (showToast) showToast(`Рөл сәтті өзгертілді: ${newRole === 'admin' ? 'Админ' : 'Мұғалім'}`);
    } catch (err: any) {
      if (showToast) showToast("Рөлді өзгерту қатесі: " + err.message);
      else alert("Рөлді өзгерту қатесі: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'teacher'>('all');

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin mx-auto text-emerald-600 mb-4" size={32} />
        <p className="text-slate-500">Пайдаланушылар тізімі жүктелуде...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black flex items-center gap-2">
            <Users className="text-emerald-600" size={24} />
            Пайдаланушылар
          </h3>
          <p className="text-sm text-slate-500">Жүйедегі барлық мұғалімдер мен әкімшілер тізімі</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Іздеу..." 
              className="inp !pl-14 w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="inp !py-0 h-10 w-40"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
          >
            <option value="all">Барлық рөлдер</option>
            <option value="admin">Админдер</option>
            <option value="teacher">Мұғалімдер</option>
          </select>
          <button className="btn btn-ghost btn-sm h-10" onClick={fetchUsers}>
            <Loader2 className={`mr-2 ${loading ? 'animate-spin' : ''}`} size={16} />
            Жаңарту
          </button>
        </div>
      </div>

      <div className="card overflow-hidden border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Пайдаланушы</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Рөлі</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Тіркелген күні</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Әрекеттер</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <UserIcon size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{u.displayName}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${u.role === 'admin' ? 'b-emerald' : 'b-blue'} uppercase font-black text-[10px]`}>
                      {u.role === 'admin' ? <Shield size={10} className="mr-1" /> : <UserIcon size={10} className="mr-1" />}
                      {u.role === 'admin' ? 'Admin' : 'Мұғалім'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                    {u.updatedAt?.toDate ? u.updatedAt.toDate().toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => toggleAdmin(u.id, u.role)}
                      disabled={updatingId === u.id}
                      className={`btn btn-sm ${u.role === 'admin' ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100'}`}
                    >
                      {updatingId === u.id ? <Loader2 className="animate-spin" size={14} /> : (u.role === 'admin' ? <UserMinus size={14} className="mr-1" /> : <UserPlus size={14} className="mr-1" />)}
                      {u.role === 'admin' ? 'Админді алу' : 'Админ қылу'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-20 bg-slate-50/50">
            <UserIcon size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-slate-500">Пайдаланушылар табылмады.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminKBView;

const DiagnosticPanel = ({ onReProcess, isReProcessing }: { onReProcess: () => void, isReProcessing: boolean }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<'ok' | 'missing' | 'invalid'>('missing');

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Check API Key
      const key = localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('gemini_api_key') || '';
      if (!key) {
        setApiKeyStatus('missing');
      } else {
        setApiKeyStatus('ok');
      }

      // 2. Check Firestore Connection & Stats
      const { collection, getDocs, query, limit, getCountFromServer } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const collRef = collection(db, 'knowledge_base');
      const snapshot = await getCountFromServer(collRef);
      const count = snapshot.data().count;

      // 3. Get category breakdown
      const categories: Record<string, number> = {};
      const recentDocs = await getDocs(query(collRef, limit(100)));
      recentDocs.forEach(doc => {
        const cat = doc.data().category || 'unknown';
        categories[cat] = (categories[cat] || 0) + 1;
      });

      setStats({
        totalChunks: count,
        categories,
        lastUpdated: new Date().toLocaleString(),
        firestoreStatus: 'connected'
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setStats({ firestoreStatus: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card card-pad border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FileText size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Жалпы көлем</h4>
              <p className="text-2xl font-black text-slate-900">{stats?.totalChunks || 0} бөлім</p>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-600 h-full w-full opacity-20"></div>
          </div>
        </div>

        <div className="card card-pad border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Key size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">API Статусы</h4>
              <p className={`text-2xl font-black ${apiKeyStatus === 'ok' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {apiKeyStatus === 'ok' ? 'Белсенді' : 'Кілт жоқ'}
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className={`h-full w-full ${apiKeyStatus === 'ok' ? 'bg-emerald-600 opacity-20' : 'bg-amber-600 opacity-20'}`}></div>
          </div>
        </div>

        <div className="card card-pad border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Базаны реттеу</h4>
              <button 
                className={`btn btn-sm mt-1 ${isReProcessing ? 'bg-slate-100 text-slate-400' : 'btn-primary'}`}
                onClick={onReProcess}
                disabled={isReProcessing}
              >
                {isReProcessing ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                {isReProcessing ? 'Реттелуде...' : 'Қайта реттеу'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad border-slate-200 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-lg flex items-center gap-2">
            <Search className="text-emerald-600" size={20} />
            Категориялар бойынша бөлініс
          </h3>
          <button className="btn btn-ghost btn-sm text-slate-500" onClick={runDiagnostics}>
            <Loader2 className={`mr-2 ${loading ? 'animate-spin' : ''}`} size={16} />
            Жаңарту
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="animate-spin mx-auto text-emerald-600 mb-4" size={32} />
            <p className="text-slate-500">Мәліметтер жиналуда...</p>
          </div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">
            <AlertCircle className="mx-auto mb-4" size={32} />
            <p>{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats?.categories || {}).map(([cat, count]) => (
              <div key={cat} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat}</div>
                <div className="text-xl font-black text-slate-900">{count as number}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-6">
        <h3 className="text-indigo-900 font-bold mb-2 flex items-center gap-2">
          <Key size={18} />
          Кеңес
        </h3>
        <p className="text-indigo-700 text-sm leading-relaxed">
          Егер "Missing or insufficient permissions" қатесі шықса, бұл Firestore ережелерінің (Security Rules) администратор рұқсатын танымағанын білдіреді. 
          Жүйеге <b>{localStorage.getItem('user_email') || 'администратор'}</b> поштасымен кіргеніңізге көз жеткізіңіз.
        </p>
      </div>
    </div>
  );
};
