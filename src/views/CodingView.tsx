import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Send, Code, Play, Save, Trash2, MessageSquare, Sparkles, CheckCircle2, Copy, Edit3, History, Layers, ExternalLink, Share2, Smartphone, Tablet, Monitor, Maximize2, Minimize2, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateGameIterative } from '../services/geminiService';
import { generateGameWithClaude } from '../services/claudeService';
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
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/error-handling';

import { useGeneration } from '../contexts/GenerationContext';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const WebGame: React.FC<{ data: any; viewSize: 'mobile' | 'tablet' | 'desktop' }> = ({ data, viewSize }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const getWidth = () => {
    if (viewSize === 'mobile') return '375px';
    if (viewSize === 'tablet') return '768px';
    return '100%';
  };

  useEffect(() => {
    if (iframeRef.current && data) {
      const htmlContent = data.html || '';
      const cssContent = data.css || '';
      const jsContent = data.js || '';

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
              #app { 
                width: 100%;
                max-width: 100%;
                margin: 0 auto;
              }
            </style>
          </head>
          <body>
            <div id="app">${htmlContent}</div>
            <script>
              window.onerror = function(msg, url, line, col, error) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'color:red; padding:20px; background:#fee; border:1px solid #fcc; margin-top:20px; font-family:monospace; font-size:12px;';
                errorDiv.innerHTML = '<strong>Runtime Error:</strong> ' + msg + '<br><small>Line: ' + line + '</small>';
                document.body.appendChild(errorDiv);
                return false;
              };
              try {
                ${jsContent.replace(/<\/script>/g, '<\\/script>')}
              } catch (e) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'color:red; padding:20px; background:#fee; border:1px solid #fcc; margin-top:20px; font-family:monospace; font-size:12px;';
                errorDiv.innerHTML = '<strong>Execution Error:</strong> ' + e.message;
                document.body.appendChild(errorDiv);
              }
            </script>
          </body>
        </html>
      `;
      
      const blob = new Blob([docContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;

      return () => URL.revokeObjectURL(url);
    }
  }, [data]);

  return (
    <div className="w-full h-full flex flex-col items-center bg-slate-100 dark:bg-slate-950 p-4 overflow-hidden">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col"
        style={{ width: getWidth(), height: '100%', maxHeight: '800px' }}
      >
        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <ExternalLink size={14} /> Интерактивті Web Ойын
          </div>
          {data.instructions && (
            <div className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
              {data.instructions}
            </div>
          )}
        </div>
        <iframe 
          ref={iframeRef} 
          title="Web Game Preview" 
          className="flex-1 w-full border-none bg-white dark:bg-slate-900"
          sandbox="allow-scripts allow-modals"
        />
      </div>
    </div>
  );
};

interface CodingViewProps {
  isApiOk: boolean;
  isClaudeApiOk: boolean;
  onOpenApiModal: () => void;
  onOpenClaudeApiModal: () => void;
  addNotification: (t: string, m: string, ty: string) => void;
}

const CodingView = ({ isApiOk, isClaudeApiOk, onOpenApiModal, onOpenClaudeApiModal, addNotification }: CodingViewProps) => {
  const {
    codingMessages: messages, setCodingMessages: setMessages,
    codingInput: input, setCodingInput: setInput,
    isCodingLoading: loading,
    codingGameData: gameData, setCodingGameData: setGameData,
    codingHistory: history, setCodingHistory: setHistory,
    codingGenerationMode: generationMode, setCodingGenerationMode: setGenerationMode,
    codingProgress: generationProgress,
    handleCodingSend
  } = useGeneration();

  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [mobileView, setMobileView] = useState<'chat' | 'preview'>('chat');
  const [viewSize, setViewSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [editableCode, setEditableCode] = useState('');
  const [smartEdit, setSmartEdit] = useState<{ html: string; css: string; js: string; instructions: string } | null>(null);
  const [smartTab, setSmartTab] = useState<'html' | 'css' | 'js'>('html');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (gameData) {
      setEditableCode(JSON.stringify(gameData, null, 2));
      if (gameData.type === 'web') {
        setSmartEdit({
          html: gameData.html || '',
          css: gameData.css || '',
          js: gameData.js || '',
          instructions: gameData.instructions || ''
        });
      } else {
        setSmartEdit(null);
      }
      // Auto switch to preview on mobile when game is generated
      if (window.innerWidth < 768) {
        setMobileView('preview');
      }
    }
  }, [gameData]);

  const applySmartCode = () => {
    if (!smartEdit) return;
    const newData = {
      ...gameData,
      type: 'web',
      ...smartEdit
    };
    setGameData(newData);
    setHistory(prev => [...prev, newData]);
    
    // Sync JSON editor
    setEditableCode(JSON.stringify(newData, null, 2));
    
    addNotification('Код қолданылды! 🛠️', 'Мануалды өзгерістер сақталды.', 'success');
    setViewMode('preview');
  };

  const onHandleSend = async (customMsg?: string) => {
    const userMsg = customMsg || input.trim();
    if (!userMsg || loading) return;
    
    // AI Studio API Key Selection Check
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          addNotification('API кілті қажет 🔑', 'Күрделі ойындар мен суреттер жасау үшін ақылы Google Cloud жобасының API кілтін таңдаңыз.', 'info');
          await (window as any).aistudio.openSelectKey();
          // Proceed after dialog as per instructions
        }
      } catch (e) {
        console.warn("AI Studio API key selection failed:", e);
      }
    }

    if (!customMsg) setInput('');
    await handleCodingSend(userMsg, isApiOk, isClaudeApiOk, onOpenApiModal, addNotification);
  };

  const applyManualCode = () => {
    const trimmedCode = editableCode.trim();
    if (!trimmedCode) {
      addNotification('Бос код ⚠️', 'Алдымен кодты енгізіңіз немесе генерациялаңыз.', 'info');
      return;
    }

    // Helper to clean markdown
    const cleanMarkdown = (text: string) => {
      return text.replace(/```json/g, '').replace(/```html/g, '').replace(/```css/g, '').replace(/```javascript/g, '').replace(/```js/g, '').replace(/```/g, '').trim();
    };

    const codeToParse = cleanMarkdown(trimmedCode);

    try {
      const parsed = JSON.parse(codeToParse);
      setGameData(parsed);
      setHistory(prev => [...prev, parsed]);
      
      // Sync Smart Edit if it's a web game
      if (parsed.type === 'web') {
        setSmartEdit({
          html: parsed.html || '',
          css: parsed.css || '',
          js: parsed.js || '',
          instructions: parsed.instructions || ''
        });
      }

      addNotification('Код қолданылды! 🛠️', 'Мануалды өзгерістер сақталды.', 'success');
      setViewMode('preview');
    } catch (err: any) {
      // If parsing fails, check if it's raw HTML/Component
      if (codeToParse.startsWith('<') || codeToParse.toLowerCase().includes('<!doctype html>')) {
         const autoWrapped = {
           type: 'web',
           html: codeToParse,
           css: '',
           js: '',
           instructions: 'Автоматты түрде танылған HTML коды'
         };
         setGameData(autoWrapped);
         setHistory(prev => [...prev, autoWrapped]);
         setEditableCode(JSON.stringify(autoWrapped, null, 2));
         addNotification('HTML танылды! 🌐', 'Мәтін автоматты түрде ойын форматына айналдырылды.', 'success');
         setViewMode('preview');
         return;
      }

      console.error("Manual Code Error:", err);
      addNotification('Қате ❌', `JSON форматы қате: ${err.message}. Тек JSON немесе HTML қабылданады.`, 'error');
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(editableCode);
      setEditableCode(JSON.stringify(parsed, null, 2));
      addNotification('Форматталды ✨', 'JSON коды реттелді.', 'success');
    } catch (err) {
      addNotification('Қате ❌', 'Форматтау үшін JSON дұрыс болуы керек.', 'error');
    }
  };

  const resetCode = () => {
    if (gameData) {
      setEditableCode(JSON.stringify(gameData, null, 2));
      addNotification('Қалпына келтірілді 🔄', 'Соңғы жұмыс істеген нұсқаға оралды.', 'info');
    }
  };

  const createTemplate = () => {
    const template = {
      type: "web",
      html: "<div class='p-8 text-center'>\n  <h1 class='text-3xl font-bold mb-4'>Сәлем!</h1>\n  <p>Бұл жаңа ойынның бастамасы.</p>\n  <button id='btn' class='mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg'>Бас!</button>\n</div>",
      css: "body { background: #f8fafc; }",
      js: "document.getElementById('btn').onclick = () => alert('Сәлем!');",
      instructions: "Батырманы басқанда хабарлама шығады."
    };
    setEditableCode(JSON.stringify(template, null, 2));
    addNotification('Шаблон қосылды 📑', 'Енді оны өзгертіп, "Кодты қолдану" батырмасын басыңыз.', 'info');
  };

  const saveGame = async (asTemplate: boolean = false) => {
    if (!gameData) return;
    const user = auth.currentUser;
    if (!user) return addNotification('Жүйеге кіріңіз', 'Сақтау үшін алдымен авторизациядан өтіңіз.', 'info');

    try {
      const docRef = await addDoc(collection(db, 'library'), {
        userId: user.uid,
        type: 'Ойын',
        title: `${asTemplate ? 'Шаблон' : 'AI Ойын'}: ${gameData.type || 'Жаңа'}`,
        subject: 'AI Generated',
        grade: 'Кез келген',
        data: gameData,
        isTemplate: asTemplate,
        date: new Date().toLocaleDateString(),
        createdAt: serverTimestamp()
      });
      
      setSavedId(docRef.id);
      addNotification(
        asTemplate ? 'Шаблон сақталды! 📑' : 'Сақталды! ✅', 
        asTemplate ? 'Ойын шаблондар бөліміне қосылды.' : 'Ойын кітапханаға және ойындар бөліміне қосылды.', 
        'success'
      );
    } catch (err) {
      console.error("Coding Save Error:", err);
      handleFirestoreError(err, OperationType.CREATE, 'library');
      addNotification('Қате ❌', 'Сақтау кезінде қате шықты. Деректер көлемі тым үлкен болуы мүмкін.', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      // Fallback for non-secure contexts or if navigator.clipboard is unavailable
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const shareGame = async () => {
    let id = savedId;
    if (!id) {
      // Auto-save if not saved yet to get an ID for sharing
      try {
        const user = auth.currentUser;
        if (!user) {
          addNotification('Кіру қажет', 'Сілтеме бөлісу үшін жүйеге кіріңіз.', 'info');
          return;
        }
        const docRef = await addDoc(collection(db, 'library'), {
          userId: user.uid,
          title: gameData.title || 'Жаңа ойын',
          data: gameData,
          createdAt: serverTimestamp(),
          isTemplate: false
        });
        id = docRef.id;
        setSavedId(id);
      } catch (err) {
        console.error("Coding Share Error:", err);
        handleFirestoreError(err, OperationType.CREATE, 'library');
        addNotification('Қате', 'Сілтеме жасау мүмкін болмады. Деректер көлемі тым үлкен болуы мүмкін.', 'error');
        return;
      }
    }
    const url = `${window.location.origin}/play?gameId=${id}`;
    copyToClipboard(url);
    addNotification('Оқушы сілтемесі көшірілді! 🔗', 'Оқушыларға арналған тікелей сілтеме буферге сақталды.', 'success');
  };

  const suggestions = [
    'Математикалық лабиринт ойынын жаса',
    'Химиялық элементтерді сәйкестендіру тренажері',
    'Тарихи викторина (Web форматта)',
    'Сөз жұмбақ ойыны'
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex flex-1 gap-6 overflow-hidden relative">
        {/* Chat Section */}
        <div className={`w-full md:w-1/3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all ${mobileView === 'preview' ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 font-bold">
              <Code size={18} className="text-blue-600" />
              Код Генераторы
            </div>
            <div className="flex items-center gap-2">
              {loading && <div className="text-[10px] text-blue-600 animate-pulse">Код жазылуда...</div>}
              
              <div className="flex items-center gap-1 mr-2">
                <button 
                  onClick={onOpenApiModal}
                  className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${isApiOk ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
                  title="Gemini API"
                >
                  <Settings size={14} />
                  <span className="text-[10px] font-bold hidden lg:inline">Gemini</span>
                  {isApiOk && <div className="w-1 h-1 rounded-full bg-emerald-500" />}
                </button>
                <button 
                  onClick={onOpenClaudeApiModal}
                  className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${isClaudeApiOk ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-600'}`}
                  title="Claude API"
                >
                  <Settings size={14} />
                  <span className="text-[10px] font-bold hidden lg:inline">Claude</span>
                  {isClaudeApiOk && <div className="w-1 h-1 rounded-full bg-purple-500" />}
                </button>
              </div>

              <button 
                className="md:hidden btn btn-xs btn-primary"
                onClick={() => setMobileView('preview')}
              >
                Превью <Play size={12} className="ml-1" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Режим:</div>
              <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg">
                <button 
                  className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${generationMode === 'simple' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500'}`}
                  onClick={() => setGenerationMode('simple')}
                >
                  Қарапайым
                </button>
                <button 
                  className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${generationMode === 'advanced' ? 'bg-white dark:bg-slate-600 shadow-sm text-purple-600' : 'text-slate-500'}`}
                  onClick={() => setGenerationMode('advanced')}
                >
                  Күрделі + Сурет
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {suggestions.map((s, i) => (
                <button 
                  key={i} 
                  className="whitespace-nowrap px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-[10px] font-medium hover:border-blue-400 transition-colors"
                  onClick={() => onHandleSend(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="relative">
              <textarea 
                className="inp pr-12 min-h-[60px] max-h-[120px] py-3 text-sm shadow-inner" 
                placeholder="Қандай ойын жазғыңыз келеді? (Мысалы: Физикалық симуляция...)" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onHandleSend();
                  }
                }}
              />
              <button 
                className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg"
                onClick={() => onHandleSend()}
                disabled={loading || !input.trim()}
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            {generationProgress && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl border border-blue-100 dark:border-blue-800/50 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Sparkles size={10} className="animate-pulse" />
                    {generationProgress.message}
                  </div>
                  {generationProgress.total && (
                    <div className="text-[9px] text-blue-500 font-mono">
                      {generationProgress.current}/{generationProgress.total}
                    </div>
                  )}
                </div>
                {generationProgress.total && (
                  <div className="w-full h-1 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(generationProgress.current! / generationProgress.total!) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        <div className={`flex-1 flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <button 
                className="md:hidden btn btn-icon w-8 h-8"
                onClick={() => setMobileView('chat')}
              >
                <MessageSquare size={18} />
              </button>
              <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                <button 
                  className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${viewMode === 'preview' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500'}`}
                  onClick={() => setViewMode('preview')}
                >
                  <Play size={14} /> Превью
                </button>
                <button 
                  className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${viewMode === 'code' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500'}`}
                  onClick={() => setViewMode('code')}
                >
                  <Code size={14} /> Код
                </button>
              </div>

              {viewMode === 'preview' && gameData && (
                <div className="hidden lg:flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl ml-2">
                  <button 
                    className={`p-1.5 rounded-lg transition-all ${viewSize === 'mobile' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500'}`}
                    onClick={() => setViewSize('mobile')}
                    title="Mobile View"
                  >
                    <Smartphone size={14} />
                  </button>
                  <button 
                    className={`p-1.5 rounded-lg transition-all ${viewSize === 'tablet' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500'}`}
                    onClick={() => setViewSize('tablet')}
                    title="Tablet View"
                  >
                    <Tablet size={14} />
                  </button>
                  <button 
                    className={`p-1.5 rounded-lg transition-all ${viewSize === 'desktop' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500'}`}
                    onClick={() => setViewSize('desktop')}
                    title="Desktop View"
                  >
                    <Monitor size={14} />
                  </button>
                  <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 self-center mx-1" />
                  <button 
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all font-bold text-[10px]"
                    onClick={() => {
                      if (gameData.type === 'web') {
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
                              <style>${cssContent}</style>
                            </head>
                            <body>
                              <div id="app">${htmlContent}</div>
                              <script>${jsContent}</script>
                            </body>
                          </html>
                        `;
                        const blob = new Blob([docContent], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } else if (savedId) {
                        window.open(`${window.location.origin}/game/${savedId}`, '_blank');
                      } else {
                        addNotification('Алдымен сақтаңыз', 'Бұл ойын түрін жеке терезеде ашу үшін оны сақтау қажет.', 'info');
                      }
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>Жеке терезеде ашу</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex gap-1 sm:gap-2">
              {gameData && (
                <>
                  <button className="btn btn-xs sm:btn-sm btn-ghost text-slate-500" onClick={() => {
                    copyToClipboard(JSON.stringify(gameData, null, 2));
                    addNotification('Көшірілді!', 'JSON коды буферге көшірілді.', 'success');
                  }}>
                    <Copy size={14} />
                  </button>
                  <button className="btn btn-xs sm:btn-sm btn-ghost text-blue-500 flex items-center gap-1" onClick={shareGame} title="Оқушы сілтемесін көшіру">
                    <Share2 size={14} />
                    <span className="hidden md:inline text-[10px]">Оқушы сілтемесі</span>
                  </button>
                  <button className="btn btn-xs sm:btn-sm btn-ghost text-red-500" onClick={() => { setGameData(null); setHistory([]); setSavedId(null); }}>
                    <Trash2 size={14} />
                  </button>
                  <button className="btn btn-xs sm:btn-sm btn-ghost text-orange-500" onClick={() => saveGame(true)} title="Шаблон ретінде сақтау">
                    <Layers size={14} className="sm:mr-1" /> <span className="hidden sm:inline">Шаблон</span>
                  </button>
                  <button className="btn btn-xs sm:btn-sm btn-primary bg-emerald-600 border-none px-2 sm:px-4" onClick={() => saveGame(false)}>
                    <CheckCircle2 size={14} className="sm:mr-1" /> <span className="hidden sm:inline">Ойындарға қосу</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {viewMode === 'preview' ? (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full overflow-y-auto p-6 flex items-center justify-center bg-slate-50 dark:bg-slate-950/50"
                >
                  {!gameData ? (
                    <div className="text-center max-w-xs">
                      <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                        <Sparkles size={40} className="text-blue-400 animate-pulse" />
                      </div>
                      <h3 className="font-bold text-slate-600 dark:text-slate-300 text-lg">Лаборатория бос</h3>
                      <p className="text-sm text-slate-500 mt-2">Сол жақтағы чатқа ойын туралы сұраныс жазыңыз немесе шаблонды таңдаңыз.</p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {gameData.type === 'kahoot' && <div className="w-full max-w-4xl"><QuizGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'flashcards' && <div className="w-full max-w-4xl"><FlashcardsGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'matching' && <div className="w-full max-w-4xl"><MatchingGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'memory' && <div className="w-full max-w-4xl"><MemoryGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'truefalse' && <div className="w-full max-w-4xl"><TrueFalseGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'wordsearch' && <div className="w-full max-w-4xl"><WordSearchGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'sequence' && <div className="w-full max-w-4xl"><SequenceGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'categorization' && <div className="w-full max-w-4xl"><CategorizationGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'crossword' && <div className="w-full max-w-4xl"><CrosswordGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'fillblanks' && <div className="w-full max-w-4xl"><FillBlanksGame data={gameData} onBack={() => {}} /></div>}
                      {gameData.type === 'web' && <WebGame data={gameData} viewSize={viewSize} />}
                      {!['kahoot', 'flashcards', 'matching', 'memory', 'truefalse', 'wordsearch', 'sequence', 'categorization', 'crossword', 'fillblanks', 'web'].includes(gameData.type) && (
                         <div className="p-8 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30 flex flex-col items-center gap-4">
                            <Code size={48} />
                            <div className="text-center">
                              <div className="font-bold">Белгісіз формат</div>
                              <div className="text-sm opacity-80">AI ойын түрін дұрыс анықтамады. Чатқа "Квиз түрінде жаса" деп жазып көріңіз.</div>
                            </div>
                         </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="code"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`h-full flex flex-col bg-slate-900 ${isFullScreen ? 'fixed inset-0 z-[100]' : ''}`}
                >
                  {gameData?.type === 'web' && smartEdit ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex bg-slate-800 p-1 gap-1 items-center">
                        <div className="flex flex-1 gap-1">
                          <button 
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${smartTab === 'html' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            onClick={() => setSmartTab('html')}
                          >
                            HTML
                          </button>
                          <button 
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${smartTab === 'css' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            onClick={() => setSmartTab('css')}
                          >
                            CSS
                          </button>
                          <button 
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${smartTab === 'js' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            onClick={() => setSmartTab('js')}
                          >
                            JS
                          </button>
                        </div>
                        <button 
                          onClick={() => setIsFullScreen(!isFullScreen)}
                          className="p-2 text-slate-400 hover:text-white transition-colors"
                          title={isFullScreen ? "Кішірейту" : "Толық экран"}
                        >
                          {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                      </div>
                      <div className="flex-1 bg-slate-900 overflow-hidden relative">
                        {smartTab === 'html' && (
                          <div className="absolute inset-0 flex flex-col">
                            <div className="p-1 px-3 bg-slate-800/50 text-[9px] text-slate-500 font-bold uppercase flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span>HTML Structure</span>
                                <span className="text-slate-600">|</span>
                                <span className="text-slate-400 normal-case font-normal">{smartEdit.html.split('\n').length} жол</span>
                              </div>
                              <span className="text-emerald-500">.html</span>
                            </div>
                            <textarea 
                              className="flex-1 p-4 bg-transparent text-emerald-400 font-mono text-sm outline-none resize-none custom-scrollbar"
                              value={smartEdit.html}
                              onChange={e => setSmartEdit(prev => prev ? { ...prev, html: e.target.value } : null)}
                              spellCheck={false}
                            />
                          </div>
                        )}
                        {smartTab === 'css' && (
                          <div className="absolute inset-0 flex flex-col">
                            <div className="p-1 px-3 bg-slate-800/50 text-[9px] text-slate-500 font-bold uppercase flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span>Styles (Tailwind supported)</span>
                                <span className="text-slate-600">|</span>
                                <span className="text-slate-400 normal-case font-normal">{smartEdit.css.split('\n').length} жол</span>
                              </div>
                              <span className="text-blue-500">.css</span>
                            </div>
                            <textarea 
                              className="flex-1 p-4 bg-transparent text-blue-400 font-mono text-sm outline-none resize-none custom-scrollbar"
                              value={smartEdit.css}
                              onChange={e => setSmartEdit(prev => prev ? { ...prev, css: e.target.value } : null)}
                              spellCheck={false}
                            />
                          </div>
                        )}
                        {smartTab === 'js' && (
                          <div className="absolute inset-0 flex flex-col">
                            <div className="p-1 px-3 bg-slate-800/50 text-[9px] text-slate-500 font-bold uppercase flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span>Logic & Interactivity</span>
                                <span className="text-slate-600">|</span>
                                <span className="text-slate-400 normal-case font-normal">{smartEdit.js.split('\n').length} жол</span>
                              </div>
                              <span className="text-yellow-500">.js</span>
                            </div>
                            <textarea 
                              className="flex-1 p-4 bg-transparent text-yellow-400 font-mono text-sm outline-none resize-none custom-scrollbar"
                              value={smartEdit.js}
                              onChange={e => setSmartEdit(prev => prev ? { ...prev, js: e.target.value } : null)}
                              spellCheck={false}
                            />
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-slate-800 border-t border-slate-700 flex justify-between items-center gap-2">
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Web Редактор (5000 жолға дейін қолдайды)
                        </div>
                        <div className="flex gap-2">
                          <button 
                            className="btn btn-xs btn-ghost text-slate-400 hover:text-white"
                            onClick={() => setSmartEdit(null)}
                          >
                            JSON-ға ауысу
                          </button>
                          <button 
                            className="btn btn-sm btn-primary bg-blue-600 border-none shadow-lg hover:shadow-blue-500/20"
                            onClick={applySmartCode}
                          >
                            <Play size={14} className="mr-1" /> Кодты қолдану
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex bg-slate-800 p-1 px-3 justify-between items-center">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">JSON Editor | {editableCode.split('\n').length} жол</span>
                        <button 
                          onClick={() => setIsFullScreen(!isFullScreen)}
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                        >
                          {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                      </div>
                      <div className="flex-1 p-4 relative">
                        <textarea 
                          className="w-full h-full bg-transparent text-emerald-400 font-mono text-sm outline-none resize-none custom-scrollbar"
                          value={editableCode}
                          onChange={e => setEditableCode(e.target.value)}
                          spellCheck={false}
                          placeholder='{"type": "web", ...}'
                        />
                        {!editableCode && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <button 
                              className="btn btn-sm btn-ghost text-slate-500 pointer-events-auto"
                              onClick={createTemplate}
                            >
                              <Layers size={14} className="mr-2" /> Шаблоннан бастау
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-slate-800 border-t border-slate-700 flex justify-between items-center gap-2">
                        <div className="flex gap-2">
                          {gameData?.type === 'web' && (
                            <button 
                              className="btn btn-xs btn-primary bg-slate-700 border-none text-blue-400"
                              onClick={() => setSmartEdit({
                                html: gameData.html || '',
                                css: gameData.css || '',
                                js: gameData.js || '',
                                instructions: gameData.instructions || ''
                              })}
                            >
                              <Edit3 size={12} className="mr-1" /> Smart Edit
                            </button>
                          )}
                          <button 
                            className="btn btn-xs btn-ghost text-slate-400 hover:text-white"
                            onClick={formatJson}
                            title="JSON форматтау"
                          >
                            <Sparkles size={14} className="mr-1" /> Форматтау
                          </button>
                          <button 
                            className="btn btn-xs btn-ghost text-slate-400 hover:text-white"
                            onClick={resetCode}
                            title="Қалпына келтіру"
                          >
                            <History size={14} className="mr-1" /> Қалпына келтіру
                          </button>
                        </div>
                        <button 
                          className="btn btn-sm btn-primary bg-blue-600 border-none shadow-lg hover:shadow-blue-500/20"
                          onClick={applyManualCode}
                        >
                          <Edit3 size={14} className="mr-1" /> Кодты қолдану
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* History Sidebar (Floating) */}
            {history.length > 1 && (
              <div className="absolute right-4 top-4 flex flex-col gap-2">
                <div className="group relative">
                  <button className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 transition-colors">
                    <History size={20} />
                  </button>
                  <div className="absolute right-full mr-2 top-0 hidden group-hover:block w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold uppercase text-slate-400">Тарих</div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {history.map((h, idx) => (
                        <button 
                          key={idx} 
                          className="w-full text-left p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs flex items-center gap-2"
                          onClick={() => setGameData(h)}
                        >
                          <Layers size={12} />
                          Версия {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodingView;
