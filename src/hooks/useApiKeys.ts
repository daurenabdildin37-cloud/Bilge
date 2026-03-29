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
  const [claudeKeyInput, setClaudeKeyInput] = useState('');
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [isSavingClaude, setIsSavingClaude] = useState(false);

  const saveApiKey = useCallback(async () => {
    if (!user || !apiKeyInput.trim()) return;
    setIsSavingApi(true);
    try {
      const key = apiKeyInput.trim();
      const userRef = doc(db, 'users', user.uid);
      
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        gemini_api_key: key,
        updatedAt: serverTimestamp(),
        // Only set createdAt if it doesn't exist (handled by merge and rules)
        // Actually, rules require createdAt for create.
        // We can't easily know if it exists without getDoc, but we can try to send it.
        // If it exists, merge will keep the old one if we don't overwrite it? 
        // No, setDoc with merge will overwrite if we provide it.
      }, { merge: true });
      
      // To be safe with the 'createdAt' requirement in rules for 'create'
      // we might need a more complex approach, but let's try to ensure 
      // useAuth always creates it first.
      
      localStorage.setItem('GEMINI_API_KEY', key);
      setIsApiOk(true);
      
      showToast('Gemini API кілті сақталды! ✅');
      setIsApiModalOpen(false);
      setApiKeyInput('');
    } catch (error) {
      console.error('Error saving API key:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      showToast('Қате орын алды ❌');
    } finally {
      setIsSavingApi(false);
    }
  }, [user, apiKeyInput, showToast, setIsApiOk]);

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
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      localStorage.removeItem('GEMINI_API_KEY');
      setIsApiOk(false);
      
      showToast('API кілті өшірілді 🗑️');
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
    claudeKeyInput,
    isSavingApi,
    isSavingClaude,
    saveApiKey,
    saveClaudeKey,
    clearApiKey
  ]);
}
