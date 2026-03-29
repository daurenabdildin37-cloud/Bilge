
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  Monitor, 
  X,
  Users, 
  Settings2,
  Battery,
  Star,
  Heart,
  Coins,
  Zap,
  Trophy,
  Brain,
  Flame,
  Target,
  Leaf,
  Trash2,
  UserPlus,
  Save,
  Share2
} from 'lucide-react';
import { BatteryGrading } from '../components/GradingSimulator/BatteryGrading';
import { StarGrading } from '../components/GradingSimulator/StarGrading';
import { HeartGrading } from '../components/GradingSimulator/HeartGrading';
import { CoinGrading } from '../components/GradingSimulator/CoinGrading';
import { ProgressBarGrading } from '../components/GradingSimulator/ProgressBarGrading';
import { PointGrading } from '../components/GradingSimulator/PointGrading';
import { BrainGrading } from '../components/GradingSimulator/BrainGrading';
import { TrophyGrading } from '../components/GradingSimulator/TrophyGrading';
import { GrowthGrading } from '../components/GradingSimulator/GrowthGrading';
import { EnergyGrading } from '../components/GradingSimulator/EnergyGrading';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/error-handling';

export type GradingType = 
  | 'battery' 
  | 'stars' 
  | 'hearts' 
  | 'coins' 
  | 'progress' 
  | 'points' 
  | 'brain' 
  | 'trophy' 
  | 'growth' 
  | 'energy';

interface Student {
  id: string;
  name: string;
  score: number;
}

interface GradingSimulatorProps {
  initialData?: {
    id?: string;
    students: Student[];
    gradingType: GradingType;
    title?: string;
  };
  isPublic?: boolean;
  addNotification?: (title: string, message: string, type?: any) => void;
  showToast?: (message: string) => void;
}

const MOCK_STUDENTS: Student[] = [
  { id: '1', name: 'Алихан Б.', score: 50 },
  { id: '2', name: 'Мадина С.', score: 80 },
  { id: '3', name: 'Нұрсұлтан Қ.', score: 30 },
  { id: '4', name: 'Аружан М.', score: 95 },
  { id: '5', name: 'Темірлан А.', score: 60 },
];

