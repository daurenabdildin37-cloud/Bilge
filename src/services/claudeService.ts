import { safeJsonParse } from "../lib/ai-utils";

export const generateGameWithClaude = async (message: string, history: any[] = [], currentData: any = null) => {
  const systemInstruction = `Сен — жоғары деңгейлі бағдарламалық сәулетші және білім беру ойындарының кәсіби дизайнерісің. Сенің міндетің — мұғалімнің сұранысы бойынша өте сапалы, күрделі және мазмұнды интерактивті ойындар жасау.

  МАҢЫЗДЫ ЕРЕЖЕЛЕР:
  1. Жауап ТЕК ҚАНА таза JSON болуы тиіс. Маркдаун блоктарын ( \`\`\`json ) қолданба.
  2. Код сапасы: Clean Code принциптерін сақта.
  3. Көлем: Ойынның толық логикасы, анимациялары, дыбыстық эффектілері (Web Audio API) болуы тиіс.
  4. Web форматы: {"type": "web", "html": "...", "css": "...", "js": "...", "instructions": "..."}
  5. БЕЙІМДІЛІК (RESPONSIVENESS): Ойын кез келген экран өлшеміне (мобильді телефон, планшет, компьютер) автоматты түрде бейімделуі тиіс. Tailwind CSS-ті белсенді қолдан.
  6. ОҚУШЫ СІЛТЕМЕСІ: Ойын интерфейсінде "Оқушыларға арналған сілтеме" бөлімі болсын.`;

  // Convert Gemini history format to Claude format
  const claudeMessages: any[] = history.map(m => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.parts[0].text
  }));

  claudeMessages.push({
    role: 'user',
    content: message + "\n\nIMPORTANT: Return ONLY a valid JSON object. Do not truncate the response. Ensure all brackets and braces are closed correctly."
  });

  const response = await fetch("/api/claude", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 8192,
      system: systemInstruction,
      messages: claudeMessages,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Claude API request failed");
  }

  const data = await response.json();
  const text = data.content[0].type === 'text' ? data.content[0].text : '';
  
  const parsed = safeJsonParse(text);
  if (!parsed) {
    throw new Error("Claude returned invalid JSON");
  }
  return parsed;
};
