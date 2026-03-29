
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import OpenAI from "openai";
import { knowledgeService, Material } from "./knowledge.service";

const getAi = (isImage: boolean = false, providedKey?: string) => {
  // Priority: 
  // 1. providedKey (passed from client)
  // 2. IMAGE_GEN_API_KEY (if provided specifically for images)
  // 3. API_KEY (user-selected key from AI Studio dialog)
  // 4. GEMINI_API_KEY (default platform key)
  const key = providedKey
    || (isImage ? process.env.IMAGE_GEN_API_KEY : null) 
    || process.env.API_KEY 
    || process.env.GEMINI_API_KEY 
    || "";
  
  if (!key || key === "TODO_KEYHERE" || key.trim() === "") {
    throw new Error("API key is missing or invalid. Please configure your API key in the settings.");
  }
  
  return new GoogleGenAI({ apiKey: key.trim() });
};

export class AIService {
  async generateWithRAG(userId: string, prompt: string, options: {
    subject?: string;
    grade?: string;
    topic?: string;
  } = {}): Promise<string> {
    const ai = getAi();
    // 1. Search for relevant materials in Knowledge Base
    // ...
    const searchQuery = options.topic || prompt.substring(0, 100);
    const relatedMaterials = await knowledgeService.searchMaterials(searchQuery, userId, 3);

    // 2. Format context from materials
    let context = "";
    if (relatedMaterials.length > 0) {
      context = "\nUse the following existing materials as reference:\n---\n";
      relatedMaterials.forEach((m, i) => {
        context += `Material ${i + 1} (${m.title}):\n${m.content}\n\n`;
      });
      context += "---\nNow generate improved content.\n";
    }

    // 3. Construct final prompt
    const finalPrompt = `${context}\nUser Request: ${prompt}`;

    // 4. Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: finalPrompt,
    });
    const text = response.text || "";

    // 5. Bonus: Automatically save generated content
    await this.saveGeneratedContentAutomatically(userId, text, options);

    return text;
  }

  async generateImage(prompt: string, aspectRatio: string = "1:1", providedKey?: string): Promise<string | null> {
    const rawKey = providedKey || process.env.IMAGE_GEN_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY || "";
    const key = rawKey.trim();
    
    // Check if it's an OpenAI key
    if (key && key.startsWith('sk-')) {
      try {
        console.log("Server: Using OpenAI for image generation...");
        const openai = new OpenAI({ apiKey: key.trim() });
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: aspectRatio === '1:1' ? "1024x1024" : aspectRatio === '16:9' ? "1792x1024" : "1024x1792",
        });
        return response.data[0].url || null;
      } catch (error: any) {
        console.error("Server: OpenAI Image Generation Error:", error);
        // If it's an API key error, throw a clear message
        if (error.status === 401 || error.message?.includes('invalid_api_key')) {
          throw new Error("OpenAI API кілті жарамсыз. Баптаулардан тексеріңіз.");
        }
        throw error;
      }
    }

    const imageAi = getAi(true, providedKey);
    const generateWithModel = async (modelName: string) => {
      try {
        return await imageAi.models.generateContent({
          model: modelName,
          contents: [{ parts: [{ text: `Generate a high-quality image based on this description: ${prompt}. DO NOT return any text, ONLY the image.` }] }],
          config: {
            systemInstruction: "You are a specialized image generation model. Your ONLY task is to generate an image based on the user's prompt. You MUST NOT output any text, explanations, or chat. If you cannot generate the image, return an empty response, but never text.",
            imageConfig: {
              aspectRatio: aspectRatio as any
            }
          }
        });
      } catch (err: any) {
        console.error(`Error generating with ${modelName}:`, err);
        throw err;
      }
    };

    try {
      let response;
      let lastError;

      // Try Gemini 3.1 Flash Image first
      try {
        response = await generateWithModel('gemini-3.1-flash-image-preview');
      } catch (err: any) {
        lastError = err;
        // Fallback to 2.5 Flash Image
        try {
          response = await generateWithModel('gemini-2.5-flash-image');
        } catch (err2: any) {
          lastError = err2;
          // Final fallback to Imagen if available (using generateImages)
          try {
            // Try imagen-3.0-generate-001 first, then imagen-3.0-generate-001
            const imagenModels = ['imagen-3.0-generate-001', 'imagen-3.0-generate-001'];
            for (const model of imagenModels) {
              try {
                const imagenResponse = await imageAi.models.generateImages({
                  model: model,
                  prompt: prompt,
                  config: {
                    numberOfImages: 1,
                    aspectRatio: aspectRatio as any,
                  },
                });
                if (imagenResponse.generatedImages?.[0]?.image?.imageBytes) {
                  return `data:image/png;base64,${imagenResponse.generatedImages[0].image.imageBytes}`;
                }
              } catch (err) {
                console.warn(`Imagen model ${model} failed:`, err);
              }
            }
          } catch (err3) {
            console.error("All Imagen fallbacks failed:", err3);
          }
          throw lastError;
        }
      }

      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }

      // If no image but text was returned, log it
      const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
      if (textPart?.text) {
        console.warn("AI returned text instead of image:", textPart.text);
        throw new Error(`AI returned text instead of image: ${textPart.text.substring(0, 100)}...`);
      }

      return null;
    } catch (error: any) {
      console.error("Server Image Generation Error:", error);
      throw error;
    }
  }

  async generateContent(params: any): Promise<GenerateContentResponse> {
    const { apiKey, ...rest } = params;
    const ai = getAi(false, apiKey);
    return await ai.models.generateContent(rest);
  }

  private async saveGeneratedContentAutomatically(userId: string, content: string, options: any) {
    try {
      // Simple extraction of title from content (first line or similar)
      const title = options.topic || content.split("\n")[0].substring(0, 50) || "Generated Material";
      
      await knowledgeService.saveMaterial({
        userId,
        title,
        content,
        subject: options.subject,
        grade: options.grade,
        topic: options.topic,
      });
    } catch (error) {
      console.error("Failed to auto-save material:", error);
    }
  }
}

export const aiService = new AIService();
