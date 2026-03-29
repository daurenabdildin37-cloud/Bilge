
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Save, 
  Clock, 
  MapPin, 
  Users, 
  BookOpen,
  AlertCircle,
  LayoutGrid,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCalendar, DAY_KEYS, DayKey, Lesson, fmt, addDays } from '../hooks/useCalendar';

const DAY_NAMES_KZ: Record<DayKey, string> = {
  monday: 'Дүйсенбі',
  tuesday: 'Сейсенбі',
  wednesday: 'Сәрсенбі',
  thursday: 'Бейсенбі',
  friday: 'Жұма',
  saturday: 'Сенбі'
};

interface LessonSetupFormProps {
  onSave: (lesson: Omit<Lesson, 'id'>) => void;
  onClose: () => void;
  initialData?: Omit<Lesson, 'id'>;
}

const LessonSetupForm: React.FC<LessonSetupFormProps> = ({ onSave, onClose, initialData }) => {
  const [time, setTime] = useState(initialData?.time || '08:00');
  const [cabinet, setCabinet] = useState(initialData?.cabinet || '');
  const [grade, setGrade] = useState(initialData?.grade || '');
  const [subject, setSubject] = useState(initialData?.subject || '');

  return (
    <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2rem] border-2 border-blue-100 dark:border-blue-900/30 space-y-5" translate="no">
      <div className="grid grid-cols-2 gap-4">
        <div className="fg">
          <label className="flabel mb-1.5 text-[10px]">Уақыты</label>
          <input 
            type="time" 
            className="inp h-12 rounded-xl text-sm font-bold" 
            translate="no" 
            autoComplete="off" 
            value={time} 
            onChange={e => setTime(e.target.value)} 
          />
        </div>
        <div className="fg">
          <label className="flabel mb-1.5 text-[10px]">Кабинет</label>
          <input 
            className="inp h-12 rounded-xl text-sm font-bold" 
            placeholder="412" 
            translate="no" 
            autoComplete="off" 
            value={cabinet} 
            onChange={e => setCabinet(e.target.value)} 
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="fg">
          <label className="flabel mb-1.5 text-[10px]">Сынып</label>
          <input 
            className="inp h-12 rounded-xl text-sm font-bold" 
            placeholder="7А" 
            translate="no" 
            autoComplete="off" 
            value={grade} 
            onChange={e => setGrade(e.target.value)} 
          />
        </div>
        <div className="fg">
          <label className="flabel mb-1.5 text-[10px]">Пән</label>
          <input 
            className="inp h-12 rounded-xl text-sm font-bold" 
            placeholder="Тарих" 
            translate="no" 
            autoComplete="off" 
            value={subject} 
            onChange={e => setSubject(e.target.value)} 
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button className="btn btn-ghost flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={onClose}>Болдырмау</button>
        <button 
          className="btn btn-primary flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20" 
          onClick={() => onSave({ time, cabinet, grade, subject })}
        >
          Сақтау
        </button>
      </div>
    </div>
  );
};

interface DaySetupCardProps {
  dayKey: DayKey;
  lessons: Lesson[];
  onAdd: (dayKey: DayKey, lesson: Omit<Lesson, 'id'>) => void;
  onRemove: (dayKey: DayKey, lessonId: string) => void;
}

