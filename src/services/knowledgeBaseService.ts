import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  Timestamp,
  serverTimestamp,
  writeBatch,
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { KBChunk, KBChunkDraft, KBCategory } from "../types";
import { ThinkingLevel, Type } from "@google/genai";
import { safeJsonParse } from "../lib/ai-utils";
import { getAi, callGemini } from "./ai-api";

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Use a more stable worker source for 5.x
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
}

/**
 * Helper to wrap promises with a timeout
 */
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 180000, customMessage?: string): Promise<T> => {
  let timeoutHandle: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const message = customMessage || `AI сұранысы ${timeoutMs}ms кейін тоқтатылды (Timeout)`;
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const withRetry = async <T>(fn: () => Promise<T>, retries: number = 5, delay: number = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.toLowerCase().includes('quota');
    const isOverloaded = error?.message?.includes('500') || error?.status === 500 || error?.message?.toLowerCase().includes('overloaded');
    
    if (retries <= 0) throw error;
    
    // If rate limit, wait much longer with exponential backoff
    const waitTime = isRateLimit ? Math.pow(3, 6 - retries) * 1000 : delay * (6 - retries);
    console.warn(`AI call failed (${isRateLimit ? 'Rate Limit' : isOverloaded ? 'Overloaded' : 'Error'}), retrying in ${waitTime}ms... (${retries} left)`);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return withRetry(fn, retries - 1, delay);
  }
};

import * as XLSX from 'xlsx';

/**
 * Extract text from various file types
 */
export const extractTextFromFile = async (file: File, onProgress?: (percent: number) => void): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  console.log(`Extracting text from ${file.name} (${extension}), size: ${file.size} bytes`);

  if (extension === 'txt') {
    if (onProgress) onProgress(100);
    return await file.text();
  } 
  
  if (extension === 'pdf') {
    console.log("Starting PDF extraction...");
    if (onProgress) onProgress(5);
    
    // Read file as array buffer with progress if possible
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error("Файлды оқу қатесі"));
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 10)); // First 10% for reading
        }
      };
      reader.readAsArrayBuffer(file);
    });

    console.log("PDF file read into memory. Loading document...");
    if (onProgress) onProgress(15);

    try {
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        // Increase memory limit for large PDFs if possible (some environments support this)
        disableFontFace: true // Speed up by not loading fonts
      });
      
      const pdf = await withTimeout(loadingTask.promise, 300000, "PDF құжатын жүктеу уақыты аяқталды (5 минут)"); // 5 min timeout for large PDFs
      console.log(`PDF loaded. Pages: ${pdf.numPages}`);
      
      // Parallelize page extraction for speed
      const pagePromises = [];
      let completedPages = 0;
      const totalPages = pdf.numPages;
      
      for (let i = 1; i <= totalPages; i++) {
        pagePromises.push((async () => {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            
            completedPages++;
            if (onProgress) {
              onProgress(15 + Math.round((completedPages / totalPages) * 85));
            }
            return text;
          } catch (err) {
            console.error(`Error on page ${i}:`, err);
            return "";
          }
        })());
      }
      
      const pageTexts = await Promise.all(pagePromises);
      const extractedText = pageTexts.join('\n\n').trim();

      // If text extraction is empty or very low, it's likely a scanned PDF. Use AI OCR.
      if (extractedText.length < 200 && totalPages > 0) {
        console.log("PDF appears to be scanned or empty. Using AI OCR fallback...");
        if (onProgress) onProgress(50);
        const ai = getAi();
        
        // For OCR, we only send a sample or the whole thing if it's small
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const response = await withTimeout(callGemini({
          model: "gemini-3-flash-preview",
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "application/pdf"
              }
            },
            { text: "Осы PDF құжатындағы барлық мәтінді танып, оны толықтай мәтін түрінде қайтар. Ешқандай түсініктеме қоспа, тек мәтінді бер. Егер құжат үлкен болса, негізгі мазмұнын сақтап, ең маңызды ақпаратты шығар." }
          ],
          config: {
            maxOutputTokens: 16384,
            temperature: 0.1 // Lower temperature for more accurate OCR
          }
        }), 300000, "PDF OCR өңдеу уақыты аяқталды (5 минут)"); // 5 minutes for OCR
        if (onProgress) onProgress(100);
        return response.text || "";
      }

      if (onProgress) onProgress(100);
      return extractedText;
    } catch (err: any) {
      console.error("PDF extraction failed:", err);
      throw new Error(`PDF өңдеу қатесі: ${err.message}`);
    }
  } 
  
  if (extension === 'docx') {
    console.log("Starting DOCX extraction...");
    if (onProgress) onProgress(10);
    const arrayBuffer = await file.arrayBuffer();
    const result = await withTimeout(mammoth.extractRawText({ arrayBuffer }), 120000, "DOCX файлын оқу уақыты аяқталды (2 минут)");
    if (onProgress) onProgress(100);
    return result.value;
  }

  if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
    console.log("Starting Spreadsheet extraction...");
    if (onProgress) onProgress(10);
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = "";
    
    workbook.SheetNames.forEach((sheetName, idx) => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_csv(worksheet);
      fullText += `--- ПАРАҚ: ${sheetName} ---\n${sheetText}\n\n`;
      if (onProgress) {
        onProgress(10 + Math.round(((idx + 1) / workbook.SheetNames.length) * 90));
      }
    });
    
    return fullText;
  }

  throw new Error(`Unsupported file format: ${extension}`);
};

