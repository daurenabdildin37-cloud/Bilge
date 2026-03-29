
import * as React from 'react';
import { useState, useEffect } from 'react';
import { ChevronRight, Star, Key, History, Share2, Play, Trash2, LayoutGrid, Sparkles, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { generateGame } from '../services/geminiService';
import { QuizGame } from '../components/Games/QuizGame';
import { FlashcardsGame } from '../components/Games/FlashcardsGame';
import { MatchingGame } from '../components/Games/MatchingGame';
import { TrueFalseGame } from '../components/Games/TrueFalseGame';
import { MemoryGame } from '../components/Games/MemoryGame';
import { WordSearchGame } from '../components/Games/WordSearchGame';
import { FillBlanksGame } from '../components/Games/FillBlanksGame';
import { SequenceGame } from '../components/Games/SequenceGame';
import { CategorizationGame } from '../components/Games/CategorizationGame';
import { CrosswordGame } from '../components/Games/CrosswordGame';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, limit, where, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType, reportErrorToAI } from '../lib/error-handling';

import { useGeneration } from '../contexts/GenerationContext';

interface GamesViewProps {
  isApiOk: boolean;
  onOpenApiModal: () => void;
  addNotification: (title: string, message: string, type: string) => void;
  onNavigate?: (tab: string, item?: any) => void;
}

