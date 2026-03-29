import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import OpenAI from "openai";
import { safeJsonParse } from "../lib/ai-utils";
import { reportErrorToAI } from "../lib/error-handling";
import { getAi, callGemini } from "./ai-api";

export type GenerationProgress = {
  status: 'generating_content' | 'completed' | 'error' | 'generating' | 'parsing';
  current?: number;
  total?: number;
  message?: string;
};

export type ProgressCallback = (progress: GenerationProgress) => void;

const withRetry = async (fn: () => Promise<any>, retries = 3, delay = 2000) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const is500 = error?.message?.includes('500') || error?.status === 500 || error?.message?.includes('xhr error') || error?.message?.toLowerCase().includes('overloaded');
      const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.toLowerCase().includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED');
      const isTimeout = error?.message?.toLowerCase().includes('timeout') || error?.message?.toLowerCase().includes('уақыты аяқталды');
      
      if ((is500 || isRateLimit || isTimeout) && i < retries) {
        const waitTime = isRateLimit ? Math.pow(4, i + 1) * 1000 : delay * (i + 1);
        console.warn(`Gemini API ${isRateLimit ? 'Rate Limit' : isTimeout ? 'Timeout' : 'Error'}, retrying (${i + 1}/${retries}) in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
};

/**
 * Helper to wrap promises with a timeout
 */
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 120000): Promise<T> => {
  let timeoutHandle: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`AI сұранысы ${timeoutMs/1000} секундтан кейін үзілді. Қайта көріңіз немесе тақырыпты қысқартыңыз.`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

/**
 * Limits the number of concurrent promises
 */
const limitConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  const batches = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    batches.push(batch);
  }
  
  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    // Small delay between batches to help with rate limits
    if (batches.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  return results;
};

export const generateKmzh = async (params: any, onProgress?: ProgressCallback) => {
  const ai = getAi();
  
  if (onProgress) onProgress({ status: 'generating_content', message: 'Сабақ жоспарының мазмұны жасалуда...' });
  
  const systemInstruction = `You are a professional lesson plan AI, capable of generating highly accurate short-term lesson plans (ҚМЖ) fully aligned with the official Kazakhstan educational standards.

Follow this 3-step logic internally before providing the final JSON output:

Step 1: Generate a structured lesson outline:
- Identify lesson stages: Introduction (Ұйымдастыру), Review (Үй тапсырмасы/Пысықтау), New Material (Жаңа сабақ), Practice (Бекіту), Summary (Қорытынды), Homework (Үй тапсырмасы), Reflection (Рефлексия).
- Suggest tasks for each stage with increasing complexity following Bloom's Taxonomy (Recall → Comprehension → Application → Evaluation).
- Include extremely detailed Teacher Actions (Педагогтің әрекеті), extensive Student Actions (Оқушының әрекеті), comprehensive Assessment Methods (Бағалау), and suggested Resources (Ресурстар).
- Student Actions (Оқушының әрекеті) must be written at a large scale, describing in full detail how students interact, answer, work in groups, and perform tasks.
- Ensure each task aligns directly with the provided Learning Objective (Оқу бағдарламасына сәйкес оқыту мақсаты).
- IMPORTANT: All descriptions must be extremely detailed, comprehensive, and voluminous. Avoid short, generalized phrases. Provide full, step-by-step explanations of every activity, instruction, and task. Every action must be fully elaborated to provide a complete picture of the lesson.

Step 2: Convert the outline into the official lesson plan table format:
- Structure the data as a JSON object matching the KMZHData interface.
- Add SMART lesson objectives, assessment criteria, and language objectives.
- Ensure resources and assessment are correctly aligned with each stage.
- IMPORTANT: The 'assessment' field in the 'stages' table MUST contain the full, extensive descriptors and point allocations for each task in that stage, matching the information in the 'descriptorsTable'.
- IMPORTANT: Create a highly detailed "descriptorsTable" that lists every major task/activity from the lesson plan, its specific, extensive descriptors (what the student should do to succeed), and the points assigned to each.
- Descriptors must be thorough, extensive, and voluminous, specifying exactly what criteria are needed for each point awarded.

Step 3: Validation:
- Check if all stages have Teacher Actions, Student Actions, Assessment, and Resources.
- Verify logical flow and complexity of tasks.
- Ensure conclusion and feedback sections have specific, detailed explanations.
- Correct any inconsistencies automatically.

Output MUST be a valid JSON object in Kazakh language. All text should be structured as if it were to be printed in 12pt Times New Roman font.`;

  const prompt = `Generate a complete, example-aligned, ready-to-use short-term lesson plan (ҚМЖ) for:
Subject: ${params.subject}
Grade: ${params.grade}
Lesson Topic: ${params.topic}
Learning Objective: ${params.learningObjectives}
Section: ${params.section}
Teacher: ${params.teacherName}
School: ${params.schoolName}
Date: ${params.date}
Value: ${params.value}
Quote: ${params.quote}
Participants: ${params.participants}
Absent: ${params.absent}
Additional Requests: ${params.additionalRequests || "Жоқ"}
Source Text/Context: ${params.sourceText || ""}

IMPORTANT REQUIREMENTS:
1. EXTREMELY DETAILED LESSON PROCESS: Every action, task, and instruction must be fully elaborated and explained in maximum detail. No short or vague descriptions.
2. VOLUMINOUS STUDENT ACTIONS: Student actions (Оқушының әрекеті) must be written extensively, covering all steps of their work.
3. COMPREHENSIVE TASKS: Each task should be clearly described with step-by-step instructions and clear expectations.
4. FEEDBACK & CONCLUSION: Provide specific, highly detailed explanations for the conclusion and feedback sections.
5. EXTENSIVE DESCRIPTORS: Assessment descriptors must be thorough and voluminous, clearly outlining the criteria for each point awarded for every task.
6. ASSESSMENT IN STAGES: The 'assessment' column in the lesson stages table MUST include the full, detailed descriptors and point values for each task, exactly as they appear in the descriptors table at the bottom.
7. FORMATTING: The content should be professional and formal, suitable for a 12pt Times New Roman document.

The response must follow this JSON structure exactly:
{
  "metadata": {
    "ministry": "Қазақстан Республикасының Оқу ағарту министрлігі",
    "school": "${params.schoolName}",
    "subject": "${params.subject}",
    "section": "${params.section}",
    "teacher": "${params.teacherName}",
    "date": "${params.date}",
    "grade": "${params.grade}",
    "participants": "${params.participants}",
    "absent": "${params.absent}",
    "topic": "${params.topic}",
    "learningObjective": "${params.learningObjectives}",
    "lessonObjective": "Сабақтың мақсатын осында жазыңыз",
    "value": "${params.value}",
    "quote": "${params.quote}"
  },
  "lessonObjectives": ["Мақсат 1", "Мақсат 2"],
  "assessmentCriteria": ["Критерий 1", "Критерий 2"],
  "languageObjectives": { "vocabulary": ["сөз 1"], "phrases": ["тіркес 1"] },
  "values": "Құндылықтарды дарыту",
  "crossCurricularLinks": "Пәнаралық байланыс",
  "previousLearning": "Алдыңғы білім",
  "stages": [
    { 
      "period": "Кезең атауы", 
      "teacherAction": "Педагогтің әрекеті", 
      "studentAction": "Оқушының әрекеті", 
      "assessment": "Бағалау", 
      "resources": "Ресурстар"
    }
  ],
  "descriptorsTable": [
    { "taskName": "Тапсырма атауы", "descriptor": "Дескриптор сипаттамасы", "points": 2 }
  ],
  "differentiation": "Саралау",
  "assessmentCheck": "Бағалау",
  "healthAndSafety": "Денсаулық және қауіпсіздік",
  "reflection": "Рефлексия"
}`;

  const generate = async (model: string) => {
    console.log(`Attempting KMZH generation with model: ${model}`);
    const response = await withTimeout(callGemini({
      model: model,
      contents: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object. Do not truncate the response. Ensure all brackets and braces are closed correctly.",
      config: { 
        responseMimeType: "application/json",
        systemInstruction: systemInstruction + "\n\nIMPORTANT: Your output must be a single, complete, and valid JSON object. Do not include any text outside the JSON. Do not truncate the JSON output.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0.4,
        maxOutputTokens: 16384
      }
    }), 180000);
    
    if (!response.text) {
      const safetyRating = response.candidates?.[0]?.safetyRatings;
      console.warn("Gemini response empty. Safety ratings:", safetyRating);
      throw new Error("AI жауабы бос немесе қауіпсіздік сүзгісімен блокталды. Сұранысты өзгертіп көріңіз.");
    }
    
    const data = safeJsonParse(response.text || "{}", {});
    if (!data || Object.keys(data).length === 0) {
      throw new Error("AI жауабын өңдеу мүмкін болмады. Қайта көріңіз.");
    }

    const finalMessage = 'Сабақ жоспары сәтті жасалды!';
    
    if (onProgress) onProgress({ status: 'completed', message: finalMessage });
    return data;
  };

  return withRetry(async () => {
    return await generate("gemini-3-flash-preview");
  });
};

export const generateGame = async (params: any, onProgress?: ProgressCallback) => {
  const ai = getAi();
  
  if (onProgress) onProgress({ status: 'generating_content', message: 'Ойын мазмұны жасалуда...' });
  
  const systemInstruction = `Сен — білім беру ойындарының кәсіби дизайнерісің. 
  МАҢЫЗДЫ: Ойын ТЕК ҚАНА берілген тақырыпқа сай болуы тиіс. 
  Ойын логикасы терең, қызықты және білім беру мақсатына сай болуы керек. Қарапайым сұрақтармен шектелме, деңгейлер мен күрделілік қосуға тырыс.
  Жауапты ТЕК ҚАНА таза JSON түрінде бер. Маркдаун блоктарын ( \`\`\`json ) қолданба.
  
  JSON ФОРМАТТАРЫ (Әрбір сұрақ/карта үшін "imagePrompt" қосуды ұмытпа, ол сурет жасау үшін қолданылады. МАҢЫЗДЫ: "imagePrompt" өрісін ТЕК АҒЫЛШЫН ТІЛІНДЕ жаз):
  1. Kahoot: {"type": "kahoot", "questions": [{"q": "сұрақ", "a": "дұрыс", "opts": ["вариант1", "вариант2", "вариант3", "вариант 4"], "imagePrompt": "English description of the image"}]}
  2. Flashcards: {"type": "flashcards", "cards": [{"q": "термін", "a": "анықтама", "imagePrompt": "English description of the image"}]}
  3. Matching: {"type": "matching", "pairs": [{"left": "...", "right": "...", "imagePrompt": "English description of the image"}]}
  4. WordSearch: {"type": "wordsearch", "words": ["СӨЗ1", "СӨЗ2"], "gridSize": 12}
  5. Memory: {"type": "memory", "cards": [{"id": 1, "content": "A", "imagePrompt": "English description of the image"}, {"id": 2, "content": "A", "imagePrompt": "English description of the image"}]}
  6. TrueFalse: {"type": "truefalse", "questions": [{"q": "сөйлем", "a": true/false, "imagePrompt": "English description of the image"}]}
  7. FillBlanks: {"type": "fillblanks", "questions": [{"text": "Мәтін [жауап] жалғасы", "answer": "жауап"}]}
  8. Sequence: {"type": "sequence", "items": [{"text": "1-ші қадам", "order": 1}, {"text": "2-ші қадам", "order": 2}]}
  9. Categorization: {"type": "categorization", "categories": [{"name": "Санат1", "items": ["зат1", "зат2"]}, {"name": "Санат2", "items": ["зат3", "зат4"]}]}
  10. Crossword: {"type": "crossword", "clues": [{"word": "СӨЗ", "clue": "анықтама", "x": 0, "y": 0, "dir": "across/down"}]}`;

  const prompt = `Тақырып: ${params.topic}
  Сынып: ${params.grade}
  Тіл: ${params.lang}
  Ойын түрі: ${params.type}
  САНЫ: Дәл ${params.count} сұрақ/бөлім/карта жаса.
  ЛОГИКА: Ойынды барынша сапалы және мазмұнды етіп жаса.
  ${params.sourceText ? `\nДЕРЕККӨЗ МӘТІНІ/КОНТЕКСТ:\n${params.sourceText}` : ""}`;

  const generate = async (model: string) => {
    const ai = getAi();
    
    if (onProgress) onProgress({ status: 'generating_content', message: 'Ойын мазмұны жасалуда...' });

    const response = await withTimeout(callGemini({
      model: model,
      contents: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object. Do not truncate the response. Ensure all brackets and braces are closed correctly. Randomize the position of the correct answer in the 'opts' array.",
      config: { 
        responseMimeType: "application/json",
        systemInstruction: systemInstruction + "\n\nIMPORTANT: Your output must be a single, complete, and valid JSON object. Do not include any text outside the JSON. Do not truncate the JSON output. For Kahoot games, ensure the correct answer 'a' is one of the strings in 'opts', and shuffle the 'opts' array so the correct answer is not always first.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0.7,
        maxOutputTokens: 16384
      }
    }), 180000);
    
    if (!response.text) {
      const safetyRating = response.candidates?.[0]?.safetyRatings;
      console.warn("Gemini response empty for Game. Safety ratings:", safetyRating);
      throw new Error("AI жауабы бос немесе қауіпсіздік сүзгісімен блокталды. Сұранысты өзгертіп көріңіз.");
    }
    const data = safeJsonParse(response.text || "{}", {});
    
    if (!data || Object.keys(data).length === 0) {
      throw new Error("AI жауабын өңдеу мүмкін болмады. Қайта көріңіз.");
    }
    
    const finalMessage = 'Ойын сәтті жасалды!';

    if (onProgress) onProgress({ status: 'completed', message: finalMessage });
    return data;
  };

  return withRetry(async () => {
    try {
      return await generate("gemini-3-flash-preview");
    } catch (error: any) {
      console.warn("Game Error, trying Flash fallback:", error.message);
      
      const isQuotaError = error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('429');
      const isModelError = error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('404');
      
      if (isQuotaError || isModelError || error.message?.toLowerCase().includes('permission')) {
        try {
          return await generate("gemini-3-flash-preview");
        } catch (fallbackError: any) {
          console.error("Game Fallback also failed:", fallbackError.message);
          throw fallbackError;
        }
      }
      throw error;
    }
  });
};

export const generateGameIterative = async (
  message: string, 
  history: any[] = [], 
  currentData: any = null,
  mode: 'simple' | 'advanced' = 'simple',
  onProgress?: ProgressCallback
) => {
  const generate = async (model: string) => {
    const ai = getAi();
    
    if (onProgress) onProgress({ status: 'generating_content', message: `Ойынның ${mode === 'advanced' ? 'күрделі' : 'қарапайым'} нұсқасы жасалуда...` });

    const systemInstruction = `Сен — жоғары деңгейлі бағдарламалық сәулетші және білім беру ойындарының кәсіби дизайнерісің. Сенің міндетің — мұғалімнің сұранысы бойынша өте сапалы, күрделі және мазмұнды интерактивті ойындар жасау.

    РЕЖИМ: ${mode === 'advanced' ? 'КҮРДЕЛІ (ADVANCED)' : 'ҚАРАПАЙЫМ (SIMPLE)'}

    МАҢЫЗДЫ ЕРЕЖЕЛЕР:
    1. Жауап ТЕК ҚАНА таза JSON болуы тиіс. Маркдаун блоктарын ( \`\`\`json ) қолданба.
    2. Код сапасы: Clean Code принциптерін сақта.
    3. Көлем: 
       - ҚАРАПАЙЫМ режимде: 700-1600 жол код жаз. Суреттер қолданба (тек CSS/Canvas).
       - КҮРДЕЛІ режимде: 1600-5000 жол код жаз. Терең логика, анимациялар, деңгейлер қос.
    4. Web форматы: {"type": "web", "html": "...", "css": "...", "js": "...", "instructions": "...", "assetPrompts": {"key": "prompt"}}
    5. БЕЙІМДІЛІК (RESPONSIVENESS): Ойын кез келген экран өлшеміне автоматты түрде бейімделуі тиіс. Tailwind CSS-ті қолдан.
    6. КҮРДЕЛІ РЕЖИМДЕГІ СУРЕТТЕР: 
       - Ойынға қажетті барлық графикалық активтерді (фон, кейіпкерлер, нысандар) "assetPrompts" нысанында сипатта.
       - JS кодында бұл активтерді "ASSETS.кілт" түрінде қолдан (мысалы: const bg = ASSETS.background).
       - Мен бұл промпттар бойынша суреттер жасап, JS кодына автоматты түрде енгіземін.
    7. ЛОГИКА: Ойын логикасы өте терең ойластырылған, қызықты және білім беру мақсатына сай болуы керек.`;

    const response = await withTimeout(callGemini({
      model: model,
      contents: [...history, { role: 'user', parts: [{ text: message + `\n\nМАҢЫЗДЫ: Ойынды ${mode === 'advanced' ? 'күрделі (1600-5000 жол)' : 'қарапайым (700-1600 жол)'} режимде жасаңыз. Тек JSON қайтарыңыз.` }] }],
      config: { 
        responseMimeType: "application/json",
        systemInstruction: systemInstruction + "\n\nIMPORTANT: Your output must be a single, complete, and valid JSON object. Do not include any text outside the JSON. Do not truncate the JSON output.",
        temperature: 0.4,
        thinkingConfig: { thinkingLevel: mode === 'advanced' ? ThinkingLevel.HIGH : ThinkingLevel.LOW },
        maxOutputTokens: 16384
      }
    }), mode === 'advanced' ? 300000 : 180000);

    const data = safeJsonParse(response.text || "{}", {});
    if (!data || Object.keys(data).length === 0) {
      throw new Error("AI жауабын өңдеу мүмкін болмады. Қайта көріңіз.");
    }

    const finalMessage = 'Ойын сәтті жасалды!';

    if (onProgress) onProgress({ status: 'completed', message: finalMessage });
    return data;
  };

  return withRetry(async () => {
    try {
      // Use Pro for Advanced mode, Flash for Simple
      const model = mode === 'advanced' ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      return await generate(model);
    } catch (error: any) {
      console.warn("Iterative Game Error, trying Flash fallback:", error.message);
      
      const isQuotaError = error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('429');
      const isModelError = error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('404');
      
      if (isQuotaError || isModelError || error.message?.toLowerCase().includes('permission')) {
        try {
          return await generate("gemini-3-flash-preview");
        } catch (fallbackError: any) {
          console.error("Iterative Game Fallback also failed:", fallbackError.message);
          throw fallbackError;
        }
      }
      throw error;
    }
  });
};

export const generateAssessment = async (params: any, onProgress?: ProgressCallback) => {
  const ai = getAi();
  
  if (onProgress) onProgress({ status: 'generating_content', message: 'БЖБ/ТЖБ мазмұны жасалуда...' });
  
  const systemInstruction = `You are a professional AI system that generates structured school assessments (BZH/TZH) based on Kazakhstan educational standards.
  
  Follow this 9-step logic internally:
  
  STEP 1 — CONTENT ANALYSIS:
  - Analyze the provided textbook content or topic.
  - Extract key concepts, important facts, and learning objectives.
  - Organize them into a logical structure.
  
  STEP 2 — TASK GENERATION:
  - Generate ${params.taskCount || 5} tasks reflecting different cognitive levels: Knowledge, Understanding, Application, Analysis.
  - Use various task types: 
    * choice: Multiple choice.
    * true_false: True/False. IMPORTANT: The 'task' field MUST contain the statement to be evaluated.
    * matching: Matching pairs. IMPORTANT: Do NOT include the correct answers or examples in the 'task' text.
    * ordering: Ordering items. IMPORTANT: Do NOT include the correct order or examples in the 'task' text.
    * text: Short answer or open explanation.
    * table: Table completion.
    * map: General map question.
    * map_mark: Task where student must mark specific points on the map.
    * map_draw: Task where student must draw boundaries (e.g., of a country or region) on the map.
    * map_territory: Task where student must draw specific country borders or territories.
    * map_route: Task where student must draw military movement routes or war paths.
  
  STEP 3 — DESCRIPTORS:
  - For every task, generate specific descriptors explaining what the student must demonstrate.
  
  STEP 4 — SCORING SYSTEM:
  - Assign points to each task (usually 1-5 points) and calculate the total score.
  - For map_territory and map_route, provide the correct geometry in the mapConfig field.
  
  STEP 5 — MODE ADAPTATION:
  - Ensure tasks are suitable for both Offline (printable) and Online (interactive) formats.
  
  STEP 6-9: Handle logic for participant management, security, and grading.
  
  Output MUST be a valid JSON object in Kazakh language.
  IMPORTANT: For the "imagePrompt" field, provide a detailed description of the image in ENGLISH only. This is used for image generation. Example: "A realistic photo of a DNA double helix structure on a dark background".`;

  const prompt = `Create a complete ${params.type} (Summative Assessment) for:
  Subject: ${params.subject}
  Grade: ${params.grade}
  Topic/Content: ${params.topic}
  Difficulty: ${params.difficulty || "Medium"}
  Number of Tasks: ${params.taskCount || 5}
  Language: ${params.lang}
  Additional Requests: ${params.request || "None"}
  
  ${params.sourceText ? `Use this source text as the primary basis for tasks:
  --- SOURCE START ---
  ${params.sourceText}
  --- SOURCE END ---` : ""}
  
  The response must follow this JSON structure exactly:
  {
    "analysis": {
      "topic": "Тақырып атауы",
      "keyConcepts": ["Концепт 1", "Концепт 2"],
      "importantFacts": ["Дерек 1", "Дерек 2"],
      "skills": ["Дағды 1", "Дағды 2"]
    },
    "metadata": {
      "type": "${params.type}",
      "subject": "${params.subject}",
      "grade": "${params.grade}",
      "topic": "${params.topic}",
      "totalPoints": 0,
      "mode": "${params.mode}",
      "difficulty": "${params.difficulty || "Medium"}"
    },
    "tasks": [
      {
        "number": 1,
        "type": "choice | true_false | matching | ordering | text | table | map | cards | map_mark | map_draw | map_territory | map_route",
        "level": "Білу / Түсіну / Қолдану / Талдау",
        "task": "Тапсырма мәтіні мен нұсқаулық...",
        "imagePrompt": "Осы тапсырмаға қажетті суреттің сипаттамасы (тек қажет болса)",
        "options": ["A", "B", "C", "D"], // Only for choice/true_false
        "matchingPairs": [ { "left": "...", "right": "..." } ], // Only for matching
        "orderingItems": ["Элемент 1", "Элемент 2"], // Only for ordering
        "correctAnswer": "Дұрыс жауап",
        "mapUrl": "Search query for map", // Only for map types
        "mapConfig": {
          "center": [lat, lng],
          "zoom": number,
          "territories": [
            { "id": "t1", "name": "Country Name", "color": "#hex", "correctBoundary": [[lat, lng], ...] }
          ],
          "routes": [
            { "id": "r1", "name": "Route Name", "color": "#hex", "correctPath": [[lat, lng], ...] }
          ]
        },
        "criteria": "Бағалау критерийі",
        "descriptors": [
          { "description": "Сипаттама...", "point": 1 }
        ],
        "maxPoint": 1
      }
    ],
    "answerKey": [
      { "taskNumber": 1, "answer": "Дұрыс жауап немесе түсініктеме" }
    ]
  }`;

  const generate = async (model: string) => {
    console.log(`Attempting Assessment generation with model: ${model}`);
    const isPro = model.includes('pro');
    
    if (onProgress) onProgress({ status: 'generating', message: 'AI тапсырмаларды құрастыруда...' });

    const response = await withTimeout(callGemini({
      model: model,
      contents: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object. Do not truncate the response. Ensure all brackets and braces are closed correctly.",
      config: { 
        responseMimeType: "application/json",
        systemInstruction: systemInstruction + "\n\nIMPORTANT: Your output must be a single, complete, and valid JSON object. Do not include any text outside the JSON. Do not truncate the JSON output.",
        thinkingConfig: { 
          thinkingLevel: isPro ? ThinkingLevel.HIGH : ThinkingLevel.LOW 
        },
        temperature: 0.4,
        maxOutputTokens: 16384
      }
    }), 180000);
    
    if (!response.text) {
      const safetyRating = response.candidates?.[0]?.safetyRatings;
      console.warn("Gemini response empty for Assessment. Safety ratings:", safetyRating);
      throw new Error("AI жауабы бос немесе қауіпсіздік сүзгісімен блокталды. Сұранысты өзгертіп көріңіз.");
    }

    if (onProgress) onProgress({ status: 'parsing', message: 'Жауапты өңдеу...' });
    
    const data = safeJsonParse(response.text || "{}", {});
    
    // Validation
    if (!data || Object.keys(data).length === 0) {
      throw new Error("AI жауабын өңдеу мүмкін болмады. Қайта көріңіз.");
    }

    if (!data.tasks || !Array.isArray(data.tasks)) {
      throw new Error("Тапсырмалар тізімі табылмады. Қайта көріңіз.");
    }

    // Ensure metadata exists
    if (!data.metadata) {
      data.metadata = {
        type: params.type,
        subject: params.subject,
        grade: params.grade,
        topic: params.topic,
        totalPoints: data.tasks.reduce((acc: number, t: any) => acc + (t.maxPoint || 0), 0)
      };
    }
    
    const finalMessage = 'БЖБ/ТЖБ сәтті жасалды!';

    if (onProgress) onProgress({ status: 'completed', message: finalMessage });
    return data;
  };

  return withRetry(async () => {
    try {
      // Try Pro model first for complex assessment tasks
      return await generate("gemini-3.1-pro-preview");
    } catch (error: any) {
      console.warn("Pro model failed for assessment, falling back to Flash:", error);
      return await generate("gemini-3-flash-preview");
    }
  });
};

export const chatWithTeacher = async (message: string, history: any[] = [], context: string = "") => {
  return withRetry(async () => {
    try {
      const response = await withTimeout(callGemini({
        model: "gemini-3-flash-preview",
        contents: history.map(m => ({
          role: m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: m.text }]
        })).concat([{ role: 'user', parts: [{ text: message }] }]),
        config: {
          systemInstruction: `Сен — Bilge платформасының AI Мұғалімісің. Сенің есімің — DostUstaz. Сен студенттерге кез келген пән бойынша көмектесесің, бірақ жауапты бірден бермей, оларды ойлануға бағыттайсың. Қазақ тілінде сөйле. Жауаптарыңды Markdown форматында бер.${context ? "\n\nПайдалануға болатын контекст (білім базасынан):\n" + context : ""}`,
          maxOutputTokens: 16384
        },
      }));
      return response.text;
    } catch (error) {
      console.error("Gemini API Error in chatWithTeacher:", error);
      throw error; // Throw for withRetry to handle
    }
  }).catch(error => {
    console.error("Final Chat Error after retries:", error);
    return "Кешіріңіз, байланыс орнату кезінде қате шықты. Кейінірек қайталап көріңіз.";
  });
};

/**
 * Generate content using context from Knowledge Base
 */
export const generateWithContext = async (
  model: string,
  systemInstruction: string,
  prompt: string,
  context: string,
  onProgress?: ProgressCallback
) => {
  const ai = getAi();
  
  if (onProgress) onProgress({ status: 'generating_content', message: 'Мазмұн жасалуда...' });
  
  const fullPrompt = context 
    ? `БЕРІЛГЕН КОНТЕКСТТІ ПАЙДАЛАНЫП СҰРАНЫСТЫ ОРЫНДАҢЫЗ.
       
       КОНТЕКСТ:
       ${context}
       
       СҰРАНЫС:
       ${prompt}`
    : prompt;

  return withRetry(async () => {
    const response = await withTimeout(callGemini({
      model: model || "gemini-3-flash-preview",
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature: 0.4,
        responseMimeType: "application/json",
        maxOutputTokens: 16384
      }
    }));

    const data = safeJsonParse(response.text || "{}", {});
    
    if (onProgress) onProgress({ status: 'completed', message: 'Жасау аяқталды!' });
    return data;
  });
};