/**
 * Stage 1: Quick save of raw file content to Firestore
 */
export const saveRawFile = async (
  file: File,
  onProgress: (stage: string, percent: number) => void
): Promise<string> => {
  onProgress("Файлды оқу...", 10);
  const rawText = await extractTextFromFile(file);
  
  onProgress("Мәтінді тазалау...", 40);
  const cleanText = preprocessText(rawText);
  
  onProgress("Базаға сақтау...", 70);

  const detectCategoryFromFileName = (name: string): KBCategory => {
    const n = name.toLowerCase();
    if (n.includes('оқулық') || n.includes('учебник') || n.includes('оқу құралы')) return 'book';
    if (n.includes('қмж') || n.includes('кмж') || n.includes('сабақ жоспар')) return 'lesson_plan';
    if (n.includes('бжб') || n.includes('тжб') || n.includes('тест') || n.includes('бағалау')) return 'assessment';
    if (n.includes('бағдарлама') || n.includes('curriculum')) return 'curriculum';
    if (n.includes('әдістеме') || n.includes('нұсқау')) return 'method';
    return 'standard';
  };

  const quickCategory = detectCategoryFromFileName(file.name);

  const docRef = doc(collection(db, "knowledge_base"));
  await setDoc(docRef, {
    title: file.name,
    content: cleanText,
    category: quickCategory,
    sourceFile: file.name,
    status: 'raw',          // <-- маркер: ещё не обработан
    chunkIndex: 0,
    totalChunks: 1,
    createdAt: serverTimestamp()
  });
  
  onProgress("Сақталды!", 100);
  return docRef.id;  // возвращаем ID для последующей обработки
};

/**
 * Stage 2: Background semantic chunking and AI processing
 */
export const processRawChunk = async (
  rawDocId: string,
  onProgress?: (stage: string, percent: number) => void,
  autoSave: boolean = true
): Promise<KBChunkDraft[] | void> => {
  // 1. Загрузить raw документ из Firestore
  const rawRef = doc(db, "knowledge_base", rawDocId);
  const rawSnap = await getDoc(rawRef);
  if (!rawSnap.exists()) throw new Error("Raw документ табылмады");
  
  const rawData = rawSnap.data();
  const cleanText = rawData.content as string;
  const fileName = rawData.sourceFile as string;

  onProgress?.("Метадеректерді талдау...", 5);
  const baselineMetadata = await extractMetadataWithAI(cleanText.substring(0, 30000), fileName);

  onProgress?.("AI арқылы бөліктерге бөлу...", 15);
  const draftsRaw = await windowedAiChunking(cleanText, {}, fileName, (p) => {
    onProgress?.(`AI өңдеу: ${p}%`, 15 + Math.round(p * 0.70));
  });

  const drafts = draftsRaw.length > 0 
    ? draftsRaw.map(d => ({ ...d, ...baselineMetadata, sourceFile: fileName, status: 'processed' }))
    : paragraphAwareFallback(cleanText).map((content, idx) => ({
        content,
        title: `${baselineMetadata.topic || fileName} - ${idx + 1}`,
        category: (baselineMetadata.category || 'standard') as KBCategory,
        subject: baselineMetadata.subject,
        grade: baselineMetadata.grade,
        topic: baselineMetadata.topic,
        chunkIndex: idx,
        totalChunks: 0,
        sourceFile: fileName,
        status: 'processed'
      }));

  const finalDrafts = drafts.map((d, idx) => ({ ...d, chunkIndex: idx, totalChunks: drafts.length }));

  if (autoSave) {
    onProgress?.("Embedding жасалуда...", 85);
    
    // 2. Сохранить финальные chunks (с embedding)
    await saveApprovedChunks(
      finalDrafts,
      (p) => onProgress?.(`Сақталуда: ${p}%`, 85 + Math.round(p * 0.14))
    );

    // 3. Удалить исходный raw документ (он заменён финальными)
    await deleteDoc(rawRef);
    
    onProgress?.("Дайын!", 100);
  } else {
    onProgress?.("Өңдеу аяқталды!", 100);
    return finalDrafts;
  }
};

