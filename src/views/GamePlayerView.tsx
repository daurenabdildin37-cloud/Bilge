import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getBaseUrl } from '../lib/utils';
import { QuizGame } from '../components/Games/QuizGame';
import { FlashcardsGame } from '../components/Games/FlashcardsGame';
import { MatchingGame } from '../components/Games/MatchingGame';
import { MemoryGame } from '../components/Games/MemoryGame';
import { TrueFalseGame } from '../components/Games/TrueFalseGame';
import { WordSearchGame } from '../components/Games/WordSearchGame';
import { SequenceGame } from '../components/Games/SequenceGame';
import { CategorizationGame } from '../components/Games/CategorizationGame';
import { CrosswordGame } from '../components/Games/CrosswordGame';
import { FillBlanksGame } from '../components/Games/FillBlanksGame';
import { Loader2, AlertCircle, Home } from 'lucide-react';

const GamePlayerView: React.FC = () => {
  // Manual ID extraction from /game/:id or ?gameId=...
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const gameIdx = pathParts.indexOf('game');
  const pathId = gameIdx !== -1 && pathParts.length > gameIdx + 1 ? pathParts[gameIdx + 1] : '';
  
  const queryParams = new URLSearchParams(window.location.search);
  const queryId = queryParams.get('gameId');
  
  const id = pathId || queryId || '';
  const [gameData, setGameData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = getBaseUrl();
    }
  };

  const goHome = () => {
    localStorage.setItem('activeTab', 'dashboard');
    window.location.href = getBaseUrl();
  };

  useEffect(() => {
    const fetchGame = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'library', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.type === 'Ойын' && data.data) {
            setGameData(data.data);
          } else {
            setError('Бұл ойын файлы емес немесе деректері қате.');
          }
        } else {
          setError('Ойын табылмады.');
        }
      } catch (err) {
        console.error(err);
        setError('Деректерді жүктеу кезінде қате шықты.');
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [id]);

  useEffect(() => {
    if (iframeRef.current && gameData && gameData.type === 'web') {
      const htmlContent = gameData.html || '';
      const cssContent = gameData.css || '';
      const jsContent = gameData.js || '';

      const docContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              ${cssContent}
              body { 
                margin: 0; 
                padding: 20px; 
                font-family: sans-serif; 
                background: transparent;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 100vh;
              }
              #app { width: 100%; max-width: 800px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div id="app">${htmlContent}</div>
            <script>${jsContent.replace(/<\/script>/g, '<\\/script>')}</script>
          </body>
        </html>
      `;
      
      const blob = new Blob([docContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;

      return () => URL.revokeObjectURL(url);
    }
  }, [gameData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Ойын жүктелуде...</p>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-6">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Қате орын алды</h1>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">{error || 'Ойынды жүктеу мүмкін емес.'}</p>
        <button 
          onClick={goHome}
          className="btn btn-primary flex items-center gap-2"
        >
          <Home size={18} /> Басты бетке қайту
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl flex justify-between items-center mb-8">
        <button 
          onClick={goBack}
          className="btn btn-ghost text-slate-500"
        >
          ← Артқа
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {gameData.type === 'kahoot' ? '🏆 Интеллектуалды Квиз' : 
             gameData.type === 'flashcards' ? '🃏 Флэш-карталар' : 
             gameData.type === 'matching' ? '🧩 Жұпты тап' : '🎮 Web Ойын'}
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">AI Generated Game</p>
        </div>
        <div className="w-20"></div>
      </div>

      <div className="w-full max-w-4xl">
        {gameData.type === 'kahoot' && <QuizGame data={gameData} onBack={goBack} />}
        {gameData.type === 'flashcards' && <FlashcardsGame data={gameData} onBack={goBack} />}
        {gameData.type === 'matching' && <MatchingGame data={gameData} onBack={goBack} />}
        {gameData.type === 'memory' && <MemoryGame data={gameData} onBack={goBack} />}
        {gameData.type === 'truefalse' && <TrueFalseGame data={gameData} onBack={goBack} />}
        {gameData.type === 'wordsearch' && <WordSearchGame data={gameData} onBack={goBack} />}
        {gameData.type === 'sequence' && <SequenceGame data={gameData} onBack={goBack} />}
        {gameData.type === 'categorization' && <CategorizationGame data={gameData} onBack={goBack} />}
        {gameData.type === 'crossword' && <CrosswordGame data={gameData} onBack={goBack} />}
        {gameData.type === 'fillblanks' && <FillBlanksGame data={gameData} onBack={goBack} />}
        {gameData.type === 'web' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 h-[70vh]">
            <iframe 
              ref={iframeRef}
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-modals"
              title="Web Game Player"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePlayerView;
