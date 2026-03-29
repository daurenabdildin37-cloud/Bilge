import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { useAuth } from './useAuth';
import { handleFirestoreError, OperationType } from '../lib/error-handling';

export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export type DayKey = typeof DAY_KEYS[number];

export interface Lesson {
  id: string;
  time: string;
  cabinet: string;
  grade: string;
  subject: string;
}

export interface DaySchedule {
  dayKey: DayKey;
  lessons: Lesson[];
}

export interface ScheduleCycle {
  id: string;
  startDate: string;
  endDate?: string;
  days: DaySchedule[];
}

export type WeekTopics = Record<string, Record<string, string>>;

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fmt(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function getCycleForWeek(cycles: ScheduleCycle[], weekStart: Date): ScheduleCycle | null {
  const ws = fmt(weekStart);
  for (let i = cycles.length - 1; i >= 0; i--) {
    const c = cycles[i];
    if (c.startDate <= ws && (!c.endDate || c.endDate > ws)) return c;
  }
  return null;
}

export function useCalendar() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<ScheduleCycle[]>([]);
  const [weekTopics, setWeekTopics] = useState<WeekTopics>({});
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupDays, setSetupDays] = useState<DaySchedule[]>(
    DAY_KEYS.map(k => ({ dayKey: k, lessons: [] }))
  );
  const [loading, setLoading] = useState(true);

  // Sync Cycles from Firestore
  useEffect(() => {
    if (!user) {
      setCycles([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'calendar_cycles'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCycles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduleCycle[];
      
      // Sort cycles by startDate
      setCycles(fetchedCycles.sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calendar_cycles');
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Topics from Firestore
  useEffect(() => {
    if (!user) {
      setWeekTopics({});
      return;
    }

    const q = query(collection(db, 'calendar_topics'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const topics: WeekTopics = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.date;
        const lessonId = data.lessonId;
        const topic = data.topic;
        
        if (!topics[date]) topics[date] = {};
        topics[date][lessonId] = topic;
      });
      setWeekTopics(topics);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calendar_topics');
    });

    return () => unsubscribe();
  }, [user]);

  const activeCycle = cycles.find(c => !c.endDate) || null;
  const weekCycle = getCycleForWeek(cycles, currentWeekStart);

  const getTopic = (weekStart: Date, lessonId: string): string => {
    return weekTopics[fmt(weekStart)]?.[lessonId] || '';
  };

  const setTopic = async (weekStart: Date, lessonId: string, topic: string) => {
    if (!user) return;
    const dateStr = fmt(weekStart);
    const topicId = `${user.uid}_${dateStr}_${lessonId}`;
    
    try {
      if (!topic) {
        await deleteDoc(doc(db, 'calendar_topics', topicId));
      } else {
        await setDoc(doc(db, 'calendar_topics', topicId), {
          userId: user.uid,
          date: dateStr,
          lessonId,
          topic,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'calendar_topics');
    }
  };

  const saveNewCycle = async () => {
    if (!user) return;
    const startDate = fmt(currentWeekStart);
    
    try {
      const batch = writeBatch(db);

      // Close any previous active cycle or cycles that start after this one
      cycles.forEach(c => {
        if (c.startDate >= startDate) {
          batch.delete(doc(db, 'calendar_cycles', c.id));
        } else if (!c.endDate || c.endDate >= startDate) {
          batch.update(doc(db, 'calendar_cycles', c.id), {
            endDate: fmt(addDays(currentWeekStart, -1))
          });
        }
      });

      const newCycleRef = doc(collection(db, 'calendar_cycles'));
      batch.set(newCycleRef, {
        userId: user.uid,
        startDate,
        days: setupDays,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      setIsSettingUp(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'calendar_cycles');
    }
  };

  const endCycle = () => {
    setSetupDays(DAY_KEYS.map(k => ({ dayKey: k, lessons: [] })));
    setIsSettingUp(true);
  };

  const addLessonToSetup = (dayKey: DayKey, lesson: Omit<Lesson, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setSetupDays(prev => prev.map(d =>
      d.dayKey === dayKey
        ? { ...d, lessons: [...d.lessons, { ...lesson, id }].sort((a, b) => a.time.localeCompare(b.time)) }
        : d
    ));
  };

  const addLessonToActive = async (cycleId: string, dayKey: DayKey, lesson: Omit<Lesson, 'id'>) => {
    if (!user) return;
    const id = Math.random().toString(36).substr(2, 9);
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return;

    const updatedDays = cycle.days.map(d => 
      d.dayKey === dayKey 
        ? { ...d, lessons: [...d.lessons, { ...lesson, id }].sort((a, b) => a.time.localeCompare(b.time)) }
        : d
    );

    try {
      await setDoc(doc(db, 'calendar_cycles', cycleId), { days: updatedDays }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'calendar_cycles');
    }
  };

  const removeLessonFromActive = async (cycleId: string, dayKey: DayKey, lessonId: string) => {
    if (!user) return;
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return;

    const updatedDays = cycle.days.map(d => 
      d.dayKey === dayKey 
        ? { ...d, lessons: d.lessons.filter(l => l.id !== lessonId) }
        : d
    );

    try {
      await setDoc(doc(db, 'calendar_cycles', cycleId), { days: updatedDays }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'calendar_cycles');
    }
  };

  const removeLessonFromSetup = (dayKey: DayKey, lessonId: string) => {
    setSetupDays(prev => prev.map(d =>
      d.dayKey === dayKey ? { ...d, lessons: d.lessons.filter(l => l.id !== lessonId) } : d
    ));
  };

  const updateLessonInSetup = (dayKey: DayKey, lessonId: string, updated: Partial<Lesson>) => {
    setSetupDays(prev => prev.map(d =>
      d.dayKey === dayKey
        ? { ...d, lessons: d.lessons.map(l => l.id === lessonId ? { ...l, ...updated } : l).sort((a, b) => a.time.localeCompare(b.time)) }
        : d
    ));
  };

  const goToPrevWeek = () => setCurrentWeekStart(d => addDays(d, -7));
  const goToNextWeek = () => setCurrentWeekStart(d => addDays(d, 7));
  const goToToday = () => setCurrentWeekStart(getWeekStart(new Date()));

  return {
    cycles, activeCycle, weekCycle,
    currentWeekStart, isSettingUp, setIsSettingUp, setupDays,
    getTopic, setTopic,
    saveNewCycle, endCycle,
    addLessonToSetup, removeLessonFromSetup, updateLessonInSetup,
    addLessonToActive, removeLessonFromActive,
    goToPrevWeek, goToNextWeek, goToToday,
    loading
  };
}