/**
 * Basic text cleaning
 */
export const preprocessText = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Level 1: Structural Chunking (Heading based)
 */
const detectStructuralChunks = (text: string) => {
  // Simple regex for common headings in Kazakh/Russian/English
  const headingRegex = /^(#{1,6}\s.*|Chapter\s\d+.*|Бөлім\s\d+.*|Глава\s\d+.*|Тақырып:.*)/gim;
  const chunks: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = headingRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push(text.substring(lastIndex, match.index).trim());
    }
    lastIndex = match.index;
  }
  
  if (lastIndex < text.length) {
    chunks.push(text.substring(lastIndex).trim());
  }

  return chunks.filter(c => c.length > 50); // Filter out tiny fragments
};

/**
 * Level 3: Paragraph-aware Fallback Chunking
 */
const paragraphAwareFallback = (text: string, minWords = 200, maxWords = 800): string[] => {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    const wordCount = (currentChunk + p).split(/\s+/).length;
    
    if (wordCount > maxWords && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = p;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + p;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

/**
 * Extract metadata for a file using AI
 */
export const extractMetadataWithAI = async (text: string, fileName: string) => {
  const ai = getAi();
  const sample = text.substring(0, 15000); // Optimized sample size
  
  const prompt = `Файлдың метадеректерін анықта және тек JSON форматында қайтар.
  
  Файл атауы: ${fileName}
  Мәтін үлгісі: ${sample}
  
  КАТЕГОРИЯНЫ АНЫҚТАУ ЕРЕЖЕЛЕРІ (маңызды!):
  - "book" — мәтінде "оқулық", "учебник", "хрестоматия", "оқу құралы", 
    немесе файл атауында осы сөздер болса
  - "curriculum" — "бағдарлама", "curriculum", "оқу жоспары", "силлабус" болса
  - "lesson_plan" — "сабақ жоспары", "ҚМЖ", "КМЖ", "технологиялық карта" болса
  - "assessment" — "тест", "бағалау", "БЖБ", "ТЖБ", "емтихан" болса
  - "method" — "әдістеме", "нұсқаулық", "методическое пособие" болса
  - "standard" — тек егер жоғарыдағылардың ешқайсысы сәйкес келмесе ғана
  
  Файл атауы мен мәтін мазмұнын бірге талдап, дәл категорияны анықта.
  
  Қажетті өрістер: category, subcategory, subject, grade, quarter, topic, 
  learningObjectives, tags, structure.
  
  IMPORTANT: Return ONLY a valid JSON object. Do not truncate the response. Ensure all brackets and braces are closed correctly.`;

  try {
  const response = await withRetry(() => withTimeout(callGemini({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2000,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          subcategory: { type: Type.STRING },
          subject: { type: Type.STRING },
          grade: { type: Type.STRING },
          quarter: { type: Type.STRING },
          topic: { type: Type.STRING },
          learningObjectives: { type: Type.ARRAY, items: { type: Type.STRING } },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          structure: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  }), 60000, "Метадеректерді анықтау уақыты аяқталды (1 минут)")); // 60s for metadata

  return safeJsonParse(response.text || "{}") || {};
} catch (error) {
    console.error("Metadata extraction failed:", error);
    return {};
  }
};

/**
 * Refine chunks that are too large
 */
const refineOversizedChunks = async (chunk: KBChunkDraft): Promise<KBChunkDraft[]> => {
  const wordCount = chunk.content.split(/\s+/).length;
  if (wordCount <= 1000) return [chunk];

  console.log(`Refining oversized chunk (${wordCount} words)...`);
  const ai = getAi();
  const prompt = `Сен — білім беру материалдарын өңдеуші AI-сың. 
  Берілген мәтінді кішігірім, мағыналық жағынан аяқталған 2-3 бөлікке бөл. 
  МАҢЫЗДЫ: Мәтінді СӨЗБЕ-СӨЗ (verbatim) сақта, мазмұнын қысқартпа немесе өзгертпе. 
  Әр бөлік 400-800 сөз аралығында болсын.
  
  МӘТІН:
  ${chunk.content}`;

  try {
    const response = await withRetry(() => withTimeout(callGemini({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 16384,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              title: { type: Type.STRING }
            }
          }
        }
      }
    }), 90000));

    const subChunks = safeJsonParse(response.text || "[]") || [];
    return subChunks.map((sc: any, idx: number) => ({
      ...chunk,
      content: sc.content,
      title: `${chunk.title} (${idx + 1})`,
      chunkIndex: chunk.chunkIndex * 10 + idx
    }));
  } catch (error) {
    // Fallback to paragraph splitting if AI fails
    const paragraphs = chunk.content.split(/\n\n/);
    const mid = Math.floor(paragraphs.length / 2);
    return [
      { ...chunk, content: paragraphs.slice(0, mid).join("\n\n"), title: `${chunk.title} (1)` },
      { ...chunk, content: paragraphs.slice(mid).join("\n\n"), title: `${chunk.title} (2)`, chunkIndex: chunk.chunkIndex + 1 }
    ];
  }
};