const GamesView = ({ isApiOk, onOpenApiModal, addNotification, onNavigate }: GamesViewProps) => {
  const { 
    isGameGenerating: loading, 
    gameResult: gameData, 
    setGameResult: setGameData, 
    gameProgress: generationProgress, 
    gameParams: params, 
    setGameParams: setParams, 
    activeGame,
    setActiveGame,
    handleGameGenerate,
    gameLoaderStep: loadingMessage
  } = useGeneration();

  const setLoading = (val: boolean) => {
    // This is a dummy to avoid errors in template generation if it's still using local setLoading
    // But we should probably use the context's isGameGenerating if possible.
    // However, template generation is a bit different.
  };

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myGames, setMyGames] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'generator' | 'my-games' | 'templates'>('generator');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [newTopic, setNewTopic] = useState('');
  const [isUsingTemplate, setIsUsingTemplate] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<string | null>(null);
  const [useKB, setUseKB] = React.useState(true);
  const [gameState, setGameState] = React.useState<'idle' | 'playing' | 'finished'>(gameData ? 'playing' : 'idle');

  useEffect(() => {
    fetchLeaderboard();
    fetchMyGames();
  }, []);

  const fetchMyGames = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const q = query(
        collection(db, 'library'), 
        where('userId', '==', user.uid),
        where('type', '==', 'Ойын')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort in memory by createdAt desc
      data.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setMyGames(data);
    } catch (err) {
      console.error("Failed to fetch my games", err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const q = query(collection(db, 'leaderboard'), limit(100)); // Fetch more for sorting
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in memory by score desc
      data.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      
      const rankedData = data.slice(0, 10).map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
      
      setLeaderboard(rankedData);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'leaderboard');
      console.error("Failed to fetch leaderboard", err);
    }
  };

  const updateLeaderboard = async (newScore: number) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const leaderRef = doc(db, 'leaderboard', `user_${user.uid}`);
      const leaderDoc = await getDocs(query(collection(db, 'leaderboard'), where('userId', '==', user.uid)));
      
      let existingScore = 0;
      if (!leaderDoc.empty) {
        existingScore = leaderDoc.docs[0].data().score || 0;
      }

      // Only update if the new score is higher
      if (newScore > existingScore) {
        await setDoc(leaderRef, {
          userId: user.uid,
          name: user.displayName || 'Мұғалім',
          score: newScore,
          date: new Date().toLocaleDateString(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        fetchLeaderboard();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'leaderboard');
      console.error("Update leaderboard failed", err);
    }
  };

  const handleGenerate = async () => {
    // AI Studio API Key Selection Check
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          addNotification('API кілті қажет 🔑', 'Ойындар мен суреттер жасау үшін ақылы Google Cloud жобасының API кілтін таңдаңыз.', 'info');
          await (window as any).aistudio.openSelectKey();
          // Proceed after dialog as per instructions
        }
      } catch (e) {
        console.warn("AI Studio API key selection failed:", e);
      }
    }

    handleGameGenerate(params, useKB, isApiOk, onOpenApiModal, addNotification);
    setGameState('playing');
  };

  const shareGame = (id: string) => {
    const url = `${window.location.origin}/play?gameId=${id}`;
    navigator.clipboard.writeText(url);
    addNotification('Сілтеме көшірілді! 🔗', 'Ойынға тікелей сілтеме буферге сақталды.', 'success');
  };

  const deleteGame = (id: string) => {
    setGameToDelete(id);
  };

  const confirmDelete = async () => {
    if (!gameToDelete) return;
    try {
      await deleteDoc(doc(db, 'library', gameToDelete));
      setMyGames(prev => prev.filter(g => g.id !== gameToDelete));
      addNotification('Өшірілді', 'Ойын тізімнен алынып тасталды.', 'info');
    } catch (err) {
      console.error(err);
      addNotification('Қате', 'Өшіру мүмкін болмады.', 'error');
    } finally {
      setGameToDelete(null);
    }
  };

  const playSavedGame = (game: any) => {
    if (game.isTemplate) {
      setSelectedTemplate(game);
      setIsUsingTemplate(true);
      setNewTopic('');
    } else {
      setGameData(game.data);
      const type = game.data?.type?.toLowerCase() || 'kahoot';
      setActiveGame(type);
    }
  };

  const saveAsTemplate = async (game: any) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      await addDoc(collection(db, 'library'), {
        ...game,
        id: undefined, // Let Firestore generate a new ID
        isTemplate: true,
        title: `Шаблон: ${game.title}`,
        createdAt: serverTimestamp()
      });
      addNotification('Шаблон сақталды! 📑', 'Ойын шаблондар бөліміне қосылды.', 'success');
      fetchMyGames();
    } catch (err) {
      console.error(err);
      addNotification('Қате', 'Шаблонды сақтау мүмкін болмады.', 'error');
    }
  };

  const useTemplateWithTopic = async () => {
    if (!newTopic.trim() || !selectedTemplate) return;
    
    setLoading(true);
    try {
      const templateData = selectedTemplate.data;
      const generationParams = {
        topic: newTopic,
        grade: selectedTemplate.grade || 'Кез келген',
        type: templateData.type || 'Kahoot',
        count: templateData.questions?.length || 
               templateData.cards?.length || 
               templateData.pairs?.length || 
               templateData.words?.length || 
               templateData.items?.length || 
               templateData.clues?.length || 5,
        lang: 'Kazakh'
      };
      
      const result = await generateGame(generationParams);
      setGameData(result);
      setActiveGame(result.type.toLowerCase());
      setIsUsingTemplate(false);
      setSelectedTemplate(null);
      addNotification('Дайын! ✨', 'Шаблон негізінде жаңа ойын жасалды.', 'success');
    } catch (err: any) {
      console.error("Game Generation Error:", err);
      
      // Automatically report to AI
      reportErrorToAI(err, 'game_generation_from_template', { selectedTemplate, newTopic });
      
      addNotification('Қате ❌', 'Ойынды жасау мүмкін болмады.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentGame = async () => {
    const user = auth.currentUser;
    if (!user || !gameData) return;
    
    try {
      await addDoc(collection(db, 'library'), {
        userId: user.uid,
        title: params.topic || 'Жаңа ойын',
        data: gameData,
        type: 'Ойын',
        createdAt: serverTimestamp(),
        isTemplate: false
      });
      addNotification('Сақталды! ✅', 'Ойын сіздің кітапханаңызға қосылды.', 'success');
      fetchMyGames();
    } catch (err) {
      console.error("Game Save Error:", err);
      handleFirestoreError(err, OperationType.CREATE, 'library');
      addNotification('Қате ❌', 'Сақтау мүмкін болмады. Деректер көлемі тым үлкен болуы мүмкін.', 'error');
    }
  };

  const gameTypes = [
    { id: 'Kahoot', title: '🏆 Квиз (Kahoot)', desc: 'Сұрақ-жауап түріндегі жарыс.' },
    { id: 'Flashcards', title: '🃏 Флэш-карталар', desc: 'Терминдерді жаттауға арналған.' },
    { id: 'Matching', title: '🧩 Жұпты тап', desc: 'Сәйкестендіру ойыны.' },
    { id: 'WordSearch', title: '🔍 Сөз іздеу', desc: 'Әріптер арасынан сөздерді табу.' },
    { id: 'Memory', title: '🧠 Есте сақтау', desc: 'Жұп карталарды табу.' },
    { id: 'TrueFalse', title: '⚖️ Ақиқат/Жалған', desc: 'Тұжырымдарды тексеру.' },
    { id: 'FillBlanks', title: '📝 Бос орындар', desc: 'Сөйлемді толықтыру.' },
    { id: 'Sequence', title: '🔢 Реттілік', desc: 'Дұрыс ретпен қою.' },
    { id: 'Categorization', title: '📁 Санаттар', desc: 'Топтарға бөлу.' },
    { id: 'Crossword', title: '✏️ Кроссворд', desc: 'Сөзжұмбақ шешу.' },
    { id: 'Web', title: '🌐 Web Ойын', desc: 'Күрделі интерактивті ойын.' }
  ];

  if (activeGame) {
    const isWeb = activeGame === 'web';
    
    const combinedHtml = isWeb ? `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${gameData?.css || ''}</style>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 dark:bg-slate-900">
          <div id="app">${gameData?.html || ''}</div>
          <script>${gameData?.js || ''}</script>
        </body>
      </html>
    ` : '';

    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveGame(null)}>← Артқа</button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
            <div className="font-bold text-slate-800 dark:text-slate-100">{params.topic}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm bg-emerald-600 border-none" onClick={saveCurrentGame}>
              <Layers size={14} className="mr-2" /> Сақтау
            </button>
            {isWeb && (
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const blob = new Blob([combinedHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
              }}>Толық экран</button>
            )}
          </div>
        </div>

        <div className={`flex-1 ${isWeb ? 'h-[75vh]' : ''} bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 relative p-4 overflow-y-auto`}>
          {activeGame === 'kahoot' && <QuizGame onBack={(score) => { if(score) updateLeaderboard(score); setActiveGame(null); }} data={gameData} />}
          {activeGame === 'flashcards' && <FlashcardsGame onBack={() => setActiveGame(null)} data={gameData} />}
          {activeGame === 'matching' && <MatchingGame onBack={() => setActiveGame(null)} data={gameData} />}
          {activeGame === 'truefalse' && <TrueFalseGame onBack={(score) => { if(score) updateLeaderboard(score); setActiveGame(null); }} data={gameData} />}
          {activeGame === 'memory' && <MemoryGame onBack={(score) => { if(score) updateLeaderboard(score); setActiveGame(null); }} data={gameData} />}
          {activeGame === 'wordsearch' && <WordSearchGame onBack={(score) => { if(score) updateLeaderboard(score); setActiveGame(null); }} data={gameData} />}
          {activeGame === 'fillblanks' && <FillBlanksGame onBack={(score) => { if(score) updateLeaderboard(score); setActiveGame(null); }} data={gameData} />}
          {activeGame === 'sequence' && <SequenceGame onBack={(score) => { if(score) updateLeaderboard(score); setActiveGame(null); }} data={gameData} />}
          {activeGame === 'categorization' && <CategorizationGame onBack={(score) => { if(score) updateLeaderboard(score); setActiveGame(null); }} data={gameData} />}
          {activeGame === 'crossword' && <CrosswordGame onBack={(score) => { if(score) updateLeaderboard(score); setActiveGame(null); }} data={gameData} />}
          {isWeb && (
            <iframe 
              srcDoc={combinedHtml}
              className="w-full h-full border-none"
              title="Web Game Preview"
              sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
            />
          )}
          {!['kahoot', 'flashcards', 'matching', 'truefalse', 'memory', 'wordsearch', 'fillblanks', 'sequence', 'categorization', 'crossword', 'web'].includes(activeGame) && (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <Sparkles size={48} className="text-blue-500 mb-4 animate-pulse" />
              <h3 className="font-bold text-xl mb-2">Бұл ойын түрі әзірленуде</h3>
              <p className="text-slate-500 max-w-md">
                Қазіргі уақытта бұл ойын түрі тек "Web" форматында немесе JSON ретінде қолжетімді. 
                Біз жақын арада арнайы интерфейс қосамыз.
              </p>
              <button className="btn btn-primary mt-6" onClick={() => setActiveGame(null)}>Басқа ойын таңдау</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const filteredGames = myGames.filter(g => activeTab === 'templates' ? g.isTemplate : !g.isTemplate);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fu space-y-8"
    >
      <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl w-fit">
        <button 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'generator' ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600' : 'text-slate-500'}`}
          onClick={() => setActiveTab('generator')}
        >
          <Sparkles size={18} /> Генератор
        </button>
        <button 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'my-games' ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600' : 'text-slate-500'}`}
          onClick={() => setActiveTab('my-games')}
        >
          <History size={18} /> Менің ойындарым
        </button>
        <button 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'templates' ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600' : 'text-slate-500'}`}
          onClick={() => setActiveTab('templates')}
        >
          <Layers size={18} /> Шаблондар
        </button>
      </div>

      {activeTab === 'generator' ? (
        <>
          <div className="card card-pad">
            <div className="card-title">Ойын генераторы</div>
            <div className="space-y-4">
              <div className="fg">
                <label className="flabel">Тақырып</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${params.useKB ? 'bg-blue-600' : 'bg-slate-300'}`}
                        onClick={() => setParams({...params, useKB: !params.useKB})}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${params.useKB ? 'left-6' : 'left-1'}`} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">Білім базасын пайдалану</span>
                    </div>
                    {params.useKB && (
                      <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                        Контекст автоматты түрде қосылады
                      </span>
                    )}
                  </div>
                  <input type="text" className="inp" placeholder="Мысалы: Жасуша құрылымы" value={params.topic} onChange={e => setParams({...params, topic: e.target.value})} />
                </div>
              </div>
              <div className="form-grid-3">
                <div className="fg">
                  <label className="flabel">Сынып</label>
                  <select className="inp" value={params.grade} onChange={e => setParams({...params, grade: e.target.value})}>
                    {Array.from({length: 11}, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="flabel">Ойын түрі</label>
                  <select className="inp" value={params.type} onChange={e => setParams({...params, type: e.target.value})}>
                    {gameTypes.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="flabel">Саны (сұрақ/карта)</label>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-icon btn-sm" onClick={() => setParams({...params, count: Math.max(1, (isNaN(params.count) ? 5 : params.count) - 1)})}>-</button>
                    <input 
                      type="number" 
                      className="inp text-center !w-16" 
                      min="1" 
                      max="20" 
                      value={isNaN(params.count) ? '' : params.count} 
                      onChange={e => setParams({...params, count: parseInt(e.target.value)})} 
                    />
                    <button className="btn btn-icon btn-sm" onClick={() => setParams({...params, count: Math.min(20, (isNaN(params.count) ? 5 : params.count) + 1)})}>+</button>
                  </div>
                </div>
              </div>
              <div className="fg">
                <label className="flabel">Тіл</label>
                <div className="flex gap-2">
                  {['Қазақша', 'Орысша', 'Ағылшынша'].map(l => (
                    <button 
                      key={l} 
                      className={`pill ${params.lang === l ? 'on' : ''}`}
                      onClick={() => setParams({...params, lang: l})}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-wide" onClick={handleGenerate} disabled={loading}>
                {loading ? loadingMessage : 'Ойынды бастау'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gameTypes.map((game, i) => (
              <div 
                key={i} 
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${params.type === game.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/40 bg-white dark:bg-slate-900'}`} 
                onClick={() => setParams({...params, type: game.id})}
              >
                <div className="font-bold text-sm">{game.title}</div>
                <div className="text-[10px] text-slate-500 line-clamp-2">{game.desc}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game, i) => (
              <motion.div 
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card overflow-hidden flex flex-col group"
              >
                <div className={`h-32 bg-gradient-to-br ${game.isTemplate ? 'from-orange-500 to-amber-400' : 'from-blue-500 to-sky-400'} flex items-center justify-center text-white relative`}>
                  {game.isTemplate && (
                    <div className="absolute top-2 left-2 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold">
                      ШАБЛОН
                    </div>
                  )}
                  <div className="text-4xl">
                    {game.data?.type === 'kahoot' ? '🏆' : game.data?.type === 'flashcards' ? '🃏' : '🧩'}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!game.isTemplate && (
                      <button className="p-1.5 bg-white/20 hover:bg-orange-500 rounded-lg text-white" onClick={() => saveAsTemplate(game)} title="Шаблон ретінде сақтау">
                        <Layers size={14} />
                      </button>
                    )}
                    <button className="p-1.5 bg-white/20 hover:bg-blue-500 rounded-lg text-white" onClick={() => shareGame(game.id)} title="Оқушы сілтемесін көшіру">
                      <Share2 size={14} />
                    </button>
                    <button className="p-1.5 bg-white/20 hover:bg-red-500 rounded-lg text-white" onClick={() => deleteGame(game.id)} title="Өшіру">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-1">{game.title}</h3>
                  <p className="text-xs text-slate-500 mb-4">{game.date}</p>
                  <div className="mt-auto flex gap-2">
                    <button 
                      className={`flex-1 btn ${game.isTemplate ? 'btn-ghost border-orange-200 text-orange-600 hover:bg-orange-50' : 'btn-primary'} btn-sm`}
                      onClick={() => playSavedGame(game)}
                    >
                      <Play size={14} className="mr-2" /> {game.isTemplate ? 'Қолдану' : 'Ойнау'}
                    </button>
                    {game.isTemplate && (
                      <button 
                        className="btn btn-ghost btn-sm text-red-500 border-red-100 hover:bg-red-50"
                        onClick={() => deleteGame(game.id)}
                        title="Өшіру"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredGames.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  {activeTab === 'templates' ? <Layers size={40} className="text-slate-300" /> : <LayoutGrid size={40} className="text-slate-300" />}
                </div>
                <h3 className="font-bold text-slate-600 dark:text-slate-400">
                  {activeTab === 'templates' ? 'Шаблондар әлі жоқ' : 'Ойындар әлі жасалмаған'}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {activeTab === 'templates' ? 'Генератор бөлімінде ойынды шаблон ретінде сақтаңыз.' : 'Генератор бөліміне өтіп, алғашқы ойыныңызды жасаңыз.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card card-pad mt-8">
        <div className="card-title">
          <Star size={18} className="text-yellow-500" />
          Күннің үздік ойыншылары
        </div>
        <div className="space-y-3">
          {leaderboard.map((u, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 border border-slate-100 dark:border-slate-700 rounded-xl ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {u.rank}
              </div>
              <div className="flex-1 font-bold text-sm">{u.name}</div>
              <div className="text-blue-600 dark:text-blue-400 font-bold text-sm">{u.score.toLocaleString()} XP</div>
            </div>
          ))}
          {leaderboard.length === 0 && <p className="text-center text-slate-400 py-4">Әлі нәтижелер жоқ</p>}
        </div>
      </div>

      {/* Template Usage Modal */}
      {isUsingTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-orange-50 dark:bg-orange-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Шаблонды қолдану</h3>
                  <p className="text-[10px] text-slate-500">Жаңа тақырып бойынша ойын жасау</p>
                </div>
              </div>
              <button onClick={() => setIsUsingTemplate(false)} className="text-slate-400 hover:text-slate-600">
                <Trash2 size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Таңдалған шаблон</div>
                <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{selectedTemplate?.title}</div>
                <div className="text-xs text-slate-500 mt-1">Түрі: {selectedTemplate?.data?.type}</div>
              </div>

              <div className="fg">
                <label className="flabel">Жаңа тақырыпты енгізіңіз</label>
                <input 
                  type="text" 
                  className="inp" 
                  placeholder="Мысалы: Қазақстан тарихы" 
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  className="flex-1 btn btn-ghost"
                  onClick={() => setIsUsingTemplate(false)}
                >
                  Болдырмау
                </button>
                <button 
                  className="flex-1 btn btn-primary bg-orange-600 border-none shadow-lg shadow-orange-200 dark:shadow-none"
                  onClick={useTemplateWithTopic}
                  disabled={loading || !newTopic.trim()}
                >
                  {loading ? 'Жасалуда...' : 'Генерациялау'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {gameToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm overflow-hidden p-6 text-center"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-2">Ойынды өшіру</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Бұл әрекетті қайтару мүмкін емес. Өшіруді растайсыз ба?
            </p>
            <div className="flex gap-3">
              <button 
                className="flex-1 btn btn-ghost"
                onClick={() => setGameToDelete(null)}
              >
                Болдырмау
              </button>
              <button 
                className="flex-1 btn bg-red-500 hover:bg-red-600 text-white border-none"
                onClick={confirmDelete}
              >
                Өшіру
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
          <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full mx-4">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-blue-100 dark:border-blue-900/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="text-blue-600 animate-pulse" size={32} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Жасанды интеллект жұмыс істеуде</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm animate-pulse min-h-[1.5rem]">
              {loadingMessage}
            </p>
            <div className="mt-8 flex gap-1 justify-center">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default GamesView;
