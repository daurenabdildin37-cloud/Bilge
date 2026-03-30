
import { callAgent } from "./multiAgentService";
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export interface TeacherMemory {
  prompts: { [key: string]: string };
  preferences: {
    preferredFormat: string;
    preferredGrade: string;
    preferredSubject: string;
    additionalNotes: string;
  };
  history: Array<{
    type: string;
    topic: string;
    timestamp: number;
    success: boolean;
  }>;
  patterns: Array<{
    pattern: string;
    count: number;
  }>;
  lastUpdated: number;
}

export const MEMORY_FILE_NAME = 'bilge-ai-memory.json';
export const MEMORY_FOLDER_NAME = 'Білге AI';

export function getAccessToken(): string | null {
  return localStorage.getItem('google_access_token');
}

export function saveAccessToken(token: string): void {
  localStorage.setItem('google_access_token', token);
}

export async function initGoogleDriveAuth(): Promise<boolean> {
  // Always try to get a fresh token if we're calling this, 
  // or at least don't skip if we just cleared it.
  
  try {
    const provider = new GoogleAuthProvider();
    // Add Drive scope explicitly to a fresh provider instance
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    // Force consent to ensure the user sees the Drive permission checkbox
    provider.setCustomParameters({ 
      prompt: 'consent',
      access_type: 'offline'
    });
    
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (accessToken) {
      saveAccessToken(accessToken);
      // Clear cache to force reload with new token
      localStorage.removeItem('bilge_memory_cache');
      localStorage.removeItem('bilge_memory_cache_time');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Google Drive Auth Error:', error);
    return false;
  }
}

export function clearMemoryAuth(): void {
  localStorage.removeItem('google_access_token');
}

export async function findOrCreateFolder(): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token');

  const q = `name='${MEMORY_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name)`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      const errorBody = await response.json().catch(() => ({}));
      console.error(`Drive API ${response.status} Error:`, errorBody);
      clearMemoryAuth();
      throw new Error(`Unauthorized or Forbidden: ${response.status}. Please reconnect Google Drive in Settings.`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Drive API Error (Search):', errorData);
      throw new Error(`Failed to search for folder: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create folder
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: MEMORY_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (createResponse.status === 401 || createResponse.status === 403) {
      clearMemoryAuth();
      throw new Error(`Unauthorized or Forbidden: ${createResponse.status}`);
    }

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      console.error('Drive API Error (Create):', errorData);
      throw new Error(`Failed to create folder: ${createResponse.status}`);
    }

    const folderData = await createResponse.json();
    return folderData.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      throw error;
    }
    console.error('findOrCreateFolder Error:', error);
    throw error;
  }
}

export async function loadMemory(): Promise<TeacherMemory | null> {
  // Check cache
  const cached = localStorage.getItem('bilge_memory_cache');
  const cachedTime = localStorage.getItem('bilge_memory_cache_time');
  if (cached && cachedTime) {
    const now = Date.now();
    const diff = now - parseInt(cachedTime);
    if (diff < 10 * 60 * 1000) { // 10 minutes
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached memory:', e);
      }
    }
  }

  const token = getAccessToken();
  if (!token) return null;

  try {
    const folderId = await findOrCreateFolder();
    const q = `name='${MEMORY_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      const errorBody = await response.json().catch(() => ({}));
      console.error(`Drive API ${response.status} Error (loadMemory):`, errorBody);
      clearMemoryAuth();
      throw new Error(`Unauthorized or Forbidden: ${response.status}. Please reconnect Google Drive.`);
    }

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.files || data.files.length === 0) return null;

    const fileId = data.files[0].id;
    const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (contentResponse.status === 401 || contentResponse.status === 403) {
      const errorBody = await contentResponse.json().catch(() => ({}));
      console.error(`Drive API ${contentResponse.status} Error (loadMemory content):`, errorBody);
      clearMemoryAuth();
      throw new Error(`Unauthorized or Forbidden: ${contentResponse.status}. Please reconnect Google Drive.`);
    }

    if (!contentResponse.ok) return null;

    const memory = await contentResponse.json();
    
    // Update cache
    localStorage.setItem('bilge_memory_cache', JSON.stringify(memory));
    localStorage.setItem('bilge_memory_cache_time', Date.now().toString());

    return memory;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('Forbidden'))) {
      throw error;
    }
    console.error('Error loading memory from Google Drive:', error);
    return null;
  }
}