/**
 * Level 2: AI Semantic Chunking with Windowing (Parallelized)
 */
let stopRequested = false;

/**
 * Stop any ongoing background processing
 */
export const stopBackgroundProcessing = () => {
  stopRequested = true;
  console.log("Background processing stop requested.");
};

const windowedAiChunking = async (
  text: string, 
  baselineMetadata: any, 
  fileName: string,
  onProgress?: (percent: number) => void,
  customSegmentSize?: number
): Promise<KBChunkDraft[]> => {
  stopRequested = false; // Reset on start
  const ai = getAi();
  const segmentSize = customSegmentSize || 15000; // Slightly larger segments to reduce total calls
  const overlap = 1000;
  
  const windowPrompts: string[] = [];
  for (let i = 0; i < text.length; i += (segmentSize - overlap)) {
    windowPrompts.push(text.substring(i, i + segmentSize));
  }

  console.log(`Fast-tracking ${windowPrompts.length} windows...`);

  const drafts: KBChunkDraft[] = [];
  const seenContent = new Set<string>();
  const CONCURRENCY_LIMIT = 2; // Increased for better throughput

  const processWindow = async (w: string, idx: number): Promise<KBChunkDraft[]> => {
    if (stopRequested) throw new Error("Processing stopped by user");
    const ai = getAi();
    try {
      // Streamlined prompt for faster generation
      const response = await withRetry(() => withTimeout(callGemini({
        model: "gemini-3-flash-preview",
        contents: `Берілген мәтінді мағыналық бөліктерге (бөлімдерге) бөл. 
МАҢЫЗДЫ: Мәтіннің мазмұнын СӨЗБЕ-СӨЗ (verbatim) сақта, қысқартпа. 
Әр бөлімге сәйкес келетін нақты тақырып бер.

Мәтін: ${w}

Жауапты ТЕК ҚАНА мына JSON форматында қайтар:
[{ "title": "Тақырып", "content": "Мәтін" }]

IMPORTANT: Return ONLY a valid JSON array of objects. Do not truncate the response. Ensure all brackets and braces are closed correctly.`,
        config: { 
          responseMimeType: "application/json",
          maxOutputTokens: 16384, // Increased to allow full content preservation
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          }
        }
      }), 120000, "AI арқылы мәтінді бөліктерге бөлу уақыты аяқталды (2 минут)")); // 120s is plenty for small segments

      const parsed = safeJsonParse(response.text || "[]") || [];
      return parsed.map((p: any) => ({
        title: p.title || "Бөлім",
        content: p.content || "",
        category: 'standard' as KBCategory,
        chunkIndex: idx,
        totalChunks: windowPrompts.length
      }));
    } catch (e: any) {
      console.error(`AI Window ${idx} failed, using fallback:`, e);
      // Immediate fallback for this window only to keep moving fast
      return [{
        title: `Бөлім ${idx + 1}`,
        content: w,
        category: 'standard' as KBCategory,
        chunkIndex: idx,
        totalChunks: windowPrompts.length
      }];
    }
  };

  // Process windows in larger parallel batches
  for (let i = 0; i < windowPrompts.length; i += CONCURRENCY_LIMIT) {
    const batch = windowPrompts.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map((w, index) => processWindow(w, i + index))
    );

    batchResults.flat().forEach(d => {
      const contentKey = d.content.substring(0, 50);
      if (!seenContent.has(contentKey)) {
        seenContent.add(contentKey);
        drafts.push(d);
      }
    });

    if (onProgress) {
      const currentProgress = Math.min(95, Math.round(((i + batch.length) / windowPrompts.length) * 100));
      onProgress(currentProgress);
    }
    
    // Add a smaller delay between batches to allow other API calls to go through
    if (i + CONCURRENCY_LIMIT < windowPrompts.length) {
      if (stopRequested) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return drafts.map((d, idx) => ({
    ...d,
    ...baselineMetadata,
    sourceFile: fileName,
    chunkIndex: idx,
    totalChunks: drafts.length
  }));
};

