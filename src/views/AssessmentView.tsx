
import * as React from 'react';
import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Upload, Download, Save, Printer, Globe, Users, Link as LinkIcon, Eye, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import mammoth from 'mammoth';
import { extractTextFromPdf } from '../lib/pdf-utils';
import { generateAssessment, GenerationProgress } from '../services/geminiService';
import { exportAssessmentToDocx } from '../services/exportService';
import { getContextForGenerator } from '../services/knowledgeBaseService';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType, reportErrorToAI } from '../lib/error-handling';
import { AssessmentData, AssessmentResult } from '../types';
import { MapComponent } from '../components/Common/MapComponent';

import { useGeneration } from '../contexts/GenerationContext';

import { getBaseUrl } from '../lib/utils';

interface AssessmentViewProps {
  isApiOk: boolean;
  onOpenApiModal: () => void;
  addNotification: (title: string, message: string, type: string) => void;
  result?: AssessmentData | null;
  setResult?: (result: AssessmentData | null) => void;
  onNavigate?: (tab: string, item?: any) => void;
  t: any;
}

const AssessmentView = ({ isApiOk, onOpenApiModal, addNotification, result: propResult, setResult: propSetResult, onNavigate, t }: AssessmentViewProps) => {
  const { 
    isAssessmentGenerating: loading, 
    assessmentResult: resultState, 
    setAssessmentResult: setResultState, 
    assessmentProgress: generationProgress, 
    handleAssessmentGenerate 
  } = useGeneration();

  const [useKB, setUseKB] = useState(true);
  
  // Use propResult if available, otherwise use local state
  const result = propResult || resultState;

  const setResult = (val: AssessmentData | null) => {
    if (propSetResult) {
      propSetResult(val);
    } else {
      setResultState(val);
    }
  };
  const [shuffledResult, setShuffledResult] = useState<AssessmentData | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'results'>(result?.id ? 'results' : 'create');
  const [submissions, setSubmissions] = useState<AssessmentResult[]>([]);
  const [params, setParams] = useState({
    type: 'БЖБ',
    subject: 'Математика',
    grade: '5',
    topic: '',
    lang: 'Қазақша',
    request: '',
    sourceText: '',
    mode: 'offline' as 'online' | 'offline',
    difficulty: 'Medium',
    taskCount: 5,
    studentsList: ''
  });

  const toggleMode = async (mode: 'online' | 'offline') => {
    setParams({ ...params, mode });
    if (result?.id) {
      try {
        const docRef = doc(db, 'library', result.id);
        await updateDoc(docRef, {
          'data.metadata.mode': mode
        });
        if (setResult) {
          setResult({
            ...result,
            metadata: { ...result.metadata, mode }
          });
        }
        addNotification(
          mode === 'online' ? 'Онлайн режим қосылды! 🌐' : 'Офлайн режимге ауыстырылды 🔒',
          mode === 'online' ? 'Оқушыларға сілтемені жібере аласыз.' : 'Оқушылар енді бұл тапсырмаға кіре алмайды.',
          'success'
        );
      } catch (err) {
        console.error(err);
        addNotification('Қате ❌', 'Режимді өзгерту мүмкін болмады.', 'error');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/plain') {
      const text = await file.text();
      setParams({ ...params, sourceText: text });
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        setParams({ ...params, sourceText: result.value });
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type === 'application/pdf') {
      try {
        const text = await extractTextFromPdf(file);
        setParams({ ...params, sourceText: text });
      } catch (err) {
        console.error(err);
        addNotification('Қате ❌', 'PDF файлын оқу кезінде қате шықты.', 'error');
      }
    }
  };

  const handleGenerate = async () => {
    // AI Studio API Key Selection Check
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          addNotification('API кілті қажет 🔑', 'Тапсырмалар мен суреттер жасау үшін ақылы Google Cloud жобасының API кілтін таңдаңыз.', 'info');
          await (window as any).aistudio.openSelectKey();
          // Proceed after dialog as per instructions
        }
      } catch (e) {
        console.warn("AI Studio API key selection failed:", e);
      }
    }

    handleAssessmentGenerate(params, useKB, isApiOk, onOpenApiModal, addNotification);
  };

  const saveToLibrary = async (dataToSave = result, isOnline = false) => {
    if (!dataToSave) return;
    const user = auth.currentUser;
    if (!user) {
      addNotification('Авторизация қажет 🔐', 'Жүйеге кіріңіз', 'error');
      return;
    }

    // Prepare data for Firestore by serializing nested arrays in mapConfig
    const preparedData = {
      ...dataToSave,
      tasks: (dataToSave.tasks || []).map(task => {
        if (task.mapConfig) {
          return {
            ...task,
            mapConfig: typeof task.mapConfig === 'string' ? task.mapConfig : JSON.stringify(task.mapConfig)
          };
        }
        return task;
      })
    };

    try {
      const docRef = await addDoc(collection(db, 'library'), {
        userId: user.uid,
        type: dataToSave.metadata.type,
        title: `${dataToSave.metadata.type}: ${dataToSave.metadata.topic}`,
        subject: dataToSave.metadata.subject,
        grade: dataToSave.metadata.grade,
        data: { ...preparedData, metadata: { ...dataToSave.metadata, mode: isOnline ? 'online' : 'offline' } },
        date: new Date().toLocaleDateString(),
        createdAt: serverTimestamp()
      });
      
      const updatedResult = { 
        ...dataToSave, 
        id: docRef.id, 
        metadata: { 
          ...dataToSave.metadata, 
          mode: (isOnline ? 'online' : 'offline') as 'online' | 'offline' 
        } 
      };
      setResult(updatedResult);

      if (isOnline) {
        addNotification('Онлайн режим қосылды! 🌐', 'Оқушыларға сілтемені жібере аласыз.', 'success');
      } else {
        addNotification('Сақталды! ✅', 'Кітапханаға сәтті қосылды.', 'success');
      }
      return docRef.id;
    } catch (err) {
      console.error("Assessment Save Error:", err);
      handleFirestoreError(err, OperationType.CREATE, 'library');
      addNotification('Сақтау қатесі ❌', 'Деректер қорына сақтау мүмкін болмады. Деректер көлемі тым үлкен болуы мүмкін.', 'error');
    }
  };

  const copyShareLink = async () => {
    let finalId = result?.id;
    
    if (!finalId) {
      if (result) {
        // If result exists but no ID, try to save it first
        const id = await saveToLibrary(result, params.mode === 'online');
        if (!id) return;
        finalId = id;
      } else {
        addNotification('Қате ❌', 'Көшіретін сілтеме табылмады.', 'error');
        return;
      }
    }
    
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}assessment/${finalId}`;
    
    try {
      // Try modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        addNotification('Сілтеме көшірілді! 🔗', 'Оқушыларға жіберуге дайын.', 'info');
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (err) {
      console.error('Failed to copy using clipboard API:', err);
      // Fallback for older browsers or restricted contexts
      try {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        // Ensure textarea is not visible but part of the DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          addNotification('Сілтеме көшірілді! 🔗', 'Оқушыларға жіберуге дайын.', 'info');
        } else {
          throw new Error('execCommand copy failed');
        }
      } catch (copyErr) {
        console.error('Fallback copy failed:', copyErr);
        // Final fallback: show the URL to the user
        const manualCopy = prompt('Сілтемені осы жерден көшіріп алыңыз:', url);
        if (manualCopy !== null) {
           addNotification('Сілтеме көрсетілді', 'Оны қолмен көшіріп алыңыз.', 'info');
        }
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'results' && result?.id) {
      const q = query(collection(db, 'assessment_results'), where('assessmentId', '==', result.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssessmentResult));
        setSubmissions(docs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'assessment_results');
      });
      return () => unsubscribe();
    }
  }, [activeTab, result?.id]);

  const shuffled = React.useMemo(() => {
    if (!result) return null;
    return {
      ...result,
      tasks: result.tasks.map(task => {
        if (task.type === 'ordering' && task.orderingItems) {
          return { ...task, orderingItems: [...task.orderingItems].sort(() => 0.5 - Math.random()) };
        }
        if (task.type === 'matching' && task.matchingPairs) {
          const lefts = task.matchingPairs.map(p => p.left);
          const rights = task.matchingPairs.map(p => p.right).sort(() => 0.5 - Math.random());
          return { ...task, displayPairs: { lefts, rights } };
        }
        return task;
      })
    };
  }, [result]);

  useEffect(() => {
    setShuffledResult(shuffled);
  }, [shuffled]);

  const downloadWord = async () => {
    if (!result) return;
    await exportAssessmentToDocx(result);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fu"
    >
      <div className="flex gap-4 mb-6">
        <button 
          className={`btn flex-1 ${activeTab === 'create' ? 'btn-primary bg-purple-600' : 'btn-ghost'}`}
          onClick={() => setActiveTab('create')}
        >
          <FileText size={16} className="mr-2" /> {t.assessment_view.create}
        </button>
        {result && (
          <button 
            className={`btn flex-1 ${activeTab === 'results' ? 'btn-primary bg-purple-600' : 'btn-ghost'}`}
            onClick={() => setActiveTab('results')}
          >
            <Users size={16} className="mr-2" /> {t.assessment_view.results} ({submissions.length})
          </button>
        )}
      </div>

      {activeTab === 'create' ? (
        <>
          <div className="card card-pad mb-8">
            <div className="flex justify-between items-center mb-6">
              <div className="card-title !mb-0">
                <FileText size={18} className="text-purple-600" />
                {t.assessment_view.generator_title}
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button 
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${params.mode === 'offline' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold' : ''}`}
                  onClick={() => toggleMode('offline')}
                >
                  {t.assessment_view.offline}
                </button>
                <button 
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${params.mode === 'online' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-purple-600' : ''}`}
                  onClick={() => toggleMode('online')}
                >
                  {t.assessment_view.online}
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="form-grid-3">
            <div className="fg">
              <label className="flabel">{t.assessment_view.type}</label>
              <select className="inp" value={params.type} onChange={e => setParams({...params, type: e.target.value})}>
                <option>БЖБ</option>
                <option>ТЖБ</option>
              </select>
            </div>
            <div className="fg">
              <label className="flabel">{t.assessment_view.subject}</label>
              <input type="text" className="inp" value={params.subject} onChange={e => setParams({...params, subject: e.target.value})} />
            </div>
            <div className="fg">
              <label className="flabel">{t.assessment_view.grade}</label>
              <select className="inp" value={params.grade} onChange={e => setParams({...params, grade: e.target.value})}>
                {Array.from({length: 11}, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="fg">
              <label className="flabel">{t.assessment_view.difficulty}</label>
              <select className="inp" value={params.difficulty} onChange={e => setParams({...params, difficulty: e.target.value})}>
                <option value="Easy">{t.assessment_view.difficulty_levels.easy}</option>
                <option value="Medium">{t.assessment_view.difficulty_levels.medium}</option>
                <option value="Hard">{t.assessment_view.difficulty_levels.hard}</option>
              </select>
            </div>
            <div className="fg">
              <label className="flabel">{t.assessment_view.taskCount}</label>
              <input 
                type="number" 
                className="inp" 
                value={isNaN(params.taskCount) ? '' : params.taskCount} 
                onChange={e => setParams({...params, taskCount: parseInt(e.target.value)})} 
                min={1} 
                max={20} 
              />
            </div>
          </div>

          <div className="fg">
            <label className="flabel">{t.assessment_view.topic}</label>
            <input 
              type="text" 
              className="inp" 
              placeholder={t.assessment_view.topic_placeholder} 
              value={params.topic} 
              onChange={e => setParams({...params, topic: e.target.value})} 
            />
          </div>

          {params.mode === 'online' && (
            <div className="fg">
              <label className="flabel">{t.assessment_view.students_list}</label>
              <textarea 
                className="inp min-h-[100px]" 
                placeholder={t.assessment_view.students_placeholder} 
                value={params.studentsList} 
                onChange={e => setParams({...params, studentsList: e.target.value})}
              ></textarea>
              <p className="text-[10px] text-slate-500 mt-1">{t.assessment_view.students_hint}</p>
            </div>
          )}

          <div className="fg">
            <label className="flabel">{t.assessment_view.request}</label>
            <textarea 
              className="inp min-h-[80px]" 
              placeholder={t.assessment_view.request_placeholder} 
              value={params.request} 
              onChange={e => setParams({...params, request: e.target.value})}
            ></textarea>
          </div>

          <div className="fg">
            <label className="flabel">{t.assessment_view.source}</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${useKB ? 'bg-blue-600' : 'bg-slate-300'}`}
                    onClick={() => setUseKB(!useKB)}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useKB ? 'left-6' : 'left-1'}`} />
                  </div>
                  <span className="text-xs font-bold text-slate-600">Білім базасын пайдалану</span>
                </div>
                {useKB && (
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                    Контекст автоматты түрде қосылады
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  id="source-upload-assessment" 
                  className="hidden" 
                  accept=".txt,.docx,.pdf" 
                  onChange={handleFileUpload} 
                />
                <label 
                  htmlFor="source-upload-assessment" 
                  className="btn btn-ghost flex-1 border-dashed border-2 border-slate-200 dark:border-slate-700 hover:border-purple-400 py-4"
                >
                  <Upload size={18} className="mr-2" />
                  {t.assessment_view.upload_hint}
                </label>
              </div>
              <textarea 
                className="inp min-h-[100px] text-xs" 
                placeholder={t.assessment_view.source_placeholder} 
                value={params.sourceText} 
                onChange={e => setParams({...params, sourceText: e.target.value})}
              ></textarea>
            </div>
          </div>

          <button className="btn btn-primary bg-purple-600 hover:bg-purple-700 border-none btn-wide" onClick={handleGenerate} disabled={loading}>
            {loading ? t.assessment_view.generating : t.assessment_view.generate_btn}
          </button>
        </div>
      </div>

      {loading && (
        <div className="ai-loader show">
          <div className="ai-dots">
            <div className="ai-dot bg-purple-600"></div>
            <div className="ai-dot bg-purple-600"></div>
            <div className="ai-dot bg-purple-600"></div>
          </div>
          <h3 className="ai-loader-title">{generationProgress?.message || t.assessment_view.loader_title}</h3>
          <p className="ai-loader-sub">
            {generationProgress?.status === 'generating_images' 
              ? 'Тапсырмаларға сәйкес көрнекі суреттер дайындалуда. Бұл біраз уақыт алуы мүмкін.' 
              : t.assessment_view.loader_sub}
          </p>
          {generationProgress?.total && (
            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-6 overflow-hidden mx-auto">
              <motion.div 
                className="bg-purple-600 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${(generationProgress.current! / generationProgress.total!) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="result-wrap show">
          <div className="result-header">
            <div>
              <div className="result-title">{result.metadata.type}: {result.metadata.topic}</div>
              <div className="result-badges">
                <span className="badge b-purple">{result.metadata.subject}</span>
                <span className="badge b-green">{result.metadata.grade}-сынып</span>
                <span className="badge b-blue">Жалпы балл: {result.metadata.totalPoints}</span>
              </div>
            </div>
            <div className="result-actions">
              {result.id && (
                <button className="btn btn-sm btn-ghost text-purple-600" onClick={copyShareLink}>
                  <LinkIcon size={14} className="mr-1" /> Сілтемені көшіру
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={downloadWord}>
                <Download size={14} className="mr-1" /> Word (.docx)
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => window.print()}>
                <Printer size={14} className="mr-1" /> Басып шығару
              </button>
              <button className="btn btn-sm btn-primary bg-purple-600 border-none" onClick={() => saveToLibrary(result, params.mode === 'online')}>
                <Save size={14} className="mr-1" /> Кітапханаға сақтау
              </button>
            </div>
          </div>

          <div className="result-body space-y-8">
            {shuffledResult && (
              <>
                {shuffledResult.metadata.mode === 'online' && (
              <div className="bg-white dark:bg-black p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="text-purple-600" size={20} />
                  <div>
                    <div className="font-bold text-sm">Онлайн режим белсенді</div>
                    <div className="text-xs text-slate-500">Оқушылар бұл тапсырманы онлайн орындай алады.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    className="btn btn-sm btn-ghost text-purple-600" 
                    onClick={() => window.open(`${getBaseUrl()}assessment/${result.id}`, '_blank')}
                  >
                    <Eye size={14} className="mr-1" /> Тексеру
                  </button>
                  <button className="btn btn-sm btn-primary bg-purple-600 border-none" onClick={copyShareLink}>
                    Оқушыларға сілтеме
                  </button>
                </div>
              </div>
            )}
            
            {result.analysis && (
              <div className="bg-white dark:bg-black p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FileText size={18} className="text-purple-600" />
                  Мазмұнды талдау (Content Analysis)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div>
                    <div className="font-bold text-purple-600 mb-2">Негізгі концептілер:</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.analysis.keyConcepts.map((c, idx) => <li key={idx}>{c}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-bold text-purple-600 mb-2">Маңызды деректер:</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.analysis.importantFacts.map((f, idx) => <li key={idx}>{f}</li>)}
                    </ul>
                  </div>
                  <div className="md:col-span-2">
                    <div className="font-bold text-purple-600 mb-2">Оқушылар көрсететін дағдылар:</div>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.skills.map((s, idx) => (
                        <span key={idx} className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {result.metadata.students && result.metadata.students.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Users size={18} className="text-purple-600" />
                  Оқушылар тізімі және кіру кодтары
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {result.metadata.students.map((student, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <div className="text-sm font-medium truncate mr-2">{student.name}</div>
                      <div className="text-xs font-mono font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 px-2 py-1 rounded">
                        {student.accessCode}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-4 italic">
                  * Оқушыларға сілтемені және олардың бірегей кодтарын беріңіз.
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-center mb-8 uppercase underline">
                {result.metadata.type} - {result.metadata.subject} ({result.metadata.grade}-сынып)
              </h2>
              
              <div className="space-y-8">
                {shuffledResult.tasks.map((task: any, i: number) => (
                  <div key={i} className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="font-bold">Тапсырма №{task.number}</div>
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">[{task.maxPoint} балл]</div>
                    </div>
                    <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-800 italic text-black dark:text-white">
                      {task.task}
                    </div>
                    {task.imageUrl && (
                      <div className="pl-4 max-w-2xl">
                        <img 
                          src={task.imageUrl} 
                          alt={`Тапсырма ${task.number}`} 
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    {task.type === 'choice' && task.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                        {task.options.map((opt: string, idx: number) => (
                          <div key={idx} className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm">
                            <span className="font-bold mr-2">{String.fromCharCode(65 + idx)})</span> {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {task.type === 'true_false' && (
                      <div className="flex gap-4 pl-4">
                        <div className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold">Ақиқат</div>
                        <div className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold">Жалған</div>
                      </div>
                    )}
                    {task.type === 'ordering' && task.orderingItems && (
                      <div className="space-y-2 pl-4">
                        {task.orderingItems.map((item: string, idx: number) => (
                          <div key={idx} className="p-2 bg-white dark:bg-black rounded border border-slate-200 dark:border-slate-800 text-sm">
                            <span className="font-bold mr-2">{idx + 1}.</span> {item}
                          </div>
                        ))}
                      </div>
                    )}
                    {task.type === 'matching' && task.displayPairs && (
                      <div className="grid grid-cols-2 gap-4 pl-4 text-sm">
                        <div className="space-y-1">
                          {task.displayPairs.lefts.map((left: string, idx: number) => (
                            <div key={idx} className="p-2 bg-white dark:bg-black rounded border border-slate-200 dark:border-slate-800">
                              <span className="font-bold mr-2">{idx + 1}.</span> {left}
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1">
                          {task.displayPairs.rights.map((right: string, idx: number) => (
                            <div key={idx} className="p-2 bg-white dark:bg-black rounded border border-slate-200 dark:border-slate-800">
                              <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {right}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {task.type === 'cards' && task.cards && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
                        {task.cards.map((card: string, idx: number) => (
                          <div key={idx} className="p-3 bg-white dark:bg-black border-2 border-slate-100 dark:border-slate-800 rounded-xl text-xs text-center">
                            {card}
                          </div>
                        ))}
                      </div>
                    )}
                    {task.type === 'map' && task.mapUrl && (
                      <div className="pl-4">
                        <div className="aspect-video bg-white dark:bg-black rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 overflow-hidden">
                          <MapComponent query={task.mapUrl} interactive={false} />
                        </div>
                        <p className="text-[10px] mt-1 text-slate-500 italic">Карта: {task.mapUrl}</p>
                      </div>
                    )}
                    {(task.type === 'map_mark' || task.type === 'map_draw' || task.type === 'map_territory' || task.type === 'map_route') && task.mapUrl && (
                      <div className="pl-4">
                        <div className="aspect-video bg-white dark:bg-black rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 overflow-hidden">
                          <MapComponent 
                            query={task.mapUrl} 
                            interactive={false} 
                            center={task.mapConfig?.center}
                            zoom={task.mapConfig?.zoom}
                            initialMarkers={task.type === 'map_mark' && task.correctAnswer ? [JSON.parse(task.correctAnswer)] : []}
                            initialPolygons={
                              task.type === 'map_draw' && task.correctAnswer ? [{ points: JSON.parse(task.correctAnswer), color: 'green' }] :
                              task.type === 'map_territory' && task.mapConfig?.territories ? task.mapConfig.territories.map((t: any) => ({ 
                                points: t.correctBoundary.map((p: any) => ({ lat: p[0], lng: p[1] })), 
                                color: t.color, 
                                name: t.name 
                              })) : []
                            }
                            initialRoutes={
                              task.type === 'map_route' && task.mapConfig?.routes ? task.mapConfig.routes.map((r: any) => ({ 
                                points: r.correctPath.map((p: any) => ({ lat: p[0], lng: p[1] })), 
                                color: r.color, 
                                name: r.name 
                              })) : []
                            }
                          />
                        </div>
                        <p className="text-[10px] mt-1 text-slate-500 italic">Карта: {task.mapUrl} (Мұғалімге арналған анықтамалық карта)</p>
                      </div>
                    )}
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <strong>Бағалау критерийі:</strong> {task.criteria} <br/>
                      <strong>Ойлау дағдыларының деңгейі:</strong> {task.level}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-black p-8 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold mb-6">Балл қою кестесі (Критерийлер мен дескрипторлар)</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-white dark:bg-black">
                      <th className="border border-slate-300 dark:border-slate-700 p-2 text-left">Тапсырма №</th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 text-left">Бағалау критерийі</th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 text-left">Дескриптор</th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 text-center">Балл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tasks.map((task: any) => (
                      <React.Fragment key={task.number}>
                        {task.descriptors.map((desc: any, idx: number) => (
                          <tr key={`${task.number}-${idx}`}>
                            {idx === 0 && (
                              <>
                                <td className="border border-slate-300 dark:border-slate-600 p-2 align-top font-bold" rowSpan={task.descriptors.length}>
                                  {task.number}
                                </td>
                                <td className="border border-slate-300 dark:border-slate-600 p-2 align-top" rowSpan={task.descriptors.length}>
                                  {task.criteria}
                                </td>
                              </>
                            )}
                            <td className="border border-slate-300 dark:border-slate-600 p-2">
                              {desc.description}
                            </td>
                            <td className="border border-slate-300 dark:border-slate-600 p-2 text-center">
                              {desc.point}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    <tr className="font-bold bg-slate-100 dark:bg-slate-800">
                      <td colSpan={3} className="border border-slate-300 dark:border-slate-600 p-2 text-right">Жалпы балл:</td>
                      <td className="border border-slate-300 dark:border-slate-600 p-2 text-center">{result.metadata.totalPoints}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-black text-white p-8 rounded-xl">
              <h3 className="text-lg font-bold mb-4 text-white">Жауаптар кілті (Мұғалім үшін)</h3>
              <div className="space-y-4">
                {result.answerKey.map((ans: any, i: number) => (
                  <div key={i} className="text-sm">
                    <span className="font-bold text-white">№{ans.taskNumber}:</span> {ans.answer}
                  </div>
                ))}
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Оқушылардың нәтижелері</h2>
            <div className="text-sm text-slate-500">Барлығы: {submissions.length} оқушы</div>
          </div>

          {submissions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card card-pad bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Орташа балл</div>
                <div className="text-2xl font-bold text-purple-600">
                  {(submissions.reduce((acc, s) => acc + s.totalScore, 0) / submissions.length).toFixed(1)}
                </div>
              </div>
              <div className="card card-pad bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Жоғары балл</div>
                <div className="text-2xl font-bold text-green-600">
                  {Math.max(...submissions.map(s => s.totalScore))}
                </div>
              </div>
              <div className="card card-pad bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Тапсырғандар</div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((submissions.length / (result?.metadata.students?.length || submissions.length)) * 100)}%
                </div>
              </div>
              <div className="card card-pad bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Орташа сапа</div>
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round((submissions.filter(s => s.totalScore / s.maxScore >= 0.5).length / submissions.length) * 100)}%
                </div>
              </div>
            </div>
          )}

          {submissions.length === 0 ? (
            <div className="card card-pad text-center py-12">
              <Users size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Әзірге ешқандай оқушы тапсырманы орындаған жоқ.</p>
              <button className="btn btn-primary bg-purple-600 border-none mt-4" onClick={copyShareLink}>
                Сілтемені көшіру
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {submissions.map((sub) => (
                <div key={sub.id} className="card card-pad hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-bold text-lg">{sub.studentName}</div>
                      <div className="text-xs text-slate-500">{new Date(sub.createdAt?.seconds * 1000).toLocaleString()}</div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${sub.totalScore / sub.maxScore >= 0.8 ? 'bg-green-100 text-green-700' : sub.totalScore / sub.maxScore >= 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {sub.totalScore} / {sub.maxScore}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {sub.answers.map((ans) => (
                      <div key={ans.taskNumber} className="text-xs flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">№{ans.taskNumber} тапсырма:</span>
                        <span className="font-medium">{ans.score} балл</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-sm btn-ghost w-full mt-4 text-purple-600">
                    <Eye size={14} className="mr-1" /> Толық көру
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AssessmentView;
