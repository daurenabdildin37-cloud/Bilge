import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { Notification, User } from '../types';

export function useNotifications(user: User | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Notification)).sort((a, b) => {
        const dateA = (a.createdAt as any)?.seconds || 0;
        const dateB = (b.createdAt as any)?.seconds || 0;
        return dateB - dateA;
      });
      setNotifications(notifs);
    }, (error) => {
      console.error("Notifications snapshot error:", error);
    });
    
    return () => unsubscribe();
  }, [user?.uid]);

  const addNotification = useCallback(async (title: string, message: string, type: Notification['type'] = 'info') => {
    if (!user?.uid) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title,
        message,
        type,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to add notification", err);
    }
  }, [user?.uid]);

  return useMemo(() => ({ notifications, addNotification }), [notifications, addNotification]);
}
