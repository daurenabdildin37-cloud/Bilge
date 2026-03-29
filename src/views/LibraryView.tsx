
import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Book, Gamepad2, CheckCircle2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportKmzhToDocx } from '../services/exportService';
import { QuizGame } from '../components/Games/QuizGame';
import { FlashcardsGame } from '../components/Games/FlashcardsGame';
import { MatchingGame } from '../components/Games/MatchingGame';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/error-handling';
import KMZHView from './KMZHView';
import AssessmentView from './AssessmentView';
import GradingSimulatorView from './GradingSimulatorView';

interface LibraryViewProps {
  searchQuery?: string;
  isApiOk?: boolean;
  onOpenApiModal?: () => void;
  addNotification?: (title: string, message: string, type?: any) => void;
  showToast?: (message: string) => void;
  t: any;
}

const LibraryView = ({ 
  searchQuery = '', 
  isApiOk = false, 
  onOpenApiModal = () => {},
  addNotification = () => {},
  showToast = () => {},
  t
}: LibraryViewProps) => {
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Барлығы');
  const [viewItem, setViewItem] = useState<any>(null);
  const [localSearch, setLocalSearch] = useState('');

  const copyShareLink = (id: string) => {
    const url = `${window.location.origin}/grading/${id}`;
    navigator.clipboard.writeText(url);
    addNotification?.('Көшірілді! 🔗', 'Сілтеме алмасу буферіне көшірілді.', 'success');
  };

  useEffect(() => {
    fetchLibrary();
    
    const lastViewed = localStorage.getItem('lastViewed');
    if (lastViewed) {
      setViewItem(JSON.parse(lastViewed));
      localStorage.removeItem('lastViewed');
    }
  }, []);

  const fetchLibrary = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const q = query(
        collection(db, 'library'), 
        where('userId', '==', user.uid),
        limit(100)
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .sort((a: any, b: any) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
      setLibrary(data);
    } catch (err) {
      console.error("Failed to fetch library", err);
      handleFirestoreError(err, OperationType.GET, 'library');
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'library', id));
      setLibrary(library.filter(item => item.id !== id));
      addNotification('Өшірілді! 🗑️', 'Элемент кітапханадан жойылды.', 'info');
    } catch (err) {
      console.error("Delete failed", err);
      handleFirestoreError(err, OperationType.DELETE, `library/${id}`);
    }
  };

  const downloadWord = async (item: any) => {
    if (item.type === 'ҚМЖ') {
      await exportKmzhToDocx(item.data);
    }
  };

  const effectiveSearch = searchQuery || localSearch;

  const filtered = library.filter(item => {
    let matchesFilter = filter === 'Барлығы' || item.type === filter;
    if (filter === 'БЖБ/ТЖБ') {
      matchesFilter = item.type === 'БЖБ' || item.type === 'ТЖБ' || item.type === 'БЖБ/ТЖБ';
    }
    const matchesSearch = !effectiveSearch || 
      item.title?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      item.subject?.toLowerCase().includes(effectiveSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fu"
    >
      <div className="lib-search mb-6">
        <input 
          type="text" 
          className="inp" 
          placeholder="Курс немесе тақырып іздеу..." 
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
      </div>
      
      <div className="lib-filter-tabs mb-6">
        {['Барлығы', 'ҚМЖ', 'Ойын', 'БЖБ/ТЖБ', 'Бағалау'].map((t, i) => (
          <button 
            key={i} 
            className={`lftab ${filter === t ? 'on' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="lib-grid">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lib-empty col-span-full"
            >
              <div className="lib-empty-icon">📚</div>
              <p>Кітапхана бос. Генератор арқылы жаңа материалдар жасаңыз.</p>
            </motion.div>
          ) : (
            filtered.map((item, i) => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="lib-card" 
                onClick={() => setViewItem(item)}
              >
                <div className="lib-card-icon">
                  {item.type === 'ҚМЖ' ? '📄' : item.type === 'Бағалау' ? '📊' : '🎮'}
                </div>
                <div className="lib-card-title">{item.title}</div>
                <div className="lib-card-sub">{item.subject} • {item.grade}-сынып • {item.date}</div>
                <div className="lib-card-foot">
                  <span className={`badge b-blue`}>{item.type}</span>
                  <div className="flex gap-2">
                    {item.type === 'Бағалау' && (
                      <button className="btn btn-sm btn-ghost text-blue-600" onClick={(e) => { e.stopPropagation(); copyShareLink(item.id); }}>Сілтеме</button>
                    )}
                    {item.type === 'ҚМЖ' && (
                      <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); downloadWord(item); }}>Word</button>
                    )}
                    <button className="btn btn-sm btn-ghost text-red-500" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}>Жою</button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {viewItem && (
        <div className="modal-ov show" onClick={() => setViewItem(null)}>
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="modal-box !w-[95vw] !max-w-[1100px] max-h-[90vh] overflow-y-auto" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white dark:bg-slate-900 z-10 py-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold">{viewItem.title}</h3>
              <button onClick={() => setViewItem(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} /></button>
            </div>
            
            {viewItem.type === 'ҚМЖ' ? (
              <div className="p-4">
                <KMZHView 
                  isApiOk={isApiOk}
                  onOpenApiModal={onOpenApiModal}
                  addNotification={addNotification}
                  initialResult={viewItem.data}
                />
              </div>
            ) : viewItem.type === 'БЖБ' || viewItem.type === 'ТЖБ' ? (
              <div className="p-4">
                <AssessmentView 
                  isApiOk={isApiOk}
                  onOpenApiModal={onOpenApiModal}
                  addNotification={addNotification}
                  result={{ ...viewItem.data, id: viewItem.id }}
                  t={t}
                />
              </div>
            ) : viewItem.type === 'Бағалау' ? (
              <div className="p-4 h-[70vh]">
                <GradingSimulatorView 
                  initialData={{ ...viewItem.data, id: viewItem.id }}
                  isPublic={false}
                  addNotification={addNotification}
                  showToast={showToast}
                />
              </div>
            ) : (
              <div className="p-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6">
                  <div className="text-center mb-6">
                    <div className="text-4xl mb-2">{viewItem.subject === 'Kahoot' ? '🏆' : viewItem.subject === 'Flashcards' ? '🃏' : '🧩'}</div>
                    <h4 className="text-lg font-bold">{viewItem.title}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{viewItem.subject} • {viewItem.grade}-сынып</p>
                  </div>
                  
                  {viewItem.subject === 'Kahoot' && <QuizGame onBack={() => setViewItem(null)} data={viewItem.data} />}
                  {viewItem.subject === 'Flashcards' && <FlashcardsGame onBack={() => setViewItem(null)} data={viewItem.data} />}
                  {viewItem.subject === 'Matching' && <MatchingGame onBack={() => setViewItem(null)} data={viewItem.data} />}
                </div>
              </div>
            )}
            
            <div className="mt-6 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900 py-4 border-t border-slate-100 dark:border-slate-800">
              <button className="btn btn-ghost" onClick={() => setViewItem(null)}>Жабу</button>
              {viewItem.type === 'Бағалау' && (
                <button className="btn btn-primary" onClick={() => copyShareLink(viewItem.id)}>Сілтемені көшіру</button>
              )}
              {viewItem.type === 'ҚМЖ' && (
                <button className="btn btn-primary" onClick={() => downloadWord(viewItem)}>Word жүктеу</button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default LibraryView;
