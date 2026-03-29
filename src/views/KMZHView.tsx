
import * as React from 'react';
import { Book, CheckCircle2, Clock, Upload, Key, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { extractTextFromPdf } from '../lib/pdf-utils';
import { generateKmzh, GenerationProgress } from '../services/geminiService';
import { exportKmzhToDocx } from '../services/exportService';
import { getContextForGenerator } from '../services/knowledgeBaseService';
import { handleFirestoreError, OperationType, reportErrorToAI } from '../lib/error-handling';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { useGeneration } from '../contexts/GenerationContext';

interface KMZHViewProps {
  isApiOk: boolean;
  onOpenApiModal: () => void;
  addNotification: (title: string, message: string, type: string) => void;
  initialResult?: any;
}

const KMZHView = ({ 
  isApiOk, onOpenApiModal, addNotification, initialResult 
}: KMZHViewProps) => {
  const { 
    isKmzhGenerating: loading, 
    kmzhResult: propResult, 
    setKmzhResult: setResult, 
    kmzhProgress: generationProgress, 
    kmzhLoaderStep: loaderStep, 
    setKmzhLoaderStep: setLoaderStep, 
    handleKmzhGenerate 
  } = useGeneration();

  // Handle deserialization of stages if they were serialized for Firestore
  const result = React.useMemo(() => {
    if (!propResult) return null;
    if (!propResult.stages) return propResult;
    
    return {
      ...propResult,
      stages: propResult.stages.map((stage: any) => {
        const recoveredStage = { ...stage };
        Object.keys(recoveredStage).forEach(key => {
          if (typeof recoveredStage[key] === 'string' && (recoveredStage[key].startsWith('[') || recoveredStage[key].startsWith('{'))) {
            try {
              recoveredStage[key] = JSON.parse(recoveredStage[key]);
            } catch (e) {
              // Not JSON, ignore
            }
          }
        });
        return recoveredStage;
      })
    };
  }, [propResult]);

  const [params, setParams] = React.useState({
    subject: 'Математика',
    grade: '5',
    date: new Date().toLocaleDateString(),
    participants: '25',
    absent: '0',
    teacherName: '',
    schoolName: '',
    section: '',
    topic: '',
    learningObjectives: '',
    value: 'Білім және ғылым',
    quote: 'Білім - таусылмас қазына',
    additionalRequests: '',
    sourceText: ''
  });

  const quickFill = (type: string) => {
    if (type === 'math') {
      setParams({
        ...params,
        subject: 'Математика',
        grade: '5',
        topic: 'Жай бөлшектерді қосу және азайту',
        learningObjectives: '5.1.2.17 жай бөлшектерді қосу және азайтуды орындау',
        section: 'Жай бөлшектер',
      });
    } else if (type === 'history') {
      setParams({
        ...params,
        subject: 'Қазақстан тарихы',
        grade: '7',
        topic: 'Қазақ хандығының құрылуы',
        learningObjectives: '7.3.1.2 Қазақ хандығы құрылуының тарихи маңызын түсіндіру',
        section: 'Қазақ хандығының құрылуы',
      });
    }
  };

  const steps = [
    'Пән мен тақырыпты талдау',
    'Білім базасынан мәлімет алу',
    'Сабақ жоспарының құрылымын жасау',
    'Мазмұнды толтыру және форматтау',
    'Дайын!'
  ];

  const [useKB, setUseKB] = React.useState(true);

  const handleGenerate = async () => {
    // AI Studio API Key Selection Check
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          addNotification('API кілті қажет 🔑', 'Сабақ жоспары мен суреттер жасау үшін ақылы Google Cloud жобасының API кілтін таңдаңыз.', 'info');
          await (window as any).aistudio.openSelectKey();
          // Proceed after dialog as per instructions
        }
      } catch (e) {
        console.warn("AI Studio API key selection failed:", e);
      }
    }

    handleKmzhGenerate(params, useKB, isApiOk, onOpenApiModal, addNotification);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/plain') {
      const text = await file.text();
      setParams({ ...params, sourceText: text });
      addNotification('Сәтті! ✅', 'Мәтін сәтті жүктелді.', 'success');
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ arrayBuffer });
          setParams({ ...params, sourceText: result.value });
          addNotification('Сәтті! ✅', 'Word құжаты сәтті жүктелді.', 'success');
        } catch (err) {
          console.error("Mammoth error:", err);
          addNotification('Қате ❌', 'Word файлын оқу кезінде қате шықты.', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type === 'application/pdf') {
      try {
        const text = await extractTextFromPdf(file);
        setParams({ ...params, sourceText: text });
        addNotification('Сәтті! ✅', 'PDF құжаты сәтті жүктелді.', 'success');
      } catch (err) {
        console.error(err);
        addNotification('Қате ❌', 'PDF файлын оқу кезінде қате шықты.', 'error');
      }
    } else {
      addNotification('Ескерту ⚠️', 'Тек .txt, .docx немесе .pdf файлдарын жүктеуге болады.', 'warning');
    }
  };

  const saveToLibrary = async () => {
    if (!result) return;
    const user = auth.currentUser;
    if (!user) {
      addNotification('Авторизация қажет 🔐', 'Жүйеге кіріңіз', 'error');
      return;
    }

    // Prepare data for Firestore (ensure no nested arrays in stages)
    const preparedData = {
      ...result,
      stages: result.stages.map((stage: any) => {
        const preparedStage = { ...stage };
        // If any field in stage is an array, stringify it
        Object.keys(preparedStage).forEach(key => {
          if (Array.isArray(preparedStage[key])) {
            preparedStage[key] = JSON.stringify(preparedStage[key]);
          }
        });
        return preparedStage;
      })
    };

    const newItem = {
      userId: user.uid,
      type: 'ҚМЖ',
      title: result.metadata.topic,
      subject: params.subject,
      grade: params.grade,
      data: preparedData,
      date: new Date().toLocaleDateString(),
      createdAt: serverTimestamp()
    };
    
    try {
      await addDoc(collection(db, 'library'), newItem);
      addNotification('Сақталды! ✅', 'Кітапханаға сәтті қосылды.', 'success');
    } catch (err) {
      console.error("Save failed", err);
      handleFirestoreError(err, OperationType.CREATE, 'library');
      addNotification('Қате ❌', 'Сақтау кезінде қате шықты.', 'error');
    }
  };

  const downloadWord = async () => {
    if (!result) return;
    try {
      await exportKmzhToDocx(result);
    } catch (err) {
      console.error("Download failed", err);
      addNotification('Қате ❌', 'Word файлын жүктеу кезінде қате шықты.', 'error');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fu"
    >
      <div className="card card-pad mb-8">
        <div className="flex justify-between items-center mb-6">
          <div className="card-title !mb-0">
            <Book size={18} className="text-blue-600" />
            ҚМЖ Параметрлері (Ресми формат)
          </div>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-ghost" onClick={() => quickFill('math')}>Математика үлгісі</button>
            <button className="btn btn-sm btn-ghost" onClick={() => quickFill('history')}>Тарих үлгісі</button>
          </div>
        </div>
        <div className="space-y-6">
          <div className="form-grid-3">
            <div className="fg">
              <label className="flabel">Пән</label>
              <input type="text" className="inp" value={params.subject} onChange={e => setParams({...params, subject: e.target.value})} />
            </div>
            <div className="fg">
              <label className="flabel">Сынып</label>
              <select className="inp" value={params.grade} onChange={e => setParams({...params, grade: e.target.value})}>
                {Array.from({length: 11}, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="flabel">Күні</label>
              <input type="text" className="inp" value={params.date} onChange={e => setParams({...params, date: e.target.value})} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="fg">
              <label className="flabel">Қатысушылар саны</label>
              <input type="text" className="inp" value={params.participants} onChange={e => setParams({...params, participants: e.target.value})} />
            </div>
            <div className="fg">
              <label className="flabel">Қатыспағандар саны</label>
              <input type="text" className="inp" value={params.absent} onChange={e => setParams({...params, absent: e.target.value})} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="fg">
              <label className="flabel">Педагог аты-жөні</label>
              <input type="text" className="inp" value={params.teacherName} onChange={e => setParams({...params, teacherName: e.target.value})} />
            </div>
            <div className="fg">
              <label className="flabel">Мектеп атауы</label>
              <input type="text" className="inp" value={params.schoolName} onChange={e => setParams({...params, schoolName: e.target.value})} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="fg">
              <label className="flabel">Бөлім</label>
              <input type="text" className="inp" placeholder="Мысалы: 7.1A Бөлім" value={params.section} onChange={e => setParams({...params, section: e.target.value})} />
            </div>
            <div className="fg">
              <label className="flabel">Сабақ тақырыбы</label>
              <input type="text" className="inp" placeholder="Мысалы: Квадрат теңдеулер" value={params.topic} onChange={e => setParams({...params, topic: e.target.value})} />
            </div>
          </div>

          <div className="fg">
            <label className="flabel">Оқу мақсаттары</label>
            <textarea 
              className="inp min-h-[80px]" 
              placeholder="Мысалы: 7.2.1.1 квадрат теңдеудің анықтамасын білу..." 
              value={params.learningObjectives} 
              onChange={e => setParams({...params, learningObjectives: e.target.value})}
            ></textarea>
          </div>

          <div className="form-grid-2">
            <div className="fg">
              <label className="flabel">Құндылық</label>
              <input type="text" className="inp" value={params.value} onChange={e => setParams({...params, value: e.target.value})} />
            </div>
            <div className="fg">
              <label className="flabel">Апта дәйексөзі</label>
              <input type="text" className="inp" value={params.quote} onChange={e => setParams({...params, quote: e.target.value})} />
            </div>
          </div>

          <div className="fg">
            <label className="flabel">Қосымша сұраныстар (AI-ға нұсқаулық)</label>
            <textarea 
              className="inp min-h-[60px]" 
              placeholder="Мысалы: Ойын элементтерін көбірек қос, топтық жұмысқа басымдық бер..." 
              value={params.additionalRequests} 
              onChange={e => setParams({...params, additionalRequests: e.target.value})}
            ></textarea>
          </div>

          <div className="fg">
            <label className="flabel">Оқулық немесе дереккөз (Источник)</label>
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
                  id="source-upload" 
                  className="hidden" 
                  accept=".txt,.docx,.pdf" 
                  onChange={handleFileUpload} 
                />
                <label 
                  htmlFor="source-upload" 
                  className="btn btn-ghost flex-1 border-dashed border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 py-4"
                >
                  <Upload size={18} className="mr-2" />
                  Файл жүктеу (.txt, .docx, .pdf)
                </label>
              </div>
              <textarea 
                className="inp min-h-[100px] text-xs" 
                placeholder="Немесе мәтінді осында көшіріп қойыңыз..." 
                value={params.sourceText} 
                onChange={e => setParams({...params, sourceText: e.target.value})}
              ></textarea>
              {params.sourceText && (
                <div className="text-[10px] text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Дереккөз жүктелді ({params.sourceText.length} таңба)
                </div>
              )}
            </div>
          </div>

          <button className="btn btn-primary btn-wide" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Генерациялануда...' : 'ҚМЖ Жасау'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="ai-loader show">
          <div className="ai-dots">
            <div className="ai-dot"></div>
            <div className="ai-dot"></div>
            <div className="ai-dot"></div>
          </div>
          <h3 className="ai-loader-title">
            {generationProgress?.message || 'ҚМЖ дайындалуда...'}
          </h3>
          <p className="ai-loader-sub">
            {generationProgress?.status === 'generating_images' 
              ? 'Сабақ кезеңдеріне сәйкес көрнекі суреттер дайындалуда. Бұл біраз уақыт алуы мүмкін.' 
              : 'AI мұғалім ресми форматта жоспар құруда. Бұл шамамен 15-30 секунд алуы мүмкін.'}
          </p>
          
          {generationProgress?.total ? (
            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-6 overflow-hidden mx-auto">
              <motion.div 
                className="bg-indigo-600 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${(generationProgress.current! / generationProgress.total!) * 100}%` }}
              />
            </div>
          ) : (
            <div className="ai-steps">
              {steps.map((step, i) => (
                <div key={i} className={`ai-step ${i < loaderStep ? 'done' : i === loaderStep ? 'cur' : 'wait'}`}>
                  {i < loaderStep ? <CheckCircle2 size={14} /> : i === loaderStep ? <Clock size={14} className="animate-spin" /> : <div className="w-[14px]" />}
                  {step}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="result-wrap show">
          <div className="result-header">
            <div>
              <div className="result-title">{result.metadata.topic}</div>
              <div className="result-badges">
                <span className="badge b-blue">{params.subject}</span>
                <span className="badge b-green">{params.grade}-сынып</span>
              </div>
            </div>
            <div className="result-actions">
              <button className="btn btn-sm btn-ghost" onClick={downloadWord}>
                <Download size={14} className="mr-1" /> Word (.docx) Жүктеу
              </button>
              <button className="btn btn-sm btn-primary" onClick={saveToLibrary}>Кітапханаға сақтау</button>
            </div>
          </div>
          <div className="result-body overflow-x-auto">
            <div id="kmzh-content" className="max-w-full bg-white dark:bg-black p-4 md:p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-lg mx-auto" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt' }}>
              <div className="text-center mb-4">
                <div className="font-bold uppercase text-slate-500 dark:text-slate-400" style={{ fontSize: '10pt' }}>{result.metadata.ministry}</div>
                <div className="font-bold uppercase text-slate-500 dark:text-slate-400" style={{ fontSize: '10pt' }}>{result.metadata.school}</div>
                <div className="font-black text-lg md:text-xl mt-2">Қысқа мерзімді жоспар</div>
              </div>

              <table className="w-full border-collapse border border-slate-400 dark:border-slate-600 mb-4" style={{ fontSize: '12pt' }}>
                <tbody>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black w-1/3">Білім беру ұйымының атауы</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.school}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black">Пәні</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.subject}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black">Бөлім</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.section}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black">Педагогтің аты-жөні</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.teacher}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black">Күні</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.date}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black">Сынып</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.grade}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black">Қатысушылар саны</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.participants}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black">Қатыспағандар саны</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.absent}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-black">Сабақтың тақырыбы</td>
                    <td className="border border-slate-400 dark:border-slate-600 p-1.5">{result.metadata.topic}</td>
                  </tr>
                </tbody>
              </table>

              <div className="grid grid-cols-1 gap-y-2 mb-4 text-slate-900 dark:text-slate-100" style={{ fontSize: '12pt' }}>
                <p><strong>Оқу бағдарламасына сәйкес оқыту мақсаты:</strong> {result.metadata.learningObjective}</p>
                <p><strong>Сабақтың мақсаты:</strong> {result.metadata.lessonObjective}</p>
                
                <div className="grid grid-cols-2 gap-4 mt-2 p-2 border border-slate-200 dark:border-slate-800 rounded">
                  <div>
                    <p className="font-bold underline mb-1">Құндылық:</p>
                    <p>{result.metadata.value}</p>
                  </div>
                  <div>
                    <p className="font-bold underline mb-1">Апта дәйексөзі:</p>
                    <p className="italic">"{result.metadata.quote}"</p>
                  </div>
                </div>

                <div className="col-span-full mt-2">
                  <p><strong>Бағалау критерийлері:</strong></p>
                  <ul className="list-disc ml-4">
                    {(result.assessmentCriteria || []).map((crit: string, i: number) => <li key={i}>{crit}</li>)}
                  </ul>
                </div>

                <div className="col-span-full mt-2">
                  <p><strong>Тілдік мақсаттар:</strong></p>
                  <p className="ml-2 italic">Лексика: {(result.languageObjectives?.vocabulary || []).join(", ")}</p>
                  <p className="ml-2 italic">Тіркестер: {(result.languageObjectives?.phrases || []).join("; ")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                  <p><strong>Пәнаралық байланыс:</strong> {result.crossCurricularLinks}</p>
                  <p><strong>Алдыңғы білім:</strong> {result.previousLearning}</p>
                </div>
              </div>

              <div className="font-bold text-center mb-2" style={{ fontSize: '12pt' }}>САБАҚТЫҢ БАРЫСЫ</div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-400 dark:border-slate-600" style={{ fontSize: '12pt' }}>
                  <thead>
                    <tr className="bg-white dark:bg-black">
                      <th className="border border-slate-400 dark:border-slate-600 p-1.5 w-[12%]">Кезеңдер</th>
                      <th className="border border-slate-400 dark:border-slate-600 p-1.5 w-[28%]">Педагог әрекеті</th>
                      <th className="border border-slate-400 dark:border-slate-600 p-1.5 w-[28%]">Оқушы әрекеті</th>
                      <th className="border border-slate-400 dark:border-slate-600 p-1.5 w-[17%]">Бағалау</th>
                      <th className="border border-slate-400 dark:border-slate-600 p-1.5 w-[15%]">Ресурстар</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stages.map((stage: any, i: number) => (
                      <tr key={i}>
                        <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold">
                          {stage.period}
                          {stage.imageUrl && (
                            <div className="mt-2">
                              <img 
                                src={stage.imageUrl} 
                                alt={stage.period} 
                                className="w-full rounded border border-slate-200" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-400 dark:border-slate-600 p-1.5 whitespace-pre-wrap">{stage.teacherAction}</td>
                        <td className="border border-slate-400 dark:border-slate-600 p-1.5 whitespace-pre-wrap">{stage.studentAction}</td>
                        <td className="border border-slate-400 dark:border-slate-600 p-1.5 whitespace-pre-wrap">{stage.assessment}</td>
                        <td className="border border-slate-400 dark:border-slate-600 p-1.5 whitespace-pre-wrap">{stage.resources}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.descriptorsTable && result.descriptorsTable.length > 0 && (
                <div className="mt-8">
                  <div className="font-bold text-center mb-2 uppercase" style={{ fontSize: '12pt' }}>Тапсырмалардың дескрипторлары мен баллдары</div>
                  <table className="w-full border-collapse border border-slate-400 dark:border-slate-600" style={{ fontSize: '12pt' }}>
                    <thead>
                      <tr className="bg-white dark:bg-black">
                        <th className="border border-slate-400 dark:border-slate-600 p-1.5 w-[30%]">Тапсырма атауы</th>
                        <th className="border border-slate-400 dark:border-slate-600 p-1.5 w-[50%]">Дескриптор</th>
                        <th className="border border-slate-400 dark:border-slate-600 p-1.5 w-[20%]">Балл</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.descriptorsTable.map((desc: any, i: number) => (
                        <tr key={i}>
                          <td className="border border-slate-400 dark:border-slate-600 p-1.5 font-bold">{desc.taskName}</td>
                          <td className="border border-slate-400 dark:border-slate-600 p-1.5 whitespace-pre-wrap">{desc.descriptor}</td>
                          <td className="border border-slate-400 dark:border-slate-600 p-1.5 text-center font-bold">{desc.points}</td>
                        </tr>
                      ))}
                      <tr className="bg-white dark:bg-black font-bold">
                        <td colSpan={2} className="border border-slate-400 dark:border-slate-600 p-1.5 text-right">Жалпы балл:</td>
                        <td className="border border-slate-400 dark:border-slate-600 p-1.5 text-center">
                          {result.descriptorsTable.reduce((acc: number, curr: any) => acc + (Number(curr.points) || 0), 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

                <div className="mt-4 space-y-2 text-slate-900 dark:text-slate-100" style={{ fontSize: '12pt' }}>
                  <p><strong>Саралау:</strong> {result.differentiation}</p>
                  <p><strong>Бағалау:</strong> {result.assessmentCheck}</p>
                  <p><strong>Денсаулық және қауіпсіздік:</strong> {result.healthAndSafety}</p>
                  <p><strong>Рефлексия:</strong> {result.reflection}</p>
                </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default KMZHView;
