import { GoogleGenAI } from "@google/genai";
import { KMZHParams } from "../types";

export function cleanJsonContent(content: string): string {
  // Remove markdown code blocks
  let cleaned = content.replace(/```json\n?|```/g, '').trim();
  
  // Check if it starts with { or [
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    
    let startIndex = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIndex = Math.min(firstBrace, firstBracket);
    } else {
      startIndex = firstBrace !== -1 ? firstBrace : firstBracket;
    }
    
    if (startIndex !== -1) {
      cleaned = cleaned.slice(startIndex);
    }
  }
  
  return cleaned;
}

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
  error?: string;
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

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function callAgent(
  role: AgentRole, 
  systemPrompt: string, 
  userPrompt: string,
  retries = 0
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
    const temperature = role === 'generator' ? 0.8 : role === 'critic' ? 0.3 : 0.5;
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature,
      }
    });

    const content = response.text || '';
    
    return {
      role,
      content,
      success: true
    };
  } catch (error: any) {
    const errMsg = error.message?.toLowerCase() || '';
    
    // Rate limit errors: 429, RESOURCE_EXHAUSTED, quota
    if ((errMsg.includes('429') || errMsg.includes('resource_exhausted') || errMsg.includes('quota')) && retries < 2) {
      console.warn(`Rate limit hit for ${role}, retrying in 3s... (Attempt ${retries + 1})`);
      await delay(3000);
      return callAgent(role, systemPrompt, userPrompt, retries + 1);
    }
    
    // Server errors: 500, overloaded
    if ((errMsg.includes('500') || errMsg.includes('overloaded')) && retries < 1) {
      console.warn(`Server overloaded for ${role}, retrying in 2s... (Attempt ${retries + 1})`);
      await delay(2000);
      return callAgent(role, systemPrompt, userPrompt, retries + 1);
    }

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

  const pipelineTask = async (): Promise<PipelineResult> => {
    // Stage 1: Generator
    onProgress({ stage: 'generating', message: 'Агент 1: ҚМЖ мазмұны жасалуда...' });
    
    const generatorSystemPrompt = "Сен Қазақстан Республикасының ресми білім стандарттарына сәйкес ҚМЖ жасайтын кәсіби AI агентсің. Берілген параметрлер бойынша толық, детальды ҚМЖ мазмұнын JSON форматында жаса. Мына JSON құрылымын қатаң сақта: metadata (ministry, school, subject, section, teacher, date, grade, participants, absent, topic, learningObjective, lessonObjective, value, quote өрістерімен), assessmentCriteria (массив), languageObjectives (vocabulary массиві мен phrases массиві бар объект), crossCurricularLinks (мәтін), previousLearning (мәтін), stages (массив, әрқайсысында period, teacherAction, studentAction, assessment, resources өрістері бар), descriptorsTable (массив, әрқайсысында taskName, descriptor, points өрістері бар), differentiation (мәтін), assessmentCheck (мәтін), healthAndSafety (мәтін), reflection (мәтін). Барлық мәтін қазақ тілінде болу керек. Тек JSON қайтар, басқа ештеңе жазба.";
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

    currentContent = cleanJsonContent(generatorResult.content);

    // Stage 2: Critic
    const v2 = import.meta.env.VITE_GEMINI_KEY_2;
    if (v2) {
      onProgress({ stage: 'critiquing', message: 'Агент 2: Мазмұн тексерілуде...' });
      
      const criticSystemPrompt = "Сен Қазақстандық білім беру сарапшысысың. Берілген ҚМЖ JSON мазмұнын мына критерийлер бойынша тексер: 1) Барлық stages-та teacherAction, studentAction, assessment, resources толтырылған ба? 2) assessmentCriteria мен descriptorsTable бар және толық па? 3) Оқу мақсаттары (learningObjective) сабақ мазмұнына сәйкес пе? 4) Сабақ кезеңдерінің логикасы дұрыс па (кіріспе → негізгі → қорытынды)? 5) Тіл қазақша ма? Табылған қателерді мен жақсарту ұсыныстарын нақты тізімдеп жаз. Егер бәрі дұрыс болса ‘Мазмұн сапалы, жақсарту қажет емес’ деп жаз.";
      const criticUserPrompt = `
        Параметрлер: ${JSON.stringify(params)}
        Жасалған мазмұн: ${currentContent}
      `;

      const criticResult = await callAgent('critic', criticSystemPrompt, criticUserPrompt);
      agentResults.push(criticResult);

      if (!criticResult.success) {
        onProgress({ stage: 'done', message: 'Агент 2 сәтсіз, бірақ Агент 1 нәтижесі сақталды' });
        return { finalContent: currentContent, agentResults, success: false };
      }

      // Stage 3: Refiner
      const v3 = import.meta.env.VITE_GEMINI_KEY_3;
      if (v3) {
        onProgress({ stage: 'refining', message: 'Агент 3: Финалды нұсқа дайындалуда...' });
        
        const refinerSystemPrompt = "Сен ҚМЖ редакторысың. Агент 1 жасаған JSON мазмұнды Агент 2-нің сынына сүйеніп жетілдір. Ереже: 1) Агент 2 тапқан барлық қателерді түзет. 2) JSON құрылымын сақта, өзгертпе. 3) Тек JSON қайтар, басқа ештеңе жазба. 4) Егер Агент 2 ‘жақсарту қажет емес’ десе — Агент 1 нәтижесін өзгеріссіз қайтар.";
        const refinerUserPrompt = `
          Бастапқы мазмұн: ${currentContent}
          Сын және ұсыныстар: ${criticResult.success ? criticResult.content : 'Сын жоқ.'}
        `;

        const refinerResult = await callAgent('refiner', refinerSystemPrompt, refinerUserPrompt);
        agentResults.push(refinerResult);

        if (refinerResult.success) {
          currentContent = cleanJsonContent(refinerResult.content);
        } else {
          onProgress({ stage: 'done', message: 'Агент 3 сәтсіз, бірақ алдыңғы нұсқа сақталды' });
          return { finalContent: currentContent, agentResults, success: false };
        }
      }
    }

    currentContent = cleanJsonContent(currentContent);
    onProgress({ stage: 'done', message: 'Дайын!' });
    return {
      finalContent: currentContent,
      agentResults,
      success: true
    };
  };

  const timeoutPromise = new Promise<PipelineResult>((resolve) => {
    setTimeout(() => {
      const msg = 'Уақыт аяқталды. Қайта байқаңыз.';
      onProgress({ stage: 'error', message: msg });
      resolve({ finalContent: '', agentResults, success: false, error: msg });
    }, 180000);
  });

  return Promise.race([pipelineTask(), timeoutPromise]);
}