const GradingSimulatorView: React.FC<GradingSimulatorProps> = ({ initialData, isPublic, addNotification, showToast }) => {
  const [students, setStudents] = useState<Student[]>(() => {
    if (initialData?.students) return initialData.students;
    const saved = localStorage.getItem('grading_students');
    return saved ? JSON.parse(saved) : MOCK_STUDENTS;
  });
  const [gradingType, setGradingType] = useState<GradingType>(() => {
    if (initialData?.gradingType) return initialData.gradingType;
    return (localStorage.getItem('grading_type') as GradingType) || 'battery';
  });
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState(initialData?.title || 'Жаңа бағалау');

  useEffect(() => {
    if (!initialData && !isPublic) {
      localStorage.setItem('grading_students', JSON.stringify(students));
    }
  }, [students, initialData, isPublic]);

  useEffect(() => {
    if (!initialData && !isPublic) {
      localStorage.setItem('grading_type', gradingType);
    }
  }, [gradingType, initialData, isPublic]);

  const updateScore = (id: string, delta: number) => {
    setStudents(prev => prev.map(s => {
      if (s.id === id) {
        const newScore = Math.min(100, Math.max(0, s.score + delta));
        return { ...s, score: newScore };
      }
      return s;
    }));
  };

  const resetScores = () => {
    setStudents(prev => prev.map(s => ({ ...s, score: 0 })));
    showToast?.('Ұпайлар нөлге түсірілді! 🔄');
  };

  const addStudent = () => {
    if (newStudentName.trim()) {
      const newStudent: Student = {
        id: Date.now().toString(),
        name: newStudentName.trim(),
        score: 0
      };
      setStudents(prev => [...prev, newStudent]);
      setNewStudentName('');
      setShowAddStudent(false);
    }
  };

  const removeStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    showToast?.('Оқушы жойылды! 🗑️');
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      addNotification?.('Қате ❌', 'Сақтау үшін жүйеге кіру қажет.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const itemData: any = {
        userId: user.uid,
        type: 'Бағалау',
        title: title || 'Бағалау симуляторы',
        subject: 'Бағалау',
        grade: 'Кез келген',
        date: new Date().toLocaleDateString('kk-KZ'),
        updatedAt: serverTimestamp(),
        data: {
          students,
          gradingType,
          title: title || 'Бағалау симуляторы',
          metadata: {
            mode: 'online'
          }
        }
      };

      if (initialData?.id && !isPublic) {
        // Update existing
        await updateDoc(doc(db, 'library', initialData.id), itemData);
        showToast?.('Өзгерістер сақталды! ✅');
        addNotification?.('Жаңартылды! ✅', 'Бағалау сәтті жаңартылды.', 'success');
      } else {
        // Create new
        itemData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'library'), itemData);
        showToast?.('Сақталды! ✅');
        addNotification?.('Сақталды! ✅', 'Бағалау кітапханаға сәтті қосылды.', 'success');
      }
    } catch (err) {
      console.error("Save failed", err);
      showToast?.('Қате ❌ Сақтау мүмкін болмады.');
      handleFirestoreError(err, OperationType.WRITE, 'library');
    } finally {
      setIsSaving(false);
    }
  };

  const gradingOptions = [
    { id: 'battery', label: 'Батарея', icon: <Battery size={18} /> },
    { id: 'stars', label: 'Жұлдыздар', icon: <Star size={18} /> },
    { id: 'hearts', label: 'Жүректер', icon: <Heart size={18} /> },
    { id: 'coins', label: 'Монеталар', icon: <Coins size={18} /> },
    { id: 'progress', label: 'Прогресс', icon: <Flame size={18} /> },
    { id: 'points', label: 'Ұпайлар', icon: <Target size={18} /> },
    { id: 'brain', label: 'Ми деңгейі', icon: <Brain size={18} /> },
    { id: 'trophy', label: 'Кубоктар', icon: <Trophy size={18} /> },
    { id: 'growth', label: 'Өсімдік', icon: <Leaf size={18} /> },
    { id: 'energy', label: 'Энергия', icon: <Zap size={18} /> },
  ];

  const renderGradingComponent = (score: number) => {
    switch (gradingType) {
      case 'battery': return <BatteryGrading score={score} />;
      case 'stars': return <StarGrading score={score} />;
      case 'hearts': return <HeartGrading score={score} />;
      case 'coins': return <CoinGrading score={score} />;
      case 'progress': return <ProgressBarGrading score={score} />;
      case 'points': return <PointGrading score={score} />;
      case 'brain': return <BrainGrading score={score} />;
      case 'trophy': return <TrophyGrading score={score} />;
      case 'growth': return <GrowthGrading score={score} />;
      case 'energy': return <EnergyGrading score={score} />;
      default: return <BatteryGrading score={score} />;
    }
  };

  return (
    <div className={`transition-all duration-500 flex flex-col ${
      isProjectorMode 
        ? 'fixed inset-0 z-[100] bg-slate-950 p-8 md:p-12 overflow-hidden' 
        : 'h-full p-4 md:p-6 overflow-hidden'
    }`}>
      {/* Header Controls */}
      <div className={`flex flex-wrap items-center justify-between gap-4 mb-6 shrink-0 ${isProjectorMode ? 'max-w-7xl mx-auto w-full' : ''}`}>
        <div className="flex-1 min-w-[200px]">
          {isPublic ? (
            <h1 className={`font-black tracking-tight leading-tight ${isProjectorMode ? 'text-4xl md:text-5xl text-white' : 'text-xl md:text-2xl text-slate-900'}`}>
              {title}
            </h1>
          ) : (
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`font-black tracking-tight leading-tight bg-transparent border-none outline-none w-full ${isProjectorMode ? 'text-4xl md:text-5xl text-white' : 'text-xl md:text-2xl text-slate-900'}`}
              placeholder="Бағалау атауы..."
            />
          )}
          {!isProjectorMode && (
            <p className="text-slate-500 text-xs md:text-sm">
              Сабақ барысында оқушыларды қызықты әрі көрнекі түрде бағалаңыз
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {!isPublic && (
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="btn bg-blue-600 text-white hover:bg-blue-700 border-none flex items-center gap-2 h-10 md:h-12 px-3 md:px-4 rounded-xl font-bold text-sm disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? 'Сақталуда...' : 'Сақтау'}
            </button>
          )}
          
          <button 
            onClick={() => setIsProjectorMode(!isProjectorMode)}
            className={`btn flex items-center gap-2 transition-all ${
              isProjectorMode 
                ? 'h-12 md:h-14 px-4 md:px-6 rounded-2xl font-bold text-base md:text-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xl shadow-rose-500/30' 
                : 'h-10 md:h-12 px-3 md:px-4 rounded-xl font-bold text-sm bg-white border-slate-200 text-slate-700 shadow-sm hover:shadow-md'
            }`}
          >
            {isProjectorMode ? <X size={isProjectorMode ? 24 : 20} /> : <Monitor size={20} />}
            {isProjectorMode ? 'Жабу' : 'Проектор режимі'}
          </button>
          
          {!isProjectorMode && !isPublic && (
            <button 
              onClick={resetScores}
              className="btn bg-slate-100 text-slate-600 hover:bg-slate-200 border-none flex items-center gap-2 h-10 md:h-12 px-3 md:px-4 rounded-xl font-bold text-sm"
            >
              <RotateCcw size={18} />
              Тазалау
            </button>
          )}
        </div>
      </div>

      {/* Settings Bar - Hidden in Projector Mode to focus on students */}
      {!isProjectorMode && !isPublic && (
        <div className="mb-6 p-3 md:p-4 rounded-2xl border bg-white border-slate-200 shadow-sm shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                Бағалау түрі:
              </span>
              <div className="flex gap-1.5">
                {gradingOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setGradingType(opt.id as GradingType)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      gradingType === opt.id
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowAddStudent(!showAddStudent)}
                className="btn btn-sm h-9 px-3 flex items-center gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 rounded-lg text-xs font-bold"
              >
                <UserPlus size={14} />
                Оқушы қосу
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showAddStudent && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-3 border-t border-slate-200/50 flex gap-2">
                  <input 
                    type="text" 
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Оқушының аты-жөні..."
                    className="flex-1 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-slate-50 border-slate-200 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && addStudent()}
                  />
                  <button onClick={addStudent} className="btn btn-sm bg-blue-600 text-white border-none px-4 rounded-lg">Қосу</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Students Grid - Scrolling grid with fixed columns for better readability */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar p-4">
        {students.length > 0 ? (
          <div 
            className="grid w-full gap-6 md:gap-8"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(${isProjectorMode ? '400px' : '350px'}, 1fr))`,
              maxWidth: '1600px',
              margin: '0 auto'
            }}
          >
            <AnimatePresence mode="popLayout">
              {students.map((student) => {
                // Fixed scale factor for readability since we now scroll
                const scaleFactor = isProjectorMode ? 1.4 : 1.2;
                const cardPadding = isProjectorMode ? 2.5 : 2;

                return (
                  <motion.div
                    key={student.id}
                    layout
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className={`relative group rounded-[1.5rem] md:rounded-[2rem] border transition-all duration-300 flex flex-col items-center justify-center overflow-hidden min-h-[400px] md:min-h-[500px] w-full ${
                      isProjectorMode 
                        ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                        : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                    }`}
                    style={{
                      padding: `${cardPadding}rem`,
                    }}
                  >
                    {!isProjectorMode && !isPublic && (
                      <button 
                        onClick={() => removeStudent(student.id)}
                        className="absolute top-1 right-1 p-1 rounded-full transition-all text-slate-300 hover:text-rose-500 hover:bg-rose-50 z-10"
                        title="Оқушыны жою"
                      >
                        <Trash2 size={Math.max(10, scaleFactor * 16)} />
                      </button>
                    )}

                      <div className="flex flex-col items-center text-center w-full h-full justify-between min-h-0">
                        <h3 
                          className={`font-black truncate w-full transition-all shrink-0 ${
                            isProjectorMode ? 'text-white' : 'text-slate-800'
                          }`}
                          style={{
                            fontSize: `${scaleFactor * (isProjectorMode ? 2.2 : 1.6)}rem`,
                            lineHeight: 1.2,
                            marginBottom: `${scaleFactor * 0.5}rem`
                          }}
                        >
                          {student.name}
                        </h3>

                        <div 
                          className={`rounded-2xl md:rounded-3xl flex items-center justify-center font-black transition-all shrink-0 ${
                            isProjectorMode 
                              ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg' 
                              : 'bg-slate-100 text-slate-700'
                          }`}
                          style={{
                            width: `${scaleFactor * (isProjectorMode ? 5 : 4)}rem`,
                            height: `${scaleFactor * (isProjectorMode ? 5 : 4)}rem`,
                            fontSize: `${scaleFactor * (isProjectorMode ? 2.5 : 2)}rem`,
                            marginBottom: `${scaleFactor * 0.5}rem`
                          }}
                        >
                          {student.name.charAt(0)}
                        </div>

                        <div 
                          className="w-full flex justify-center items-center transition-all shrink min-h-0"
                          style={{
                            transform: `scale(${scaleFactor * (isProjectorMode ? 1.5 : 1.3)})`,
                            height: `${scaleFactor * (isProjectorMode ? 200 : 160)}px`,
                            marginBottom: `${scaleFactor * 0.5}rem`
                          }}
                        >
                          {renderGradingComponent(student.score)}
                        </div>

                        <div className="flex items-center gap-3 md:gap-4 w-full shrink-0 mt-auto">
                          <button 
                            onClick={() => updateScore(student.id, -10)}
                            className={`flex-1 rounded-xl md:rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                              isProjectorMode 
                                ? 'bg-white/10 text-white hover:bg-white/20' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            style={{ height: `${scaleFactor * (isProjectorMode ? 4 : 3)}rem` }}
                          >
                            <Minus size={isProjectorMode ? 32 : 24} />
                          </button>
                          
                          <div className={`text-center transition-all ${isProjectorMode ? 'text-white' : 'text-slate-900'}`} style={{ minWidth: `${scaleFactor * 60}px` }}>
                            <div className="font-black leading-none" style={{ fontSize: `${scaleFactor * (isProjectorMode ? 2.5 : 1.8)}rem` }}>
                              {student.score}
                            </div>
                            <div className="font-bold uppercase tracking-widest opacity-40" style={{ fontSize: `${scaleFactor * 10}px`, marginTop: '4px' }}>
                              Ұпай
                            </div>
                          </div>

                          <button 
                            onClick={() => updateScore(student.id, 10)}
                            className={`flex-1 rounded-xl md:rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                              isProjectorMode 
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-500/20' 
                                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/10'
                            }`}
                            style={{ height: `${scaleFactor * (isProjectorMode ? 4 : 3)}rem` }}
                          >
                            <Plus size={isProjectorMode ? 32 : 24} />
                          </button>
                        </div>
                      </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-800">Оқушылар тізімі бос</h3>
            <p className="text-slate-500 text-sm max-w-xs">Жоғарыдағы батырма арқылы оқушыларды қосыңыз</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradingSimulatorView;