/**
 * Main Ingestion Pipeline
 */
export const ingestFile = async (
  file: File, 
  onProgress: (stage: string, percent: number) => void
): Promise<KBChunkDraft[]> => {
  const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Файл көлемі тым үлкен (макс. 1ГБ)");
  }

  onProgress("Файлды оқу...", 2);
  
  // For very large files, we process in chunks if it's a text-based file
  const extension = file.name.split('.').pop()?.toLowerCase();
  const isTextBased = ['txt', 'csv', 'json'].includes(extension || '');

  if (isTextBased && file.size > 5 * 1024 * 1024) { // > 5MB
    return await ingestLargeTextFile(file, onProgress);
  }

  const rawText = await extractTextFromFile(file, (p) => {
    // Map 0-100% of extraction to 2-15% of total progress
    onProgress(`Мәтінді шығару: ${p}%`, 2 + Math.round(p * 0.13));
  });
  
  onProgress("Мәтінді тазалау және өңдеу...", 15);
  const cleanText = preprocessText(rawText);
  
  onProgress("Метадеректерді талдау...", 18);
  const baselineMetadata = await extractMetadataWithAI(cleanText.substring(0, 30000), file.name);
  
  onProgress("Мағыналық бөліктерге бөлу (AI)...", 20);
  const draftsRaw = await windowedAiChunking(cleanText, {}, file.name, (p) => {
    onProgress(`AI өңдеу: ${p}%`, 20 + Math.round(p * 0.78));
  });

  // Merge metadata into drafts
  const drafts = draftsRaw.map(d => ({
    ...d,
    ...baselineMetadata,
    sourceFile: file.name
  }));
  
  if (drafts.length === 0) {
    onProgress("Fallback қолдану...", 80);
    const fallbackChunks = paragraphAwareFallback(cleanText);
    return fallbackChunks.map((content, idx) => ({
      content,
      title: `${baselineMetadata.topic || file.name} - ${idx + 1}`,
      category: baselineMetadata.category || 'standard',
      subject: baselineMetadata.subject,
      grade: baselineMetadata.grade,
      topic: baselineMetadata.topic,
      chunkIndex: idx,
      totalChunks: fallbackChunks.length,
      sourceFile: file.name
    }));
  }

  onProgress("Дайын!", 100);
  return drafts;
};

/**
 * Optimized ingestion for large text files
 */