const DaySetupCard: React.FC<DaySetupCardProps> = ({ dayKey, lessons, onAdd, onRemove }) => {
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showForm && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [showForm]);

  return (
    <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col min-h-[400px]">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 rounded-t-[1.5rem]">
        <h3 className="font-black text-lg text-slate-800 dark:text-slate-200">{DAY_NAMES_KZ[dayKey]}</h3>
        <button 
          className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95"
          onClick={() => setShowForm(true)}
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="p-5 space-y-4 flex-1">
        {showForm && (
          <div ref={formRef}>
            <LessonSetupForm
              onSave={l => { onAdd(dayKey, l); setShowForm(false); }}
              onClose={() => setShowForm(false)}
            />
          </div>
        )}

        {lessons.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 text-sm border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
            Сабақтар жоқ
          </div>
        ) : (
          lessons.map(lesson => (
            <div key={lesson.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group relative hover:border-blue-200 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">{lesson.time}</span>
                <button 
                  className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all"
                  onClick={() => onRemove(dayKey, lesson.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="font-black text-sm text-slate-800 dark:text-slate-200 mb-2">{lesson.subject}</div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500 font-bold">
                <span>{lesson.grade} сынып</span>
                <span>{lesson.cabinet} каб.</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const CalendarView = () => {
  const {
    weekCycle,
    currentWeekStart,
    isSettingUp,
    setIsSettingUp,
    setupDays,
    saveNewCycle,
    endCycle,
    addLessonToSetup,
    removeLessonFromSetup,
    updateLessonInSetup,
    addLessonToActive,
    removeLessonFromActive,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
  } = useCalendar();

  const [editingLesson, setEditingLesson] = useState<{ dayKey: DayKey, lesson: Lesson } | null>(null);
  const [showAddModal, setShowAddModal] = useState<DayKey | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'diary'>('grid');

  const [newLesson, setNewLesson] = useState<Omit<Lesson, 'id'>>({
    time: '08:00',
    cabinet: '',
    grade: '',
    subject: ''
  });

  const handleAddLesson = () => {
    if (showAddModal) {
      if (isSettingUp) {
        addLessonToSetup(showAddModal, newLesson);
      } else if (weekCycle) {
        addLessonToActive(weekCycle.id, showAddModal, newLesson);
      }
      setShowAddModal(null);
      setNewLesson({ time: '08:00', cabinet: '', grade: '', subject: '' });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fu space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Күнтізбе</h1>
            <p className="text-sm text-slate-500 font-medium">Сабақ кестесі мен тақырыптарды басқару</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isSettingUp ? (
            <button 
              className={`btn ${weekCycle ? 'btn-ghost border-red-200 text-red-600 hover:bg-red-50' : 'btn-primary'} px-6 py-3`}
              onClick={endCycle}
            >
              {weekCycle ? (
                <><AlertCircle size={20} /> Циклді тоқтату</>
              ) : (
                <><Plus size={20} /> Кесте орнату</>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button className="btn btn-ghost px-6" onClick={() => setIsSettingUp(false)}>Болдырмау</button>
              <button className="btn btn-primary px-6" onClick={saveNewCycle}>
                <Save size={18} /> Кестені сақтау
              </button>
            </div>
          )}
        </div>
      </div>

      {isSettingUp ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DAY_KEYS.map(dayKey => (
            <DaySetupCard
              key={dayKey}
              dayKey={dayKey}
              lessons={setupDays.find(d => d.dayKey === dayKey)?.lessons || []}
              onAdd={addLessonToSetup}
              onRemove={removeLessonFromSetup}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Week Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mr-2">
                <button 
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400'}`}
                  onClick={() => setViewMode('grid')}
                  title="Тор көрінісі"
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  className={`p-2 rounded-lg transition-all ${viewMode === 'diary' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400'}`}
                  onClick={() => setViewMode('diary')}
                  title="Күнделік көрінісі"
                >
                  <List size={18} />
                </button>
              </div>
              <button className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors" onClick={goToPrevWeek}>
                <ChevronLeft size={20} />
              </button>
              <div className="text-center px-4">
                <div className="font-black text-lg text-slate-800 dark:text-slate-200">
                  {new Date(currentWeekStart).toLocaleDateString('kk-KZ', { month: 'long', day: 'numeric' })} - 
                  {addDays(currentWeekStart, 5).toLocaleDateString('kk-KZ', { month: 'long', day: 'numeric' })}
                </div>
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Апталық кесте</div>
              </div>
              <button className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors" onClick={goToNextWeek}>
                <ChevronRight size={20} />
              </button>
            </div>
            <button className="btn btn-ghost px-6 font-black text-xs uppercase tracking-widest" onClick={goToToday}>Бүгін</button>
          </div>

          {!weekCycle ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 text-center px-8 shadow-sm">
              <h3 className="text-2xl font-black mb-3">Бұл аптаға кесте орнатылмаған</h3>
              <p className="text-slate-500 max-w-sm mb-8 font-medium">Жұмысты бастау үшін оң жақ жоғарғы бұрыштағы "Жаңа кесте орнату" батырмасын басыңыз.</p>
              <button className="btn btn-primary px-8 py-3" onClick={endCycle}>
                <Plus size={20} /> Кесте орнату
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5" 
              : "grid grid-cols-1 md:grid-cols-3 gap-6"
            }>
              {DAY_KEYS.map((dayKey, idx) => {
                const dayDate = addDays(currentWeekStart, idx);
                const isToday = fmt(dayDate) === fmt(new Date());
                const daySchedule = weekCycle.days.find(d => d.dayKey === dayKey);

                return (
                  <div key={dayKey} className={`flex flex-col rounded-3xl border transition-all duration-300 ${isToday ? 'bg-blue-50/40 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 ring-2 ring-blue-100 dark:ring-blue-900/30' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'}`}>
                    <div className={`p-5 text-center border-b relative ${isToday ? 'border-blue-200 dark:border-blue-800 bg-blue-100/30 dark:bg-blue-900/20 rounded-t-3xl' : 'border-slate-100 dark:border-slate-800'}`}>
                      <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                        {DAY_NAMES_KZ[dayKey]}
                      </div>
                      <div className={`text-2xl font-black ${isToday ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {dayDate.getDate()}
                      </div>
                      <button 
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg active:scale-95 z-20"
                        onClick={() => setShowAddModal(dayKey)}
                        title="Сабақ қосу"
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="p-3 space-y-3 flex-1">
                      {daySchedule?.lessons.map(lesson => (
                        <div key={lesson.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group relative">
                          <button 
                            className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg z-10"
                            onClick={() => removeLessonFromActive(weekCycle.id, dayKey, lesson.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                          <div className="flex justify-between items-start mb-2">
                            <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">{lesson.time}</span>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-lg">{lesson.cabinet} каб.</span>
                          </div>
                          <div className="font-black text-sm text-slate-800 dark:text-slate-200 mb-1 leading-tight">{lesson.subject}</div>
                          <div className="text-[10px] font-bold text-slate-500">{lesson.grade} сынып</div>
                        </div>
                      ))}
                      {(!daySchedule || daySchedule.lessons.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest italic opacity-50">
                          Бос күн
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Lesson Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <h3 className="text-2xl font-black mb-8 text-slate-800 dark:text-slate-100">
                Сабақ қосу
              </h3>
              
              <div className="space-y-6" translate="no">
                <div className="fg">
                  <label className="flabel mb-2">Уақыты</label>
                  <input 
                    type="time" 
                    className="inp h-14 rounded-2xl border-slate-200 dark:border-slate-700 focus:border-blue-500 transition-all text-base font-bold w-full px-5" 
                    translate="no"
                    autoComplete="off"
                    value={newLesson.time}
                    onChange={e => setNewLesson({...newLesson, time: e.target.value})}
                  />
                </div>

                <div className="fg">
                  <label className="flabel mb-2">Пән атауы</label>
                  <input 
                    type="text" 
                    className="inp h-14 rounded-2xl border-slate-200 dark:border-slate-700 focus:border-blue-500 transition-all text-base font-bold w-full px-5" 
                    placeholder="Мысалы: Математика"
                    translate="no"
                    autoComplete="off"
                    value={newLesson.subject}
                    onChange={e => setNewLesson({...newLesson, subject: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="fg">
                    <label className="flabel mb-2">Сынып</label>
                    <input 
                      type="text" 
                      className="inp h-14 rounded-2xl border-slate-200 dark:border-slate-700 focus:border-blue-500 transition-all text-base font-bold w-full px-5" 
                      placeholder="5А"
                      translate="no"
                      autoComplete="off"
                      value={newLesson.grade}
                      onChange={e => setNewLesson({...newLesson, grade: e.target.value})}
                    />
                  </div>
                  <div className="fg">
                    <label className="flabel mb-2">Кабинет</label>
                    <input 
                      type="text" 
                      className="inp h-14 rounded-2xl border-slate-200 dark:border-slate-700 focus:border-blue-500 transition-all text-base font-bold w-full px-5" 
                      placeholder="204"
                      translate="no"
                      autoComplete="off"
                      value={newLesson.cabinet}
                      onChange={e => setNewLesson({...newLesson, cabinet: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-8">
                  <button className="btn btn-ghost flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest" onClick={() => setShowAddModal(null)}>Болдырмау</button>
                  <button className="btn btn-primary flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20" onClick={handleAddLesson}>Қосу</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CalendarView;
