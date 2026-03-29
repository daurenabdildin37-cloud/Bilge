import { GoogleGenAI } from "@google/genai";
import { KMZHParams } from "../types";

export type AgentRole = 'generator' | 'critic' | 'refiner';

export interface AgentResult {
  role: AgentRole;
  content: string;
  success: boolean;
  error?: string;
}

export interface PipelineResult {
  finalContent: string;
  agentResults: AgentResult[];
  success: boolean;
}

export interface PipelineProgress {
  stage: 'generating' | 'critiquing' | 'refining' | 'done' | 'error';
  message: string;
}

export function getAgentKey(role: AgentRole): string {
  let key = '';
  switch (role) {
    case 'generator':
      key = import.meta.env.VITE_GEMINI_KEY_1 || '';
      break;
    case 'critic':
      key = import.meta.env.VITE_GEMINI_KEY_2 || '';
      break;
    case 'refiner':
      key = import.meta.env.VITE_GEMINI_KEY_3 || '';
      break;
  }

  if (!key) {
    key = localStorage.getItem('gemini_api_key') || '';
  }
  
  return key;
}

export async function callAgent(
  role: AgentRole, 
  systemPrompt: string, 
  userPrompt: string
): Promise<AgentResult> {
  const apiKey = getAgentKey(role);
  
  if (!apiKey) {
    return {
      role,
      content: '',
      success: false,
      error: 'API key is missing'
    };
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    const content = response.text || '';
    
    return {
      role,
      content,
      success: true
    };
  } catch (error: any) {
    console.error(`Error calling agent ${role}:`, error);
    return {
      role,
      content: '',
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

export async function runKmzhPipeline(
  params: KMZHParams,
  onProgress: (progress: PipelineProgress) => void
): Promise<PipelineResult> {
  const agentResults: AgentResult[] = [];
  let currentContent = '';

  // Stage 1: Generator
  onProgress({ stage: 'generating', message: 'Агент 1: ҚМЖ мазмұны жасалуда...' });
  
  const generatorSystemPrompt = "Сен Қазақстанның ресми білім стандарттарына сәйкес ҚМЖ жасайтын AI агентсің. Берілген параметрлер бойынша толық ҚМЖ мазмұнын жаса.";
  const generatorUserPrompt = `
    Пән: ${params.subject}
    Сынып: ${params.grade}
    Тақырып: ${params.topic}
    Оқу мақсаттары: ${params.learningObjectives}
    Бөлім: ${params.section}
    Мұғалім: ${params.teacherName}
    Мектеп: ${params.schoolName}
    Күні: ${params.date}
    Құндылық: ${params.value}
    Дәйексөз: ${params.quote}
    Қатысушылар: ${params.participants}
    Қатыспағандар: ${params.absent}
    Қосымша сұраныстар: ${params.additionalRequests}
    Дереккөз мәтін: ${params.sourceText}
  `;

  const generatorResult = await callAgent('generator', generatorSystemPrompt, generatorUserPrompt);
  agentResults.push(generatorResult);

  if (!generatorResult.success) {
    onProgress({ stage: 'error', message: `Агент 1 қатесі: ${generatorResult.error}` });
    return { finalContent: '', agentResults, success: false };
  }

  currentContent = generatorResult.content;

  // Stage 2: Critic
  const v2 = import.meta.env.VITE_GEMINI_KEY_2;
  if (v2) {
    onProgress({ stage: 'critiquing', message: 'Агент 2: Мазмұн тексерілуде...' });
    
    const criticSystemPrompt = "Сен білім беру сарапшысысың. Берілген ҚМЖ мазмұнын тексер. Қателерді, олқылықтарды, бағдарламаға сәйкессіздіктерді тап. Нақты жақсарту ұсыныстарын бер.";
    const criticUserPrompt = `
      Параметрлер: ${JSON.stringify(params)}
      Жасалған мазмұн: ${currentContent}
    `;

    const criticResult = await callAgent('critic', criticSystemPrompt, criticUserPrompt);
    agentResults.push(criticResult);

    // Stage 3: Refiner
    const v3 = import.meta.env.VITE_GEMINI_KEY_3;
    if (v3) {
      onProgress({ stage: 'refining', message: 'Агент 3: Финалды нұсқа дайындалуда...' });
      
      const refinerSystemPrompt = "Сен ҚМЖ редакторысың. Агент 1 жасаған мазмұнды Агент 2 сынына сүйеніп жетілдір. Финалды нұсқа толық, сапалы, ресми форматта болу керек. JSON форматында қайтар.";
      const refinerUserPrompt = `
        Бастапқы мазмұн: ${currentContent}
        Сын және ұсыныстар: ${criticResult.success ? criticResult.content : 'Сын жоқ.'}
      `;

      const refinerResult = await callAgent('refiner', refinerSystemPrompt, refinerUserPrompt);
      agentResults.push(refinerResult);

      if (refinerResult.success) {
        currentContent = refinerResult.content;
      }
    }
  }

  onProgress({ stage: 'done', message: 'Дайын!' });
  return {
    finalContent: currentContent,
    agentResults,
    success: true
  };
}
