
import { useState, useCallback, useMemo } from 'react';
import { saveRawFile, processRawChunk, saveApprovedChunks, stopBackgroundProcessing } from '../services/knowledgeBaseService';
import { KBChunkDraft } from '../types';

export type IngestionStatus = 'idle' | 'processing' | 'saving' | 'completed' | 'error';

export const useKBBackground = (addNotification: (title: string, message: string, type?: any) => void) => {
  const [status, setStatus] = useState<IngestionStatus>('idle');
  const [progress, setProgress] = useState({ stage: '', percent: 0 });
  const [drafts, setDrafts] = useState<KBChunkDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(false);

  const saveDrafts = useCallback(async (draftsToSave: KBChunkDraft[]) => {
    if (status === 'saving') return;

    setStatus('saving');
    setProgress({ stage: 'Сақталуда...', percent: 0 });
    setError(null);
    
    try {
      await saveApprovedChunks(draftsToSave, (percent) => {
        setProgress({ stage: 'Сақталуда...', percent });
      });
      
      setDrafts([]);
      setStatus('idle');
      setCurrentFileName(null);
      setProgress({ stage: '', percent: 0 });
      
      addNotification("Сәтті сақталды", `${draftsToSave.length} бөлім білім базасына қосылды.`, 'success');
      
      return true;
    } catch (err: any) {
      console.error(err);
      setError(`Сақтау қатесі: ${err.message}`);
      setStatus('error');
      
      addNotification("Сақтау қатесі", err.message, 'error');
      
      return false;
    }
  }, [status, addNotification]);

  const startIngestion = useCallback(async (file: File) => {
    if (status === 'processing' || status === 'saving') return;

    // ЭТАП 1: быстрое сохранение
    setStatus('processing');
    setError(null);
    setCurrentFileName(file.name);
    setProgress({ stage: 'Файлды сақтау...', percent: 0 });

    let rawDocId: string;
    try {
      rawDocId = await saveRawFile(file, (stage, percent) => {
        setProgress({ stage, percent });
      });
      
      addNotification(
        "Файл сақталды ✅", 
        `"${file.name}" базаға жүктелді. AI өңдеу басталды...`, 
        'success'
      );
    } catch (err: any) {
      setError(`Файлды сақтау қатесі: ${err.message}`);
      setStatus('error');
      addNotification("Сақтау қатесі", err.message, 'error');
      return;
    }

    // ЭТАП 2: фоновое разбиение (статус отдельный)
    setStatus('processing');
    setProgress({ stage: 'AI өңдеу басталды...', percent: 0 });

    try {
      const result = await processRawChunk(rawDocId, (stage, percent) => {
        setProgress({ stage, percent });
      }, autoSave);

      if (!autoSave && result) {
        setDrafts(result);
        setStatus('idle');
        addNotification(
          "Өңдеу аяқталды ✅",
          `"${file.name}" өңделді. Бөлімдерді тексеріп, сақтаңыз.`,
          'info'
        );
      } else {
        setStatus('completed');
        setProgress({ stage: 'Дайын!', percent: 100 });
        setCurrentFileName(null);
        
        addNotification(
          "Өңдеу аяқталды ✅",
          `"${file.name}" толықтай өңделіп, білім базасына қосылды.`,
          'success'
        );
      }
    } catch (err: any) {
      // Файл уже в базе как raw — не критично, можно обработать позже
      setError(`AI өңдеу қатесі (файл базада сақтаулы): ${err.message}`);
      setStatus('error');
      addNotification(
        "AI өңдеу қатесі", 
        `Файл базада бар, бірақ бөліктерге бөлінбеді: ${err.message}`, 
        'error'
      );
    }
  }, [status, addNotification]);

  const clearDrafts = useCallback(() => {
    setDrafts([]);
    setStatus('idle');
    setError(null);
    setCurrentFileName(null);
  }, []);

  const resetStatus = useCallback(() => {
    if (status === 'completed' || status === 'error') {
      setStatus('idle');
    }
  }, [status]);

  const stopIngestion = useCallback(() => {
    stopBackgroundProcessing();
    setStatus('idle');
    addNotification("Тоқтатылды", "AI өңдеу тоқтатылды.", 'warning');
  }, [addNotification]);

  return useMemo(() => ({
    status,
    progress,
    drafts,
    error,
    currentFileName,
    startIngestion,
    saveDrafts,
    clearDrafts,
    resetStatus,
    stopIngestion,
    autoSave,
    setAutoSave,
    setDrafts
  }), [
    status,
    progress,
    drafts,
    error,
    currentFileName,
    startIngestion,
    saveDrafts,
    clearDrafts,
    resetStatus,
    stopIngestion,
    autoSave
  ]);
};
