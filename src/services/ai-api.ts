
import { GoogleGenAI, GenerateContentParameters } from "@google/genai";

export const getAi = (isImage: boolean = false) => {
  const apiKey = (isImage ? localStorage.getItem('IMAGE_GEN_API_KEY') : null)
    || localStorage.getItem('GEMINI_API_KEY') 
    || localStorage.getItem('gemini_api_key') 
    || (isImage ? (import.meta.env.VITE_IMAGE_GEN_API_KEY || "") : "")
    || (import.meta.env.VITE_GEMINI_API_KEY || "")
    || "";
  
  if (!apiKey || apiKey === "TODO_KEYHERE" || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
};

export const callGemini = async (params: GenerateContentParameters) => {
  const apiKey = (localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || "").trim();
  const ai = getAi();
  
  if (ai) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const errMsg = err.message?.toLowerCase() || "";
      const isApiKeyError = errMsg.includes("api key not valid") 
        || errMsg.includes("invalid api key")
        || errMsg.includes("400")
        || errMsg.includes("api_key_invalid");
      
      if (isApiKeyError) {
        console.warn("Client-side API key error, falling back to server proxy:", err);
      } else {
        throw err;
      }
    }
  }

  // Fallback to server proxy
  const response = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...params, apiKey }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  return await response.json();
};