export async function saveMemory(memory: TeacherMemory): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const folderId = await findOrCreateFolder();
    const q = `name='${MEMORY_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
    const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (searchResponse.status === 401 || searchResponse.status === 403) {
      const errorBody = await searchResponse.json().catch(() => ({}));
      console.error(`Drive API ${searchResponse.status} Error (saveMemory search):`, errorBody);
      clearMemoryAuth();
      throw new Error(`Unauthorized or Forbidden: ${searchResponse.status}. Please reconnect Google Drive.`);
    }

    if (!searchResponse.ok) return false;

    const searchData = await searchResponse.json();
    const fileExists = searchData.files && searchData.files.length > 0;

    if (fileExists) {
      const fileId = searchData.files[0].id;
      const updateResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(memory)
      });
      
      if (updateResponse.status === 401 || updateResponse.status === 403) {
        const errorBody = await updateResponse.json().catch(() => ({}));
        console.error(`Drive API ${updateResponse.status} Error (saveMemory update):`, errorBody);
        clearMemoryAuth();
        throw new Error(`Unauthorized or Forbidden: ${updateResponse.status}. Please reconnect Google Drive.`);
      }

      if (updateResponse.ok) {
        // Update cache
        localStorage.setItem('bilge_memory_cache', JSON.stringify(memory));
        localStorage.setItem('bilge_memory_cache_time', Date.now().toString());
        return true;
      }
      return false;
    } else {
      // Create new file using multipart upload
      const metadata = {
        name: MEMORY_FILE_NAME,
        mimeType: 'application/json',
        parents: [folderId]
      };

      const boundary = 'boundary';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const body = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(memory) +
        closeDelimiter;

      const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: body
      });

      if (createResponse.status === 401 || createResponse.status === 403) {
        const errorBody = await createResponse.json().catch(() => ({}));
        console.error(`Drive API ${createResponse.status} Error (saveMemory create):`, errorBody);
        clearMemoryAuth();
        throw new Error(`Unauthorized or Forbidden: ${createResponse.status}. Please reconnect Google Drive.`);
      }

      if (createResponse.ok) {
        // Update cache
        localStorage.setItem('bilge_memory_cache', JSON.stringify(memory));
        localStorage.setItem('bilge_memory_cache_time', Date.now().toString());
        return true;
      }
      return false;
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('Forbidden'))) {
      throw error;
    }
    console.error('Error saving memory to Google Drive:', error);
    return false;
  }
}

export async function updateMemoryAfterGeneration(type: string, topic: string, success: boolean): Promise<void> {
  let memory = await loadMemory();

  if (!memory) {
    memory = {
      prompts: {},
      preferences: {
        preferredFormat: '',
        preferredGrade: '',
        preferredSubject: '',
        additionalNotes: ''
      },
      history: [],
      patterns: [],
      lastUpdated: Date.now()
    };
  }

  // Add to history
  memory.history.push({
    type,
    topic,
    timestamp: Date.now(),
    success
  });

  // Keep last 50 entries
  if (memory.history.length > 50) {
    memory.history = memory.history.slice(-50);
  }

  // Update patterns
  const existingPattern = memory.patterns.find(p => p.pattern === type);
  if (existingPattern) {
    existingPattern.count += 1;
  } else {
    memory.patterns.push({
      pattern: type,
      count: 1
    });
  }

  memory.lastUpdated = Date.now();

  await saveMemory(memory);
}

export async function improvePrompt(basePrompt: string, type: string): Promise<string> {
  const memory = await loadMemory();
  if (!memory) return basePrompt;

  try {
    // Get successful generation examples for this type
    const examples = memory.history
      .filter(h => h.type === type && h.success)
      .slice(-5)
      .map(h => h.topic)
      .join(', ');

    // Get top 3 patterns
    const topPatterns = [...memory.patterns]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(p => p.pattern)
      .join(', ');

    const { preferredFormat, preferredSubject, preferredGrade } = memory.preferences;

    const systemPrompt = `Сен промпт жақсартушы AI-сың. Берілген базалық промптты мұғалімнің жеке қалаулары мен тарихы негізінде жақсарт. Тек жақсартылған промптты қайтар, басқа ештеңе жазба.`;
    
    const userPrompt = `
      Базалық промпт: ${basePrompt}
      Тарих үлгілері: ${examples || 'Жоқ'}
      Жиі қолданылатын үлгілер: ${topPatterns || 'Жоқ'}
      Қалаулар: Пән - ${preferredSubject}, Сынып - ${preferredGrade}, Формат - ${preferredFormat}
    `;

    const result = await callAgent('generator', systemPrompt, userPrompt);
    
    if (result.success && result.content) {
      return result.content.trim();
    }
    return basePrompt;
  } catch (error) {
    console.error('Error improving prompt:', error);
    return basePrompt;
  }
}

export async function getPersonalizedGreeting(): Promise<string> {
  const memory = await loadMemory();
  if (!memory || memory.history.length === 0) {
    return 'Сәлем! Бүгін не жасаймыз?';
  }

  const last5 = memory.history.slice(-5);
  const typeCounts: { [key: string]: number } = {};
  last5.forEach(h => {
    typeCounts[h.type] = (typeCounts[h.type] || 0) + 1;
  });

  let mostFrequentType = '';
  let maxCount = 0;
  for (const type in typeCounts) {
    if (typeCounts[type] > maxCount) {
      maxCount = typeCounts[type];
      mostFrequentType = type;
    }
  }

  const subject = memory.preferences.preferredSubject || 'өз пәніңіз';
  
  const typeNames: { [key: string]: string } = {
    'kmzh': 'ҚМЖ',
    'assessment': 'БЖБ/ТЖБ',
    'game': 'ойын'
  };

  const typeName = typeNames[mostFrequentType] || 'материал';

  return `Сәлем! ${subject} пәні бойынша ${typeName} жасауды жалғастырайық па?`;
}
