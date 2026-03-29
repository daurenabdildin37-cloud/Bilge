
import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { AssessmentData, AssessmentResult } from '../types';
import { motion } from 'motion/react';
import { CheckCircle2, Send, User, ChevronRight, ChevronLeft, Key } from 'lucide-react';
import { Logo } from '../components/Common/Logo';
import { MapComponent } from '../components/Common/MapComponent';
import * as turf from '@turf/turf';

import { getBaseUrl } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/error-handling';

interface StudentAssessmentViewProps {
  addNotification?: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const StudentAssessmentView = ({ addNotification }: StudentAssessmentViewProps) => {
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const [shuffledTasks, setShuffledTasks] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [attempts, setAttempts] = useState<Record<number, number>>({});
  const [mapFeedback, setMapFeedback] = useState<Record<number, { color: string; message: string; accuracy?: number }>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<any | null>(null);

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const assessmentIdx = pathParts.indexOf('assessment');
  const assessmentId = assessmentIdx !== -1 && pathParts.length > assessmentIdx + 1 ? pathParts[assessmentIdx + 1] : '';

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!assessmentId) {
        console.error("No assessment ID found in URL");
        setError('Сілтеме қате. ID табылмады.');
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching assessment with ID:", assessmentId);
        const docRef = doc(db, 'library', assessmentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const docData = docSnap.data();
          console.log("Assessment document found:", docSnap.id);
          
          if (!docData.data || !docData.data.metadata) {
            console.error("Invalid assessment structure in document:", docSnap.id, docData);
            setError('Тапсырма деректері қате. Құрылымы дұрыс емес.');
            setLoading(false);
            return;
          }

          if (docData.data.metadata.mode !== 'online') {
            console.warn("Assessment is not in online mode:", docData.data.metadata.mode);
            setError('Бұл тапсырма онлайн режимде емес. Мұғалімнен онлайн режимді қосуды сұраңыз.');
            setLoading(false);
            return;
          }

          const rawData = docData.data;
          if (!rawData.tasks || !Array.isArray(rawData.tasks)) {
            console.error("Tasks missing or invalid in assessment data:", rawData);
            setError('Тапсырмалар табылмады немесе деректер қате.');
            setLoading(false);
            return;
          }

          // Deserialize mapConfig if it's a string
          const data = {
            ...rawData,
            id: docSnap.id,
            tasks: rawData.tasks.map((task: any) => {
              if (typeof task.mapConfig === 'string') {
                try {
                  return { ...task, mapConfig: JSON.parse(task.mapConfig) };
                } catch (e) {
                  console.error("Failed to parse mapConfig", e);
                }
              }
              return task;
            })
          } as AssessmentData;
          
          setAssessment(data);
        } else {
          console.error("No such document in library collection!");
          setError('Тапсырма табылмады. Сілтеме ескірген немесе қате болуы мүмкін.');
        }
      } catch (err: any) {
        console.error("Error fetching assessment:", err);
        if (err.message?.includes('permission')) {
          setError('Рұқсат жоқ. Тапсырма онлайн режимде екенін тексеріңіз.');
        } else {
          setError('Жүктеу кезінде қате шықты: ' + err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [assessmentId]);

  useEffect(() => {
    if (assessment) {
      const shuffled = assessment.tasks.map(task => {
        if (task.type === 'ordering' && task.orderingItems) {
          return { ...task, orderingItems: [...task.orderingItems].sort(() => Math.random() - 0.5) };
        }
        if (task.type === 'matching' && task.matchingPairs) {
          const lefts = task.matchingPairs.map(p => p.left);
          const rights = task.matchingPairs.map(p => p.right).sort(() => Math.random() - 0.5);
          return { ...task, displayPairs: { lefts, rights } };
        }
        return task;
      });
      setShuffledTasks(shuffled);
    }
  }, [assessment]);

  useEffect(() => {
    if (isStarted && !isSubmitted) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isStarted, isSubmitted]);

  const handleStart = async () => {
    if (!studentName.trim()) {
      setError('Аты-жөніңізді енгізіңіз');
      return;
    }

    setLoading(true);
    setError(null);

    const normalizedStudentName = studentName.trim();

    try {
      console.log("Checking for existing results for:", normalizedStudentName, "in assessment:", assessmentId);
      // Check if already submitted
      const resultsRef = collection(db, 'assessment_results');
      const q = query(resultsRef, where('assessmentId', '==', assessmentId));
      const querySnap = await getDocs(q);
      const existingDoc = querySnap.docs.find(doc => 
        doc.data().studentName.toLowerCase().trim() === normalizedStudentName
      );

      if (existingDoc) {
        console.log("Found existing result for student");
        setSubmittedResult(existingDoc.data());
        setIsSubmitted(true);
        setLoading(false);
        return;
      }

      // Check access code if students are defined
      if (assessment?.metadata.students && assessment.metadata.students.length > 0) {
        const student = assessment.metadata.students.find(s => 
          s.name.toLowerCase() === normalizedStudentName.toLowerCase() && 
          s.accessCode.toUpperCase() === accessCode.trim().toUpperCase()
        );
        
        if (!student) {
          setError('Аты-жөніңіз немесе кіру коды қате!');
          setLoading(false);
          return;
        }
        
        if (student.status === 'submitted') {
          // Try to find the result in DB using the official name from the list
          const qOfficial = query(
            resultsRef, 
            where('assessmentId', '==', assessmentId),
            where('studentName', '==', student.name)
          );
          const querySnapOfficial = await getDocs(qOfficial);
          if (!querySnapOfficial.empty) {
            setSubmittedResult(querySnapOfficial.docs[0].data());
          }
          setIsSubmitted(true);
          setLoading(false);
          return;
        }
      }

      setIsStarted(true);
    } catch (err: any) {
      console.error("Error starting assessment:", err);
      setError('Кіру кезінде қате шықты: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = React.useCallback((taskNumber: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [taskNumber]: answer }));
  }, []);

  const evaluateMapTask = (task: any, studentAnswer: string) => {
    if (!task.mapConfig || !studentAnswer) return null;
    
    try {
      const studentPoints = JSON.parse(studentAnswer);
      if (!Array.isArray(studentPoints) || studentPoints.length < 2) return null;

      const getDistance = (p1: any, p2: any) => {
        const from = turf.point([p1.lng, p1.lat]);
        const to = turf.point([p2.lng, p2.lat]);
        return turf.distance(from, to, { units: 'kilometers' });
      };

      if (task.type === 'map_territory' || task.type === 'map_draw') {
        const targetTerritory = task.mapConfig.territories?.[0];
        if (!targetTerritory) return null;

        const studentPoly = turf.polygon([[...studentPoints.map((p: any) => [p.lng, p.lat]), [studentPoints[0].lng, studentPoints[0].lat]]]);
        const targetPoly = turf.polygon([[...targetTerritory.correctBoundary.map((p: any) => [p[1], p[0]]), [targetTerritory.correctBoundary[0][1], targetTerritory.correctBoundary[0][0]]]]);

        const intersection = turf.intersect(turf.featureCollection([studentPoly, targetPoly]));
        if (!intersection) return { color: 'red', message: 'Шекаралар мүлдем сәйкес келмейді', accuracy: 0 };

        const intersectArea = turf.area(intersection);
        const targetArea = turf.area(targetPoly);
        const accuracy = (intersectArea / targetArea) * 100;

        if (accuracy >= 70) return { color: 'green', message: 'Өте жақсы! Шекаралар дәл көрсетілген.', accuracy };
        if (accuracy >= 65) return { color: 'yellow', message: 'Жақсы, бірақ дәлдікті арттыруға болады.', accuracy };
        return { color: 'red', message: 'Шекаралар қате көрсетілген.', accuracy };
      }

      if (task.type === 'map_route') {
        const targetRoute = task.mapConfig.routes?.[0];
        if (!targetRoute) return null;

        // Simple route check: check if start and end points are close
        const startDist = getDistance(studentPoints[0], { lat: targetRoute.correctPath[0][0], lng: targetRoute.correctPath[0][1] });
        const endDist = getDistance(studentPoints[studentPoints.length - 1], { lat: targetRoute.correctPath[targetRoute.correctPath.length - 1][0], lng: targetRoute.correctPath[targetRoute.correctPath.length - 1][1] });

        if (startDist < 100 && endDist < 100) {
          return { color: 'green', message: 'Бағыт дұрыс көрсетілген!', accuracy: 100 };
        }
        return { color: 'red', message: 'Бағыт немесе жол қате.', accuracy: 0 };
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const handleMapSubmit = (taskNumber: number) => {
    const task = shuffledTasks.find(t => t.number === taskNumber);
    const feedback = evaluateMapTask(task, answers[taskNumber]);
    if (feedback) {
      setMapFeedback(prev => ({ ...prev, [taskNumber]: feedback }));
      setAttempts(prev => ({ ...prev, [taskNumber]: (prev[taskNumber] || 0) + 1 }));
    }
  };

  const handleSubmit = async () => {
    if (!assessment) return;
    setSubmitting(true);

    const getDistance = (p1: {lat: number, lng: number}, p2: {lat: number, lng: number}) => {
      const R = 6371; // Earth radius in km
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLng = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    try {
      let totalScore = 0;
      const results = await Promise.all(assessment.tasks.map(async (task) => {
        const studentAnswer = (answers[task.number] || '').trim();
        let score = 0;

        // Auto-grading logic
        if (task.type === 'choice' || task.type === 'true_false') {
          if (task.correctAnswer && studentAnswer.toLowerCase() === task.correctAnswer.toLowerCase()) {
            score = task.maxPoint;
          }
        } else if (task.type === 'matching' || task.type === 'ordering') {
          if (task.correctAnswer && studentAnswer.replace(/\s/g, '').toLowerCase() === task.correctAnswer.replace(/\s/g, '').toLowerCase()) {
            score = task.maxPoint;
          }
        } else if (task.type === 'map_mark') {
          if (studentAnswer && task.correctAnswer) {
            try {
              const studentPoint = JSON.parse(studentAnswer);
              const targetPoint = JSON.parse(task.correctAnswer);
              const dist = getDistance(studentPoint, targetPoint);
              // If within 50km, full points (arbitrary threshold for "correct")
              if (dist < 50) score = task.maxPoint;
              else if (dist < 150) score = Math.ceil(task.maxPoint * 0.5);
            } catch (e) { console.error(e); }
          }
        } else if (task.type === 'map_territory' || task.type === 'map_route' || task.type === 'map_draw') {
          const feedback = evaluateMapTask(task, studentAnswer);
          if (feedback?.color === 'green') score = task.maxPoint;
          else if (feedback?.color === 'yellow') score = Math.ceil(task.maxPoint * 0.7);
          else if (feedback?.color === 'red' && (feedback.accuracy || 0) > 30) score = Math.ceil(task.maxPoint * 0.3);
        } else {
          // AI-assisted grading for subjective tasks (simplified)
          if (studentAnswer.length > 10) {
            score = Math.ceil(task.maxPoint * 0.7);
          } else if (studentAnswer.length > 0) {
            score = Math.ceil(task.maxPoint * 0.3);
          }
        }

        totalScore += score;
        return {
          taskNumber: task.number,
          answer: studentAnswer,
          score: score
        };
      }));

      const resultData = {
        assessmentId,
        studentName,
        answers: results,
        totalScore,
        maxScore: assessment.metadata.totalPoints,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'assessment_results'), resultData);

      setSubmittedResult(resultData);
      setIsSubmitted(true);
    } catch (err: any) {
      console.error("Submission error:", err);
      handleFirestoreError(err, OperationType.CREATE, 'assessment_results');
      setError('Жіберу кезінде қате шықты: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Жүктелуде...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
  if (!assessment) return null;

  if (isSubmitted) {
    const scorePercent = Math.round(((submittedResult?.totalScore || 0) / (submittedResult?.maxScore || assessment.metadata.totalPoints)) * 100);
    
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card card-pad text-center mb-8">
            <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Жауаптарыңыз қабылданды!</h2>
            <p className="text-slate-500 mb-6">Рахмет, {studentName}. Сіздің нәтижеңіз төменде көрсетілген.</p>
            
            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Сіздің балыңыз</div>
                <div className="text-4xl font-black text-purple-600">{submittedResult?.totalScore || 0}</div>
              </div>
              <div className="text-center border-l border-slate-200 dark:border-slate-800 pl-8">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Максималды балл</div>
                <div className="text-4xl font-black text-slate-400">{submittedResult?.maxScore || assessment.metadata.totalPoints}</div>
              </div>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${scorePercent}%` }}
                className={`h-full ${scorePercent >= 80 ? 'bg-green-500' : scorePercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              />
            </div>
            <div className="text-sm font-bold text-slate-500">Дәлдік: {scorePercent}%</div>
          </motion.div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg px-2">Тапсырмалар бойынша есеп:</h3>
            {submittedResult?.answers?.map((ans: any) => (
              <div key={ans.taskNumber} className="card card-pad flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">
                    {ans.taskNumber}
                  </div>
                  <div>
                    <div className="font-medium">Тапсырма №{ans.taskNumber}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{ans.answer}</div>
                  </div>
                </div>
                <div className="font-bold text-purple-600">
                  {ans.score} балл
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary w-full mt-8" onClick={() => {
            localStorage.setItem('activeTab', 'dashboard');
            window.location.href = getBaseUrl();
          }}>Басты бетке өту</button>
        </div>
      </div>
    );
  }

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="card card-pad max-w-md w-full">
          <div className="w-48 mx-auto mb-8">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">{assessment.metadata.type}</h1>
          <p className="text-center text-slate-500 mb-8">{assessment.metadata.subject}, {assessment.metadata.grade}-сынып</p>
          
          <div className="fg mb-4">
            <label className="flabel">Аты-жөніңізді енгізіңіз</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                className="inp !pl-14" 
                placeholder="Мысалы: Асқарұлы Данияр" 
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
              />
            </div>
          </div>

          {assessment.metadata.students && assessment.metadata.students.length > 0 && (
            <div className="fg mb-8">
              <label className="flabel">Кіру коды</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  className="inp !pl-14 text-center font-mono font-bold tracking-widest uppercase" 
                  placeholder="XXXXXX" 
                  maxLength={6}
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value)}
                />
              </div>
            </div>
          )}
          
          <button className="btn btn-primary w-full py-4 text-lg" onClick={handleStart}>
            Бастау
          </button>
        </div>
      </div>
    );
  }

  const currentTask = shuffledTasks[currentTaskIdx];

  if (!currentTask) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="font-bold text-lg">{assessment.metadata.topic}</h2>
            <p className="text-xs text-slate-500">{studentName}</p>
          </div>
          <div className="text-sm font-bold bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800">
            {currentTaskIdx + 1} / {assessment.tasks.length}
          </div>
        </div>

        <div className="card card-pad mb-8 min-h-[300px] flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <span className="badge b-purple">Тапсырма №{currentTask.number}</span>
            <span className="text-xs text-slate-400">Макс: {currentTask.maxPoint} балл</span>
          </div>

          <div className="text-lg mb-8 whitespace-pre-wrap">{currentTask.task}</div>

          {currentTask.imageUrl && (
            <div className="mb-8 max-w-2xl mx-auto">
              <img 
                src={currentTask.imageUrl} 
                alt={`Тапсырма ${currentTask.number}`} 
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" 
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {currentTask.type === 'choice' && currentTask.options && (
            <div className="grid grid-cols-1 gap-3">
              {currentTask.options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                return (
                  <button 
                    key={idx}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${answers[currentTask.number] === letter ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-purple-200'}`}
                    onClick={() => handleAnswerChange(currentTask.number, letter)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${answers[currentTask.number] === letter ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {letter}
                    </div>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {currentTask.type === 'true_false' && (
            <div className="grid grid-cols-2 gap-4">
              {['Ақиқат', 'Жалған'].map((opt) => (
                <button 
                  key={opt}
                  className={`p-6 rounded-xl border-2 text-center font-bold transition-all ${answers[currentTask.number] === opt ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-purple-200'}`}
                  onClick={() => handleAnswerChange(currentTask.number, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentTask.type === 'ordering' && currentTask.orderingItems && (
            <div className="space-y-4">
              <div className="space-y-2">
                {currentTask.orderingItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                    {item}
                  </div>
                ))}
              </div>
              <div className="fg">
                <label className="flabel">Дұрыс реттілікті жазыңыз (мысалы: 3, 1, 4, 2)</label>
                <input 
                  type="text" 
                  className="inp" 
                  placeholder="3, 1, 4, 2..." 
                  value={answers[currentTask.number] || ''}
                  onChange={e => handleAnswerChange(currentTask.number, e.target.value)}
                />
              </div>
            </div>
          )}

          {currentTask.type === 'matching' && currentTask.displayPairs && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-8 mb-4">
                <div className="space-y-2">
                  <div className="font-bold text-slate-500 text-xs uppercase">Сол жақ</div>
                  {currentTask.displayPairs.lefts.map((left: string, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm border border-slate-200 dark:border-slate-700">
                      <span className="font-bold mr-2">{idx + 1}.</span> {left}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="font-bold text-slate-500 text-xs uppercase">Оң жақ</div>
                  {currentTask.displayPairs.rights.map((right: string, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm border border-slate-200 dark:border-slate-700">
                      <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {right}
                    </div>
                  ))}
                </div>
              </div>
              <div className="fg">
                <label className="flabel">Сәйкестікті жазыңыз (мысалы: 1-A, 2-B, 3-C)</label>
                <input 
                  type="text" 
                  className="inp" 
                  placeholder="1-A, 2-B..." 
                  value={answers[currentTask.number] || ''}
                  onChange={e => handleAnswerChange(currentTask.number, e.target.value)}
                />
              </div>
            </div>
          )}

          {currentTask.type === 'cards' && currentTask.cards && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {currentTask.cards.map((card, idx) => (
                  <div key={idx} className="p-6 bg-white dark:bg-slate-900 rounded-2xl border-2 border-purple-100 dark:border-purple-900 shadow-sm flex items-center justify-center text-center min-h-[120px]">
                    <div className="font-medium">{card}</div>
                  </div>
                ))}
              </div>
              <textarea 
                className="inp min-h-[120px]" 
                placeholder="Карточкалардағы ақпарат бойынша жауабыңызды жазыңыз..."
                value={answers[currentTask.number] || ''}
                onChange={e => handleAnswerChange(currentTask.number, e.target.value)}
              ></textarea>
            </div>
          )}

          {(currentTask.type === 'text' || currentTask.type === 'table' || !currentTask.type) && (
            <textarea 
              className="inp flex-1 min-h-[150px]" 
              placeholder="Жауабыңызды осында жазыңыз..."
              value={answers[currentTask.number] || ''}
              onChange={e => handleAnswerChange(currentTask.number, e.target.value)}
            ></textarea>
          )}

          {currentTask.type === 'map' && (
             <div className="space-y-4">
               <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <MapComponent query={currentTask.mapUrl || ''} interactive={false} />
               </div>
               <textarea 
                className="inp min-h-[100px]" 
                placeholder="Карта бойынша жауабыңызды жазыңыз..."
                value={answers[currentTask.number] || ''}
                onChange={e => handleAnswerChange(currentTask.number, e.target.value)}
              ></textarea>
             </div>
          )}

          {currentTask.type === 'map_mark' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 italic">Картадан қажетті нүктені белгілеңіз:</p>
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <MapComponent 
                  query={currentTask.mapUrl || ''} 
                  mode="mark" 
                  onMark={(latlng) => handleAnswerChange(currentTask.number, JSON.stringify(latlng))}
                  initialMarkers={answers[currentTask.number] ? [JSON.parse(answers[currentTask.number])] : []}
                />
              </div>
            </div>
          )}

          {currentTask.type === 'map_territory' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 italic">{currentTask.task}</p>
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <MapComponent 
                  query={currentTask.mapUrl || ''} 
                  mode="draw" 
                  center={currentTask.mapConfig?.center}
                  zoom={currentTask.mapConfig?.zoom}
                  onDraw={(points) => handleAnswerChange(currentTask.number, JSON.stringify(points))}
                  initialPolygons={answers[currentTask.number] ? [{ 
                    points: JSON.parse(answers[currentTask.number]), 
                    color: mapFeedback[currentTask.number]?.color === 'green' ? (currentTask.mapConfig?.territories?.[0]?.color || 'green') : 
                           mapFeedback[currentTask.number]?.color === 'yellow' ? 'yellow' : 'red' 
                  }] : []}
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm">
                  Талпыныс: <span className="font-bold">{attempts[currentTask.number] || 0} / 3</span>
                </div>
                {(!attempts[currentTask.number] || attempts[currentTask.number] < 3) && (
                  <button 
                    className="btn btn-sm btn-primary" 
                    onClick={() => handleMapSubmit(currentTask.number)}
                    disabled={!answers[currentTask.number]}
                  >
                    Тексеру
                  </button>
                )}
              </div>
              {mapFeedback[currentTask.number] && (
                <div className={`p-3 rounded-lg text-sm font-medium ${
                  mapFeedback[currentTask.number].color === 'green' ? 'bg-green-100 text-green-700' :
                  mapFeedback[currentTask.number].color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {mapFeedback[currentTask.number].message} 
                  {mapFeedback[currentTask.number].accuracy !== undefined && ` (Дәлдік: ${Math.round(mapFeedback[currentTask.number].accuracy)}%)`}
                </div>
              )}
            </div>
          )}

          {currentTask.type === 'map_route' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 italic">{currentTask.task}</p>
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <MapComponent 
                  query={currentTask.mapUrl || ''} 
                  mode="route" 
                  center={currentTask.mapConfig?.center}
                  zoom={currentTask.mapConfig?.zoom}
                  onRouteDraw={(points) => handleAnswerChange(currentTask.number, JSON.stringify(points))}
                  initialRoutes={answers[currentTask.number] ? [{ 
                    points: JSON.parse(answers[currentTask.number]), 
                    color: mapFeedback[currentTask.number]?.color === 'green' ? (currentTask.mapConfig?.routes?.[0]?.color || 'blue') : 'red' 
                  }] : []}
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm">
                  Талпыныс: <span className="font-bold">{attempts[currentTask.number] || 0} / 3</span>
                </div>
                {(!attempts[currentTask.number] || attempts[currentTask.number] < 3) && (
                  <button 
                    className="btn btn-sm btn-primary" 
                    onClick={() => handleMapSubmit(currentTask.number)}
                    disabled={!answers[currentTask.number]}
                  >
                    Тексеру
                  </button>
                )}
              </div>
              {mapFeedback[currentTask.number] && (
                <div className={`p-3 rounded-lg text-sm font-medium ${
                  mapFeedback[currentTask.number].color === 'green' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {mapFeedback[currentTask.number].message}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <button 
            className="btn btn-ghost" 
            disabled={currentTaskIdx === 0}
            onClick={() => setCurrentTaskIdx(prev => prev - 1)}
          >
            <ChevronLeft size={18} className="mr-2" /> Алдыңғы
          </button>

          {currentTaskIdx === assessment.tasks.length - 1 ? (
            <button className="btn btn-primary bg-purple-600 px-8" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Жіберілуде...' : 'Аяқтау'} <Send size={18} className="ml-2" />
            </button>
          ) : (
            <button className="btn btn-primary bg-purple-600 px-8" onClick={() => setCurrentTaskIdx(prev => prev + 1)}>
              Келесі <ChevronRight size={18} className="ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAssessmentView;
