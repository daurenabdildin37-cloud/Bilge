
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { useAuth } from './useAuth';
import { handleFirestoreError, OperationType } from '../lib/error-handling';

export interface Message {
  id?: string;
  role: 'user' | 'ai';
  text: string;
  createdAt?: any;
}

export function useChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMessages([{ role: 'ai', text: 'Сәлем! Мен DostUstaz-пын. Бүгін не үйренгің келеді?' }]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

      if (msgs.length === 0) {
        setMessages([{ role: 'ai', text: 'Сәлем! Мен DostUstaz-пын. Бүгін не үйренгің келеді?' }]);
      } else {
        setMessages(msgs);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [user]);

  const sendMessage = async (text: string, role: 'user' | 'ai') => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        role,
        text,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'chats'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'chats');
    }
  };

  return { messages, loading, sendMessage, clearHistory };
}
