
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { generateGameIterative, generateKmzh, generateAssessment, generateGame } from '../services/geminiService';
import { generateGameWithClaude } from '../services/claudeService';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface GenerationProgress {
  status: string;
  message?: string;
  current?: number;
  total?: number;
}

interface GenerationContextType {
  // Coding State
  codingMessages: Message[];
  setCodingMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  codingInput: string;
  setCodingInput: React.Dispatch<React.SetStateAction<string>>;
  isCodingLoading: boolean;
  codingGameData: any;
  setCodingGameData: React.Dispatch<React.SetStateAction<any>>;
  codingHistory: any[];
  setCodingHistory: React.Dispatch<React.SetStateAction<any[]>>;
  codingGenerationMode: 'simple' | 'advanced';
  setCodingGenerationMode: React.Dispatch<React.SetStateAction<'simple' | 'advanced'>>;
  codingProgress: GenerationProgress | null;
  handleCodingSend: (
    userMsg: string, 
    isApiOk: boolean, 
    isClaudeApiOk: boolean, 
    onOpenApiModal: () => void,
    addNotification: (t: string, m: string, ty: string) => void
  ) => Promise<void>;

  // KMZH State
  isKmzhGenerating: boolean;
  kmzhResult: any;
  setKmzhResult: React.Dispatch<React.SetStateAction<any>>;
  kmzhProgress: GenerationProgress | null;
  kmzhLoaderStep: number;
  setKmzhLoaderStep: React.Dispatch<React.SetStateAction<number>>;
  handleKmzhGenerate: (
    params: any,
    useKB: boolean,
    isApiOk: boolean,
    onOpenApiModal: () => void,
    addNotification: (t: string, m: string, ty: string) => void
  ) => Promise<void>;

  // Assessment State
  isAssessmentGenerating: boolean;
  assessmentResult: any;
  setAssessmentResult: React.Dispatch<React.SetStateAction<any>>;
  assessmentProgress: GenerationProgress | null;
  handleAssessmentGenerate: (
    params: any,
    useKB: boolean,
    isApiOk: boolean,
    onOpenApiModal: () => void,
    addNotification: (t: string, m: string, ty: string) => void
  ) => Promise<void>;

  // Game State
  isGameGenerating: boolean;
  gameResult: any;
  setGameResult: React.Dispatch<React.SetStateAction<any>>;
  gameProgress: GenerationProgress | null;
  gameParams: any;
  setGameParams: React.Dispatch<React.SetStateAction<any>>;
  activeGame: string | null;
  setActiveGame: React.Dispatch<React.SetStateAction<string | null>>;
  gameLoaderStep: number;
  setGameLoaderStep: React.Dispatch<React.SetStateAction<number>>;
  handleGameGenerate: (
    params: any,
    useKB: boolean,
    isApiOk: boolean,
    onOpenApiModal: () => void,
    addNotification: (t: string, m: string, ty: string) => void
  ) => Promise<void>;
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

export const GenerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Coding State
  const [codingMessages, setCodingMessages] = useState<Message[]>([
    { role: 'model', text: 'Сәлем! Мен ойын дизайнерімін. Қандай ойын жасағыңыз келеді? Сұранысыңызды жазыңыз, мен оны толық код арқылы (HTML/JS/CSS) құрастырып беремін.' }
  ]);
  const [codingInput, setCodingInput] = useState('');
  const [isCodingLoading, setIsCodingLoading] = useState(false);
  const [codingGameData, setCodingGameData] = useState<any>(null);
  const [codingHistory, setCodingHistory] = useState<any[]>([]);
  const [codingGenerationMode, setCodingGenerationMode] = useState<'simple' | 'advanced'>('simple');
  const [codingProgress, setCodingProgress] = useState<GenerationProgress | null>(null);

  // KMZH State
  const [isKmzhGenerating, setIsKmzhGenerating] = useState(false);
  const [kmzhResult, setKmzhResult] = useState<any>(null);
  const [kmzhProgress, setKmzhProgress] = useState<GenerationProgress | null>(null);
  const [kmzhLoaderStep, setKmzhLoaderStep] = useState(0);

  // Assessment State
  const [isAssessmentGenerating, setIsAssessmentGenerating] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [assessmentProgress, setAssessmentProgress] = useState<GenerationProgress | null>(null);

  // Game State
  const [isGameGenerating, setIsGameGenerating] = useState(false);
  const [gameResult, setGameResult] = useState<any>(null);
  const [gameProgress, setGameProgress] = useState<GenerationProgress | null>(null);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [gameLoaderStep, setGameLoaderStep] = useState(0);
  const [gameParams, setGameParams] = useState<any>({
    topic: '',
    grade: '5',
    type: 'Kahoot',
    count: 5,
    lang: 'Қазақша',
    useKB: true
  });

