
import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Zap, 
  ArrowRight, 
  Book, 
  Gamepad2, 
  Trophy, 
  Target, 
  TrendingUp, 
  ChevronRight, 
  Lightbulb,
  FileText,
  LogOut,
  User as UserIcon,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/error-handling';
import { User } from '../types';

interface DashboardViewProps {
  user: User | null;
  onNavigate: (tab: string, item?: any) => void;
  searchQuery: string;
  t: any;
  onLogout: () => void;
}

const DashboardView = ({ user, onNavigate, searchQuery, t, onLogout }: DashboardViewProps) => {
  const [stats, setStats] = useState({ kmzh: 0, games: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  console.log('DashboardView: Component rendering start', { uid: user?.uid, loading });
  const [showForceRender, setShowForceRender] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = React.useRef(loading);
  
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  console.log('DashboardView: Rendering with user', user?.uid, 'loading:', loading);

  useEffect(() => {
    console.log("DashboardView: useEffect triggered, user:", user?.uid);
    if (user?.uid) {
      fetchData();
      
      // Safety timeout for loading UI
      const timer = setTimeout(() => {
        if (loadingRef.current) {
          console.warn("DashboardView: Loading safety timeout reached (current loading state is true)");
          setShowForceRender(true);
          setLoading(false); 
        } else {
          console.log("DashboardView: Safety timeout reached but loading is already false");
        }
      }, 7000); // 7 seconds
      return () => clearTimeout(timer);
    } else {
      console.log("DashboardView: No user UID in useEffect, skipping fetch");
      setLoading(false);
    }
  }, [user?.uid]);

  const fetchData = async () => {
    if (!user?.uid) {
      console.log("DashboardView: No user UID, skipping fetch");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setShowForceRender(false);
    console.log("DashboardView: Fetching data for", user.uid);

    try {
      console.log("DashboardView: Starting Firestore query...");
      const q = query(
        collection(db, 'library'), 
        where('userId', '==', user.uid),
        limit(50)
      );
      
      // Add a timeout to getDocs
      const fetchPromise = getDocs(q);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
      
      console.log("DashboardView: Racing fetch against timeout...");
      const querySnapshot = (await Promise.race([fetchPromise, timeoutPromise])) as any;
      
      if (!querySnapshot || !querySnapshot.docs) {
        throw new Error('Invalid query snapshot');
      }

      console.log("DashboardView: Data fetched successfully, count:", querySnapshot.docs.length);
      
      const library = querySnapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
      
      // Check both English and Kazakh types for compatibility
      const kmzhCount = library.filter((item: any) => item.type === 'kmzh' || item.type === 'ҚМЖ').length;
      const gamesCount = library.filter((item: any) => item.type === 'game' || item.type === 'Ойын').length;
      
      console.log("DashboardView: Stats calculated:", { kmzhCount, gamesCount });
      setStats({ kmzh: kmzhCount, games: gamesCount });
      setRecent(library.slice(0, 10));
    } catch (err: any) {
      console.error("DashboardView: Failed to fetch dashboard data", err);
      setError(err.message === 'timeout' ? 'Деректерді алу уақыты аяқталды' : 'Деректерді жүктеу кезінде қате шықты');
      
      if (err.message !== 'timeout') {
        try {
          handleFirestoreError(err, OperationType.GET, 'library');
        } catch (e) {
          console.error("DashboardView: Firestore error handled", e);
        }
      }
    } finally {
      setLoading(false);
      console.log("DashboardView: Loading set to false");
    }
  };

  const filteredRecent = recent.filter(item => {
    const query = searchQuery.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const subject = (item.subject || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    return title.includes(query) || subject.includes(query) || type.includes(query);
  }).slice(0, 5);

  if (!user) return null;

  if (loading && !showForceRender) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="flex gap-1 mb-4">
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"></div>
        </div>
        <p className="text-slate-500 text-sm mb-4">Деректер жүктелуде...</p>
        <button 
          onClick={() => fetchData()}
          className="text-xs text-blue-600 underline hover:text-blue-700"
        >
          Қайта көру
        </button>
      </div>
    );
  }

  if (error && recent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <Zap size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">Қате орын алды</h2>
        <p className="text-slate-500 mb-6">{error}</p>
        <button 
          onClick={() => fetchData()}
          className="btn btn-primary"
        >
          Қайта жүктеу
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div className="hero mb-10">
        <div className="hero-tag">
          <Zap size={14} className="text-yellow-300" />
          <span translate="no">Bilge AI</span> — Сіздің интеллектуалды көмекшіңіз
        </div>
        <h1>{t.welcome}, <br /><span>{user.displayName}!</span></h1>
        <p className="max-w-2xl">Бүгін сабақ жоспарын жасауға немесе жаңа интерактивті ойындар генерациялауға дайынсыз ба? Жасанды интеллект сізге көмектеседі.</p>
        <div className="hero-btns">
          <button className="hero-btn-main" onClick={() => onNavigate('kmzh')}>
            Жұмысты бастау <ArrowRight size={18} />
          </button>
          <button className="hero-btn-sec" onClick={() => onNavigate('library')}>
            Кітапхананы көру
          </button>
        </div>
      </div>

      {/* Mobile Account Section */}
      <div className="lg:hidden w-full bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-8">
        <div className="flex items-center gap-4 mb-4">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ''} className="w-14 h-14 rounded-2xl border-2 border-emerald-100" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center border-2 border-emerald-100 text-emerald-600">
              <UserIcon size={28} />
            </div>
          )}
          <div className="overflow-hidden">
            <div className="font-bold text-slate-900 truncate">{user.displayName}</div>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={onLogout}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-bold text-slate-700"
          >
            <LogOut size={16} />
            {t.logout}
          </button>
          <button 
            onClick={onLogout}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors text-sm font-bold text-emerald-700"
          >
            <RefreshCw size={16} />
            Ауыстыру
          </button>
        </div>
      </div>

      <div className="stat-grid mb-10">
        <div className="stat-card group cursor-pointer" onClick={() => onNavigate('library')}>
          <div className="flex justify-between items-start mb-4">
            <div className="stat-icon bg-blue-50 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Book size={24} />
            </div>
            <div className="stat-change stat-up">+12%</div>
          </div>
          <div className="stat-num">{stats.kmzh}</div>
          <div className="stat-label">{t.stats.kmzh}</div>
        </div>
        
        <div className="stat-card group cursor-pointer" onClick={() => onNavigate('library')}>
          <div className="flex justify-between items-start mb-4">
            <div className="stat-icon bg-emerald-50 text-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Gamepad2 size={24} />
            </div>
            <div className="stat-change stat-up">+5%</div>
          </div>
          <div className="stat-num">{stats.games}</div>
          <div className="stat-label">{t.stats.games}</div>
        </div>

        <div className="stat-card group">
          <div className="flex justify-between items-start mb-4">
            <div className="stat-icon bg-amber-50 text-amber-600 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Trophy size={24} />
            </div>
            <div className="stat-change stat-neutral">0%</div>
          </div>
          <div className="stat-num">15</div>
          <div className="stat-label">{t.stats.points}</div>
        </div>

        <div className="stat-card group">
          <div className="flex justify-between items-start mb-4">
            <div className="stat-icon bg-violet-50 text-violet-600 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Target size={24} />
            </div>
            <div className="stat-change stat-up">100%</div>
          </div>
          <div className="stat-num">100%</div>
          <div className="stat-label">{t.stats.quality}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 card card-pad">
          <div className="flex items-center justify-between mb-6">
            <div className="card-title mb-0">
              <TrendingUp size={20} className="text-emerald-600" />
              {t.recentMaterials}
            </div>
            <button 
              onClick={() => onNavigate('library')}
              className="text-xs font-bold text-emerald-600 hover:underline"
            >
              Барлығын көру
            </button>
          </div>
          
          <div className="space-y-4">
            {filteredRecent.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <FileText size={32} />
                </div>
                <p className="text-slate-400 text-sm">
                  {searchQuery ? 'Іздеу бойынша нәтиже жоқ' : t.noMaterials}
                </p>
              </div>
            ) : (
              filteredRecent.map((item, i) => (
                <div key={i} className="recent-item p-4 hover:bg-slate-50 border-slate-100" onClick={() => onNavigate('library', item)}>
                  <div className={`recent-icon w-12 h-12 rounded-xl ${item.type === 'ҚМЖ' ? 'bg-blue-50 text-blue-600' : item.type === 'Ойын' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                    {item.type === 'ҚМЖ' ? <Book size={20} /> : item.type === 'Ойын' ? <Gamepad2 size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="recent-info">
                    <div className="recent-title text-sm font-bold text-slate-900">{item.title}</div>
                    <div className="recent-meta text-xs text-slate-500 mt-1">{item.subject} • {item.date}</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <ChevronRight size={16} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card card-pad bg-emerald-900 text-white border-none shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/10 rounded-full -ml-12 -mb-12 blur-xl"></div>
          
          <div className="relative z-10">
            <div className="card-title text-white mb-6">
              <Lightbulb size={20} className="text-yellow-400" />
              {t.ideas}
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-yellow-400">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold mb-1">PDF Экспорт</div>
                  <p className="text-xs text-white/60 leading-relaxed">ҚМЖ-ны бірден PDF форматында жүктеу мүмкіндігін қосу.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-emerald-400">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold mb-1">Аналитика</div>
                  <p className="text-xs text-white/60 leading-relaxed">Ойындардың нәтижесін бақылайтын мұғалім кабинеті.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-blue-400">
                  <Book size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold mb-1">Көптілділік</div>
                  <p className="text-xs text-white/60 leading-relaxed">Платформаны толықтай орыс және ағылшын тілдеріне аудару.</p>
                </div>
              </div>
            </div>
            
            <button className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-colors">
              Барлық жаңалықтар
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardView;