async function ingestLargeTextFile(file: File, onProgress: (stage: string, percent: number) => void): Promise<KBChunkDraft[]> {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for better reliability
  const totalDrafts: KBChunkDraft[] = [];
  const totalSize = file.size;
  let offset = 0;

  onProgress("Метадеректерді анықтау...", 2);
  // Extract baseline metadata from the first chunk
  const firstChunkBlob = file.slice(0, 30000); // Reduced to 30KB
  const firstChunk = await firstChunkBlob.text();
  const baselineMetadata = await extractMetadataWithAI(firstChunk, file.name);

  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize);
    const blob = file.slice(offset, end);
    const text = await blob.text();
    const cleanText = preprocessText(text);
    
    const overallPercent = Math.round((offset / totalSize) * 100);
    onProgress(`Үлкен файлды өңдеу: ${overallPercent}%`, Math.max(5, overallPercent));

    // Use a much larger window size for large files to reduce AI calls significantly
    const windowDrafts = await windowedAiChunking(cleanText, baselineMetadata, file.name, (p) => {
      // Sub-progress within the current chunk
      const subPercent = overallPercent + Math.round(p * (CHUNK_SIZE / totalSize));
      onProgress(`AI өңдеу (${overallPercent}%): ${p}%`, Math.min(99, subPercent));
    }, 25000); // Optimized segment size for large files
    
    totalDrafts.push(...windowDrafts);

    offset += CHUNK_SIZE - 5000; // Reduced overlap for smaller chunks

    // Safety break for extremely large files
    if (totalDrafts.length > 20000) {
      console.warn("Reached maximum draft limit (20,000). Truncating ingestion.");
      break;
    }
    
    // Small delay to prevent rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  onProgress("Дайын!", 100);
  return totalDrafts.map((d, idx) => ({ ...d, chunkIndex: idx, totalChunks: totalDrafts.length }));
}

/**
 * Generate embedding for a text chunk
 */
export const generateEmbedding = async (text: string) => {
  const ai = getAi();
  try {
    const result = await withTimeout(ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: [text]
    }), 20000, "Мәтін эмбеддингін жасау уақыты аяқталды (20 секунд)"); // Shorter timeout for embeddings
    return result.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error("Embedding generation failed:", error);
    return [];
  }
};

/**
 * Save chunks to Firestore in batches
 */
export const saveApprovedChunks = async (
  chunks: KBChunkDraft[], 
  onProgress?: (percent: number) => void
) => {
  const BATCH_LIMIT = 500; // Firestore maximum batch size
  const total = chunks.length;
  let saved = 0;

  const ai = getAi();

  for (let i = 0; i < total; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const currentBatch = chunks.slice(i, i + BATCH_LIMIT);
    
    // Generate embeddings for the batch using batchEmbedContents
    const EMBED_BATCH_SIZE = 100; // Gemini batch embedding limit is usually 100
    const chunksWithEmbeddings: any[] = [];
    
    for (let j = 0; j < currentBatch.length; j += EMBED_BATCH_SIZE) {
      const subBatch = currentBatch.slice(j, j + EMBED_BATCH_SIZE);
      
      try {
        const result = await withTimeout(ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: subBatch.map(chunk => ({
            parts: [{ text: chunk.content }]
          }))
        }), 60000, "Бөліктер тобының эмбеддингін жасау уақыты аяқталды (1 минут)"); // 60s for a batch of 100 embeddings

        const embeddings = result.embeddings || [];
        
        subBatch.forEach((chunk, index) => {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: embeddings[index]?.values || []
          });
        });
      } catch (error) {
        console.error("Batch embedding failed, falling back to sequential:", error);
        // Fallback to sequential if batch fails
        for (const chunk of subBatch) {
          const embedding = await generateEmbedding(chunk.content);
          chunksWithEmbeddings.push({ ...chunk, embedding });
        }
      }
    }
    
    chunksWithEmbeddings.forEach(chunk => {
      const docRef = doc(collection(db, "knowledge_base"));
      batch.set(docRef, {
        ...chunk,
        createdAt: serverTimestamp()
      });
    });
    
    try {
      await batch.commit();
      saved += currentBatch.length;
      if (onProgress) {
        onProgress(Math.round((saved / total) * 100));
      }
    } catch (error) {
      console.error("Batch commit failed:", error);
      throw error;
    }
  }
};