  const handleCodingSend = async (
    userMsg: string, 
    isApiOk: boolean, 
    isClaudeApiOk: boolean, 
    onOpenApiModal: () => void,
    addNotification: (t: string, m: string, ty: string) => void
  ) => {
    if (!userMsg || isCodingLoading) return;
    
    // We allow proceeding even if API keys are not set because we have server-side proxy fallbacks
    // for Gemini. Claude still needs a key or we'll fallback to Gemini.

    setCodingMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsCodingLoading(true);

    try {
      const chatHistory = codingMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      let result;
      let usedGeminiFallback = false;

      if (isClaudeApiOk) {
        try {
          result = await generateGameWithClaude(userMsg, chatHistory, codingGameData);
        } catch (claudeErr: any) {
          console.error("Claude failed, checking for Gemini fallback:", claudeErr);
          if (isApiOk) {
            addNotification('Claude лимиті таусылды 🔄', 'Gemini моделіне автоматты түрде ауысуда...', 'info');
            result = await generateGameIterative(userMsg, chatHistory, codingGameData, codingGenerationMode, (p) => setCodingProgress(p));
            usedGeminiFallback = true;
          } else {
            throw claudeErr;
          }
        }
      } else {
        result = await generateGameIterative(userMsg, chatHistory, codingGameData, codingGenerationMode, (p) => setCodingProgress(p));
      }
      
      setCodingGameData(result);
      setCodingHistory(prev => [...prev, result]);
      const successMsg = usedGeminiFallback 
        ? 'Claude лимитіне байланысты Gemini арқылы жасалды. Ойын коды дайын!' 
        : 'Ойын коды дайын! Оң жақтағы превьюден көріп, тексеріп көріңіз.';
      setCodingMessages(prev => [...prev, { role: 'model', text: successMsg }]);
      addNotification('Ойын жасалды! ✨', usedGeminiFallback ? 'Gemini арқылы генерацияланды.' : 'Жаңа код сәтті генерацияланды.', 'success');
    } catch (err: any) {
      console.error("Coding Generation Error:", err);
      let errorMsg = 'Кешіріңіз, қате шықты. Қайта көріңіз.';
      const errMsg = err.message?.toLowerCase() || '';

      if (errMsg.includes('429') || errMsg.includes('quota')) {
        errorMsg = 'API сұраныс шегінен асты (Rate limit). Платформаның ортақ кілті уақытша бос емес. Өз жеке API кілтіңізді Профиль бөлімінде қосуды ұсынамыз.';
      } else if (errMsg.includes('403') || errMsg.includes('permission') || errMsg.includes('invalid_api_key')) {
        errorMsg = 'API кілтіне рұқсат жоқ немесе аймақтық шектеу бар. API кілтін тексеріңіз.';
      } else if (errMsg.includes('api key not valid') || errMsg.includes('invalid api key')) {
        errorMsg = 'API кілті қате. Профиль бөлімінде немесе Кодинг баптауларында кілтті жаңартыңыз.';
      } else if (errMsg.includes('credit balance') || errMsg.includes('insufficient credits')) {
        errorMsg = 'Claude API балансыңызда қаражат таусылды. Anthropic Console (console.anthropic.com) сайтына өтіп, балансты толтырыңыз.';
      } else if (errMsg.includes('overloaded') || errMsg.includes('service_unavailable')) {
        errorMsg = 'AI сервисі уақытша бос емес (Overloaded). Біраздан соң қайталап көріңіз.';
      }
      
      setCodingMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
      addNotification('Генерация қатесі ❌', errorMsg, 'error');
    } finally {
      setIsCodingLoading(false);
      setCodingProgress(null);
    }
  };

  const handleKmzhGenerate = async (
    params: any,
    useKB: boolean,
    isApiOk: boolean,
    onOpenApiModal: () => void,
    addNotification: (t: string, m: string, ty: string) => void
  ) => {
    if (!params.topic || !params.learningObjectives) {
      addNotification('Ескерту ⚠️', 'Тақырып пен оқу мақсаттарын енгізіңіз', 'warning');
      return;
    }

    setIsKmzhGenerating(true);
    setKmzhLoaderStep(0);
    try {
      const { getContextForGenerator } = await import('../services/knowledgeBaseService');
      let kbContext = "";
      if (useKB) {
        setKmzhLoaderStep(1);
        kbContext = await getContextForGenerator('lesson_plan', params);
      }
      
      setKmzhLoaderStep(2);
      const enhancedParams = { 
        ...params, 
        sourceText: (params.sourceText || "") + (kbContext ? "\n\n--- БІЛІМ БАЗАСЫНАН КОНТЕКСТ ---\n" + kbContext : "") 
      };
      
      const data = await generateKmzh(enhancedParams, (progress) => {
        setKmzhProgress(progress);
      });
      setKmzhLoaderStep(3);
      setKmzhResult(data);
      setKmzhLoaderStep(4);
      addNotification('ҚМЖ Дайын! ✅', `${params.topic} тақырыбы бойынша сабақ жоспары сәтті жасалды.`, 'success');
    } catch (err: any) {
      console.error("KMZH Generation Error:", err);
      addNotification('Генерация қатесі ❌', err.message || 'Қате орын алды.', 'error');
    } finally {
      setIsKmzhGenerating(false);
    }
  };

