import { callAgent, cleanJsonContent } from "./multiAgentService";

export type IntentType = 'create_kmzh' | 'create_assessment' | 'create_game' | 'general_chat';

export interface AgenticIntent {
  type: IntentType;
  confidence: number;
  params: any;
  message: string;
}

export async function detectIntent(userMessage: string): Promise<AgenticIntent> {
  const systemPrompt = `Сен Білге AI платформасының intent анықтауышысың. Мұғалімнің хабарламасын оқып, не жасағысы келетінін анықта. Тек JSON форматында жауап бер. 
  JSON құрылымы: 
  type (create_kmzh немесе create_assessment немесе create_game немесе general_chat), 
  confidence (0 мен 1 арасындағы сан), 
  params (табылған параметрлер: subject, grade, topic өрістері болса), 
  message (мұғалімге қазақша қысқа жауап). 
  Мысалдар: 
  ‘математикадан ҚМЖ жаса’ → create_kmzh, 
  ‘тест жаса’ → create_assessment, 
  ‘ойын жаса’ → create_game, 
  ‘сәлем’ → general_chat.`;

  try {
    const result = await callAgent('generator', systemPrompt, userMessage);
    
    if (!result.success) {
      return { type: 'general_chat', confidence: 0, params: {}, message: '' };
    }

    const cleaned = cleanJsonContent(result.content);
    const parsed = JSON.parse(cleaned);

    if (!parsed.type || parsed.confidence === undefined || parsed.confidence < 0.5) {
      return { type: 'general_chat', confidence: 0, params: {}, message: '' };
    }

    return {
      type: parsed.type as IntentType,
      confidence: parsed.confidence,
      params: parsed.params || {},
      message: parsed.message || ''
    };
  } catch (error) {
    console.error("Intent Detection Error:", error);
    return { type: 'general_chat', confidence: 0, params: {}, message: '' };
  }
}

export async function executeIntent(
  intent: AgenticIntent, 
  addNotification: (title: string, message: string, type: string) => void, 
  navigate: (tab: string) => void
): Promise<void> {
  switch (intent.type) {
    case 'create_kmzh':
      navigate('kmzh');
      addNotification('ҚМЖ бетіне өттіңіз', 'Параметрлерді толтырыңыз немесе AI-дан сұраңыз.', 'info');
      break;
    case 'create_assessment':
      navigate('assessment');
      addNotification('Бағалау бетіне өттіңіз', 'Тапсырмалар жасау үшін параметрлерді енгізіңіз.', 'info');
      break;
    case 'create_game':
      navigate('games');
      addNotification('Ойындар бетіне өттіңіз', 'Ойын түрін таңдап, тақырыпты жазыңыз.', 'info');
      break;
    case 'general_chat':
    default:
      // Do nothing for general chat, just let the normal chat flow continue
      break;
  }
}
