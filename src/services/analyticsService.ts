
import { callAgent, cleanJsonContent } from "./multiAgentService";

export interface UserAction {
  type: string;
  target: string;
  timestamp: number;
  metadata?: any;
}

export interface UsagePattern {
  feature: string;
  count: number;
  lastUsed: number;
  avgSessionTime: number;
}

export interface AnalyticsData {
  actions: UserAction[];
  patterns: UsagePattern[];
  sessionStart: number;
  totalSessions: number;
}

const ANALYTICS_KEY = 'bilge_analytics';

export function loadAnalytics(): AnalyticsData {
  const stored = localStorage.getItem(ANALYTICS_KEY);
  if (!stored) {
    return {
      actions: [],
      patterns: [],
      sessionStart: Date.now(),
      totalSessions: 0
    };
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Error parsing analytics data:', e);
    return {
      actions: [],
      patterns: [],
      sessionStart: Date.now(),
      totalSessions: 0
    };
  }
}

export function saveAnalytics(data: AnalyticsData): void {
  // Limit actions to last 200
  if (data.actions.length > 200) {
    data.actions = data.actions.slice(-200);
  }
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
}

export function trackAction(type: string, target: string, metadata?: any): void {
  const data = loadAnalytics();
  
  const newAction: UserAction = {
    type,
    target,
    timestamp: Date.now(),
    metadata
  };
  
  data.actions.push(newAction);
  
  // Update patterns
  const patternIndex = data.patterns.findIndex(p => p.feature === target);
  if (patternIndex !== -1) {
    data.patterns[patternIndex].count += 1;
    data.patterns[patternIndex].lastUsed = Date.now();
  } else {
    data.patterns.push({
      feature: target,
      count: 1,
      lastUsed: Date.now(),
      avgSessionTime: 0
    });
  }
  
  saveAnalytics(data);
}

export function getMissingFeatures(): string[] {
  const data = loadAnalytics();
  const searchActions = data.actions.filter(a => a.type === 'search' && a.metadata?.query);
  
  const queryCounts: { [key: string]: number } = {};
  searchActions.forEach(a => {
    const query = a.metadata.query.toLowerCase().trim();
    queryCounts[query] = (queryCounts[query] || 0) + 1;
  });
  
  const missingFeatures: string[] = [];
  for (const query in queryCounts) {
    if (queryCounts[query] >= 3) {
      missingFeatures.push(query);
    }
  }
  
  return missingFeatures;
}

export function getTopFeatures(): UsagePattern[] {
  const data = loadAnalytics();
  return [...data.patterns]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export async function analyzePatternsAndSuggest(): Promise<string[]> {
  const data = loadAnalytics();
  const missing = getMissingFeatures();
  const top = getTopFeatures();

  if (data.actions.length < 20) {
    return [];
  }

  const systemPrompt = "Сен Білге AI платформасының аналитик агентісің. Мұғалімдердің әрекет деректерін талдап, платформаға қосу керек жаңа мүмкіндіктерді анықта. Тек JSON массив форматында қайтар — мысалы: [\"Рубрика генераторы\", \"Жылдық жоспар\"]. Басқа ештеңе жазба.";
  const userPrompt = `
    Топ мүмкіндіктер: ${top.map(p => p.feature).join(', ')}
    Жетіспейтін мүмкіндіктер (іздеулер): ${missing.join(', ')}
    Жалпы сессия саны: ${data.totalSessions}
    Барлық әрекеттер саны: ${data.actions.length}
  `;

  const result = await callAgent('generator', systemPrompt, userPrompt);
  
  if (result.success && result.content) {
    try {
      const cleaned = cleanJsonContent(result.content);
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('Error parsing suggestions:', e);
      return [];
    }
  }

  return [];
}

export async function detectBehaviorPatterns(): Promise<void> {
  const data = loadAnalytics();
  if (data.actions.length < 30) return;

  const topFeatures = getTopFeatures();
  const favoriteFeature = topFeatures.length > 0 ? topFeatures[0].feature : 'белгісіз';

  const generateActions = data.actions.filter(a => a.type === 'generate');
  
  const topicCounts: { [key: string]: number } = {};
  const gradeCounts: { [key: string]: number } = {};

  generateActions.forEach(a => {
    if (a.metadata?.topic) {
      const topic = a.metadata.topic.toLowerCase().trim();
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
    if (a.metadata?.grade) {
      const grade = String(a.metadata.grade).trim();
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    }
  });

  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([topic]) => topic)
    .join(', ');

  const topGrade = Object.entries(gradeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 1)
    .map(([grade]) => grade)[0] || 'белгісіз';

  const systemPrompt = "Сен мұғалімнің мінез-құлқын талдайтын AI агентісің. Берілген деректерге сүйеніп мұғалімнің қалауларын JSON форматында анықта. Тек JSON қайтар: preferredFormat (string), preferredSubject (string), preferredGrade (string), additionalNotes (string).";
  const userPrompt = `
    Жиі қолданылатын мүмкіндік: ${favoriteFeature}
    Жиі кездесетін тақырыптар: ${topTopics}
    Жиі кездесетін сынып: ${topGrade}
  `;

  const result = await callAgent('critic', systemPrompt, userPrompt);
  
  if (result.success && result.content) {
    try {
      const cleaned = cleanJsonContent(result.content);
      const prefs = JSON.parse(cleaned);
      
      const { loadMemory, saveMemory } = await import("./memoryService");
      const memory = await loadMemory();
      if (memory) {
        memory.preferences = {
          ...memory.preferences,
          ...prefs
        };
        await saveMemory(memory);
        console.log('Behavior patterns detected and preferences updated.');
      }
    } catch (e) {
      console.error('Error parsing behavior patterns:', e);
    }
  }
}