/**
 * Search Knowledge Base
 */
export const searchKnowledgeBase = async (queryOrParams: string | {
  category?: KBCategory;
  subject?: string;
  grade?: string;
  topic?: string;
  tags?: string[];
  limitCount?: number;
}) => {
  const chunksRef = collection(db, "knowledge_base");
  
  if (typeof queryOrParams === 'string') {
    // For simple text search, we fetch recent and filter client-side (Firestore limitation)
    const q = query(chunksRef, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KBChunk));
    const lower = queryOrParams.toLowerCase();
    return all.filter(c => 
      c.title.toLowerCase().includes(lower) || 
      c.topic?.toLowerCase().includes(lower) ||
      c.content.toLowerCase().includes(lower) ||
      c.tags?.some(t => t.toLowerCase().includes(lower))
    );
  }

  const { category, subject, grade, topic, tags, limitCount = 20 } = queryOrParams;
  let q = query(chunksRef);
  
  if (category) q = query(q, where('category', '==', category));
  if (subject) q = query(q, where('subject', '==', subject));
  if (grade) q = query(q, where('grade', '==', grade));
  
  // Fetch more to allow client-side filtering and sorting
  q = query(q, limit(100));

  const snapshot = await getDocs(q);
  let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KBChunk));

  // Client-side sorting by createdAt DESC
  results.sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  if (topic) {
    const topicLower = topic.toLowerCase();
    results = results.filter(c => 
      c.topic?.toLowerCase().includes(topicLower) || 
      topicLower.includes(c.topic?.toLowerCase() || "") ||
      c.content.toLowerCase().includes(topicLower)
    );
  }

  if (tags && tags.length > 0) {
    const tagsLower = tags.map(t => t.toLowerCase());
    results = results.filter(c => 
      c.tags?.some(t => tagsLower.includes(t.toLowerCase()))
    );
  }

  return results.slice(0, limitCount);
};

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

/**
 * Semantic Search using Vector Embeddings + AI Ranking
 */
export const semanticSearch = async (userQuery: string, params: {
  subject?: string;
  grade?: string;
  category?: KBCategory;
}) => {
  const ai = getAi();
  
  try {
    // 1. Generate embedding for the user query
    console.log("Generating embedding for query:", userQuery);
    const queryEmbedding = await generateEmbedding(userQuery);
    const hasQueryEmbedding = queryEmbedding && queryEmbedding.length > 0;

    // 2. Fetch candidates from Firestore
    const chunksRef = collection(db, "knowledge_base");
    let q = query(chunksRef);
    
    if (params.category) q = query(q, where('category', '==', params.category));
    if (params.subject) q = query(q, where('subject', '==', params.subject));
    if (params.grade) q = query(q, where('grade', '==', params.grade));
    
    // Fetch a larger pool for vector comparison
    q = query(q, limit(500));
    
    const snapshot = await getDocs(q);
    let allChunks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KBChunk));

    // Client-side sorting by createdAt DESC
    allChunks.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    if (allChunks.length === 0) return [];

    // 3. Rank by Vector Similarity if embeddings are available
    let candidates = allChunks;
    if (hasQueryEmbedding) {
      console.log("Ranking candidates by vector similarity...");
      candidates = allChunks
        .map(chunk => ({
          ...chunk,
          similarity: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0
        }))
        .sort((a, b) => (b as any).similarity - (a as any).similarity)
        .slice(0, 40); // Take top 40 for AI ranking (faster than 150)
    } else {
      // Fallback to most recent if embedding failed
      candidates = allChunks.slice(0, 40);
    }

    // 4. Use AI to rank the top candidates for final selection
    console.log(`Using AI to rank top ${candidates.length} candidates...`);
    const aiCandidates = candidates.map(c => ({ 
      id: c.id, 
      title: c.title, 
      topic: c.topic,
      content: c.content.substring(0, 200)
    }));

    const prompt = `Пайдаланушы сұранысы: "${userQuery}"
    
    Төмендегі білім базасының үзінділерінен ең сәйкес келетін 7-10 үзіндіні таңда.
    Тек ID-лер тізімін JSON форматында қайтар: ["id1", "id2", ...]
    
    ҮЗІНДІЛЕР (ID | Тақырып | Мазмұн):
    ${aiCandidates.map(c => `${c.id} | ${c.title} | ${c.topic} - ${c.content}`).join('\n')}`;

    const response = await withTimeout(callGemini({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Сен — ақпаратты іздеу және саралау маманысың. Пайдаланушы сұранысына ең жақын мәтіндерді тауып, олардың ID-лерін ғана қайтар.",
        maxOutputTokens: 16384,
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    }), 45000, "Семантикалық іздеуді саралау уақыты аяқталды (45 секунд)");

    const relevantIds = safeJsonParse(response.text || "[]") || [];
    
    // 5. Fetch full data for relevant IDs
    const results = await Promise.all(relevantIds.map(async (id: string) => {
      const cand = candidates.find(c => c.id === id);
      if (!cand) return null;
      return cand;
    }));

    return results.filter(r => r !== null) as KBChunk[];
  } catch (error) {
    console.error("Semantic search failed:", error);
    // Fallback to basic keyword search if everything fails
    return searchKnowledgeBase(userQuery);
  }
};