  const handleAssessmentGenerate = async (
    params: any,
    useKB: boolean,
    isApiOk: boolean,
    onOpenApiModal: () => void,
    addNotification: (t: string, m: string, ty: string) => void
  ) => {
    if (!params.topic) {
      addNotification('Ескерту ⚠️', 'Тақырыпты енгізіңіз', 'warning');
      return;
    }

    setIsAssessmentGenerating(true);
    try {
      const { getContextForGenerator } = await import('../services/knowledgeBaseService');
      let kbContext = "";
      if (useKB) {
        kbContext = await getContextForGenerator('assessment', params);
      }
      
      const enhancedParams = { 
        ...params, 
        sourceText: (params.sourceText || "") + (kbContext ? "\n\n--- БІЛІМ БАЗАСЫНАН КОНТЕКСТ ---\n" + kbContext : ""),
        taskCount: isNaN(params.taskCount) ? 5 : params.taskCount
      };
      
      const data = await generateAssessment(enhancedParams, (progress) => {
        setAssessmentProgress(progress);
      });
      
      setAssessmentResult(data);
      addNotification(`${params.type} Дайын! 📝`, `${params.topic} бойынша тапсырмалар сәтті жасалды.`, 'success');
    } catch (err: any) {
      console.error("Assessment Generation Error:", err);
      addNotification('Генерация қатесі ❌', err.message || 'Қате орын алды.', 'error');
    } finally {
      setIsAssessmentGenerating(false);
      setAssessmentProgress(null);
    }
  };

  const handleGameGenerate = async (
    params: any,
    useKB: boolean,
    isApiOk: boolean,
    onOpenApiModal: () => void,
    addNotification: (t: string, m: string, ty: string) => void
  ) => {
    if (!params.topic) {
      addNotification('Ескерту ⚠️', 'Тақырыпты енгізіңіз', 'warning');
      return;
    }

    setIsGameGenerating(true);
    try {
      const { getContextForGenerator } = await import('../services/knowledgeBaseService');
      let kbContext = "";
      if (useKB) {
        kbContext = await getContextForGenerator('game', params);
      }
      
      const enhancedParams = { 
        ...params, 
        sourceText: (params.sourceText || "") + (kbContext ? "\n\n--- БІЛІМ БАЗАСЫНАН КОНТЕКСТ ---\n" + kbContext : "")
      };
      
      const data = await generateGame(enhancedParams);
      setGameResult(data);
      if (data && data.type) {
        setActiveGame(data.type.toLowerCase());
      }
      addNotification('Ойын дайын! 🎮', `${params.topic} тақырыбы бойынша ойын сәтті жасалды.`, 'success');
    } catch (err: any) {
      console.error("Game Generation Error:", err);
      addNotification('Генерация қатесі ❌', err.message || 'Қате орын алды.', 'error');
    } finally {
      setIsGameGenerating(false);
    }
  };

  return (
    <GenerationContext.Provider value={{
      codingMessages, setCodingMessages,
      codingInput, setCodingInput,
      isCodingLoading,
      codingGameData, setCodingGameData,
      codingHistory, setCodingHistory,
      codingGenerationMode, setCodingGenerationMode,
      codingProgress,
      handleCodingSend,

      isKmzhGenerating, kmzhResult, setKmzhResult, kmzhProgress, kmzhLoaderStep, setKmzhLoaderStep, handleKmzhGenerate,
      isAssessmentGenerating, assessmentResult, setAssessmentResult, assessmentProgress, handleAssessmentGenerate,
      isGameGenerating, gameResult, setGameResult, gameProgress, gameParams, setGameParams, activeGame, setActiveGame, gameLoaderStep, setGameLoaderStep, handleGameGenerate
    }}>
      {children}
    </GenerationContext.Provider>
  );
};

export const useGeneration = () => {
  const context = useContext(GenerationContext);
  if (context === undefined) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
};
