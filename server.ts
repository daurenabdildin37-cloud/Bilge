
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";
import { knowledgeService } from "./server/services/knowledge.service";
import { aiService } from "./server/services/ai.service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(compression());
  app.use(express.json());

  // Knowledge Base Endpoints
  app.post("/api/save-material", async (req, res) => {
    try {
      const { userId, title, subject, grade, topic, content } = req.body;
      if (!userId || !title || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const id = await knowledgeService.saveMaterial({ userId, title, subject, grade, topic, content });
      res.json({ id, message: "Material saved successfully" });
    } catch (error: any) {
      console.error("Save Material Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/search-material", async (req, res) => {
    try {
      const { query, userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const materials = await knowledgeService.searchMaterials(query as string, userId as string);
      res.json(materials);
    } catch (error: any) {
      console.error("Search Material Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/material/:id", async (req, res) => {
    try {
      const material = await knowledgeService.getMaterialById(req.params.id);
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      res.json(material);
    } catch (error: any) {
      console.error("Get Material Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gemini RAG Endpoint
  app.post("/api/generate", async (req, res) => {
    try {
      const { userId, prompt, options } = req.body;
      if (!userId || !prompt) {
        return res.status(400).json({ error: "userId and prompt are required" });
      }
      const text = await aiService.generateWithRAG(userId, prompt, options);
      res.json({ text });
    } catch (error: any) {
      console.error("Generate RAG Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gemini General Proxy
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const response = await aiService.generateContent(req.body);
      res.json(response);
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gemini Image Proxy
  app.post("/api/gemini/image", async (req, res) => {
    try {
      const { prompt, aspectRatio, apiKey } = req.body;
      const imageUrl = await aiService.generateImage(prompt, aspectRatio, apiKey);
      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Gemini Image Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Claude API Proxy
  app.post("/api/claude", async (req, res) => {
    try {
      const { messages, system, temperature, max_tokens, model } = req.body;
      const apiKey = process.env.CLAUDE_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "CLAUDE_API_KEY is not configured" });
      }

      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: model || "claude-3-7-sonnet-latest",
        max_tokens: max_tokens || 8192,
        system,
        messages,
        temperature: temperature || 0.4,
      });

      res.json(response);
    } catch (error: any) {
      console.error("Claude Proxy Error:", error);
      res.status(error.status || 500).json({ 
        error: error.message || "An error occurred during Claude API request" 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Serve static files ONLY if not on Vercel (Vercel handles static files via vercel.json)
    app.use(express.static(path.join(__dirname, "dist"), {
      maxAge: '1y',
      immutable: true,
      index: false
    }));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

export default app;

startServer();