/**
 * Update metadata for an existing chunk
 */
export const updateChunkMetadata = async (id: string, metadata: Partial<KBChunk>) => {
  await updateDoc(doc(db, "knowledge_base", id), {
    ...metadata,
    updatedAt: serverTimestamp()
  });
};

/**
 * Delete a chunk from the knowledge base
 */
export const deleteChunk = async (id: string) => {
  await deleteDoc(doc(db, "knowledge_base", id));
};

/**
 * Build filters based on generator type
 */
export const buildFiltersForGenerator = (type: string, params: any) => {
  const filters: any = {
    subject: params.subject,
    grade: params.grade,
    topic: params.topic,
    limitCount: 10
  };

  switch (type) {
    case 'lesson_plan':
      // For lesson plans, we can use curriculum or standard info
      break;
    case 'assessment':
      filters.category = 'assessment';
      break;
    case 'game':
      filters.category = 'book';
      break;
  }

  return filters;
};

/**
 * Get context for a generator using optimized Firestore-first filtering
 */
export const getContextForGenerator = async (type: string, params: any): Promise<string> => {
  const chunksRef = collection(db, "knowledge_base");
  
  // 1. Build a highly targeted Firestore query
  let q = query(chunksRef);
  
  if (params.subject) q = query(q, where('subject', '==', params.subject));
  if (params.grade) q = query(q, where('grade', '==', params.grade));
  
  // Map generator type to KB category
  const categoryMap: Record<string, KBCategory> = {
    'lesson_plan': 'curriculum',
    'assessment': 'assessment',
    'game': 'book'
  };
  
  if (categoryMap[type]) {
    q = query(q, where('category', '==', categoryMap[type]));
  }

  try {
    // 2. Execute query (No API call here)
    const snapshot = await getDocs(q);
    let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KBChunk));

    // 3. Simple keyword filtering on the client side (still no API)
    if (params.topic && results.length > 0) {
      const topicLower = params.topic.toLowerCase();
      // Filter results that mention the topic in title, topic field or content
      results = results.filter(c => 
        c.topic?.toLowerCase().includes(topicLower) || 
        c.title.toLowerCase().includes(topicLower) ||
        c.content.toLowerCase().includes(topicLower) ||
        (c.learningObjectives && c.learningObjectives.some(lo => topicLower.includes(lo.toLowerCase())))
      );
    }

    // 4. If we found too many, take the most recent ones
    if (results.length > 5) {
      // Sort by createdAt DESC
      results.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      results = results.slice(0, 5);
    }

    if (results.length === 0) {
      console.log("No specific context found in Database for this topic.");
      return "";
    }

    console.log(`Found ${results.length} relevant chunks in Database without API.`);

    // 5. Return formatted context for Gemini to work with
    return results
      .map(r => `--- ДЕРЕККӨЗ: ${r.title} (Санат: ${r.category}) ---\n${r.content}`)
      .join("\n\n");

  } catch (error) {
    console.error("Database filtering failed:", error);
    return "";
  }
};
