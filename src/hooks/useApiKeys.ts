import { useState, useCallback, useMemo } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handling';

export function useApiKeys(
  user: User | null, 
  showToast: (msg: string) => void,
  setIsApiOk: (ok: boolean) => void,
  setIsClaudeApiOk: (ok: boolean) => void
) {
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isClaudeModalOpen, setIsClaudeModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyInput2, setApiKeyInput2] = useState('');
  const [apiKeyInput3, setApiKeyInput3] = useState('');
  const [claudeKeyInput, setClaudeKeyInput] = useState('');
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [isSavingClaude, setIsSavingClaude] = useState(false);

  const saveApiKey = useCallback(async () => {
    if (!user || (!apiKeyInput.trim() && !apiKeyInput2.trim() && !apiKeyInput3.trim())) return;
    setIsSavingApi(true);
    try {
      const key1 = apiKeyInput.trim();
      const key2 = apiKeyInput2.trim();
      const key3 = apiKeyInput3.trim();
      const userRef = doc(db, 'users', user.uid);
      
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        gemini_api_key: key1,
        gemini_api_key_2: key2,
        gemini_api_key_3: key3,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      if (key1) localStorage.setItem('GEMINI_API_KEY', key1);
      if (key2) localStorage.setItem('gemini_api_key_2', key2);
      if (key3) localStorage.setItem('gemini_api_key_3', key3);
      
      setIsApiOk(true);
      
      showToast('Gemini API кілттері сақталды! ✅');
      setIsApiModalOpen(false);
      setApiKeyInput('');
      setApiKeyInput2('');
      setApiKeyInput3('');
    } catch (error) {
      console.error('Error saving API key:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      showToast('Қате орын алды ❌');
    } finally {
      setIsSavingApi(false);
    }
  }, [user, apiKeyInput, apiKeyInput2, apiKeyInput3, showToast, setIsApiOk]);

  const saveClaudeKey = useCallback(async () => {
    if (!user || !claudeKeyInput.trim()) return;
    setIsSavingClaude(true);
    try {
      const key = claudeKeyInput.trim();
      const userRef = doc(db, 'users', user.uid);
      
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        claude_api_key: key,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      localStorage.setItem('CLAUDE_API_KEY', key);
      setIsClaudeApiOk(true);
      
      showToast('Claude API кілті сақталды! ✅');
      setIsClaudeModalOpen(false);
      setClaudeKeyInput('');
    } catch (error) {
      console.error('Error saving Claude key:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      showToast('Қате орын алды ❌');
    } finally {
      setIsSavingClaude(false);
    }
  }, [user, claudeKeyInput, showToast, setIsClaudeApiOk]);

  const clearApiKey = useCallback(async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        gemini_api_key: null,
        gemini_api_key_2: null,
        gemini_api_key_3: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      localStorage.removeItem('GEMINI_API_KEY');
      localStorage.removeItem('gemini_api_key_2');
      localStorage.removeItem('gemini_api_key_3');
      setIsApiOk(false);
      
      showToast('API кілттері өшірілді 🗑️');
    } catch (err) {
      console.error("Error clearing API key:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      showToast('Қате орын алды ❌');
    }
  }, [user, showToast, setIsApiOk]);

  return useMemo(() => ({
    isApiModalOpen,
    setIsApiModalOpen,
    isClaudeModalOpen,
    setIsClaudeModalOpen,
    apiKeyInput,
    setApiKeyInput,
    apiKeyInput2,
    setApiKeyInput2,
    apiKeyInput3,
    setApiKeyInput3,
    claudeKeyInput,
    setClaudeKeyInput,
    isSavingApi,
    isSavingClaude,
    saveApiKey,
    saveClaudeKey,
    clearApiKey
  }), [
    isApiModalOpen,
    isClaudeModalOpen,
    apiKeyInput,
    apiKeyInput2,
    apiKeyInput3,
    claudeKeyInput,
    isSavingApi,
    isSavingClaude,
    saveApiKey,
    saveClaudeKey,
    clearApiKey
  ]);
}
