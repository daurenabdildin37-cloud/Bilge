
import { callAgent, cleanJsonContent } from "./multiAgentService";
import { analyzePatternsAndSuggest } from "./analyticsService";

export interface ExtensionIdea {
  id: string;
  title: string;
  description: string;
  priority: number; // 1-10
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  createdAt: number;
}

export interface ExtensionPlan {
  idea: ExtensionIdea;
  logic: string;
  steps: string[];
  affectedFiles: string[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedChanges: number;
  generatedCode?: string;
}

export interface ExtensionProposal {
  plan: ExtensionPlan | null;
  ideaVersions: string[]; // 3 agents individual ideas (JSON strings)
  logicVersions: string[]; // 3 agents individual logics
  planVersions: string[]; // 3 agents individual plans
  createdAt: number;
  status: string;
}

const PROPOSALS_KEY = 'bilge_proposals';

export function loadProposals(): ExtensionProposal[] {
  const stored = localStorage.getItem(PROPOSALS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Error loading proposals:', e);
    return [];
  }
}

export function saveProposals(proposals: ExtensionProposal[]): void {
  localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals));
}

function areSimilar(title1: string, title2: string): boolean {
  const words1 = title1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = title2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  const common = words1.filter(w => words2.includes(w));
  const similarity1 = common.length / words1.length;
  const similarity2 = common.length / words2.length;
  
  return similarity1 > 0.5 || similarity2 > 0.5;
}

export async function generateIdeas(): Promise<ExtensionIdea[]> {
  const suggestions = await analyzePatternsAndSuggest();
  if (suggestions.length === 0) return [];

  const systemPrompt = "Сен Білге AI платформасының мүмкіндік генераторысың. Берілген ұсыныстар негізінде нақты, іске асырылатын жаңа мүмкіндік идеяларын жаса. JSON массив форматында қайтар: id (uuid қысқа нұсқасы), title (қысқа атау), description (толық сипаттама), priority (1-10). Тек JSON қайтар.";
  const userPrompt = `Ұсыныстар тізімі: ${suggestions.join(', ')}`;

  // Call 3 agents in parallel
  const results = await Promise.all([
    callAgent('generator', systemPrompt, userPrompt),
    callAgent('critic', systemPrompt, userPrompt),
    callAgent('refiner', systemPrompt, userPrompt)
  ]);

  const agentIdeas: ExtensionIdea[][] = [];
  const ideaVersions: string[] = [];

  results.forEach(res => {
    if (res.success && res.content) {
      try {
        const cleaned = cleanJsonContent(res.content);
        ideaVersions.push(cleaned);
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          agentIdeas.push(parsed.map(item => ({
            ...item,
            status: 'pending',
            createdAt: Date.now()
          })));
        }
      } catch (e) {
        console.error('Error parsing agent ideas:', e);
      }
    }
  });

  if (agentIdeas.length < 2) return [];

  const finalIdeas: ExtensionIdea[] = [];
  const proposals = loadProposals();

  // Find consensus (ideas present in at least 2 agents or similar)
  const firstAgentIdeas = agentIdeas[0];
  
  for (const idea1 of firstAgentIdeas) {
    const similarIn2 = agentIdeas[1]?.find(idea2 => areSimilar(idea1.title, idea2.title));
    const similarIn3 = agentIdeas[2]?.find(idea3 => areSimilar(idea1.title, idea3.title));

    if (similarIn2 && similarIn3) {
      // Consensus found in all 3
      const avgPriority = Math.round((idea1.priority + similarIn2.priority + similarIn3.priority) / 3);
      const finalIdea: ExtensionIdea = {
        ...idea1,
        priority: avgPriority,
        status: 'pending',
        createdAt: Date.now()
      };
      finalIdeas.push(finalIdea);

      // Create a proposal
      const newProposal: ExtensionProposal = {
        plan: null,
        ideaVersions: ideaVersions,
        logicVersions: [],
        planVersions: [],
        createdAt: Date.now(),
        status: 'idea_generated'
      };
      // We might want to associate the idea with the proposal, but the schema doesn't have an 'idea' field directly in Proposal, only in Plan.
      // However, the prompt says "ExtensionProposal интерфейсінде мына өрістер болады: plan (ExtensionPlan)..."
      // and "ExtensionPlan интерфейсінде мына өрістер болады: idea (ExtensionIdea)..."
      // So we'll create a dummy plan to hold the idea.
      newProposal.plan = {
        idea: finalIdea,
        logic: '',
        steps: [],
        affectedFiles: [],
        riskLevel: 'low',
        estimatedChanges: 0
      };
      
      proposals.push(newProposal);
    }
  }

  saveProposals(proposals);
  return finalIdeas;
}

export async function generatePlan(idea: ExtensionIdea): Promise<{
  plan: ExtensionPlan,
  ideaVersions: string[],
  logicVersions: string[],
  planVersions: string[]
}> {
  const defaultPlan: ExtensionPlan = {
    idea,
    logic: '',
    steps: [],
    affectedFiles: [],
    riskLevel: 'high',
    estimatedChanges: 0
  };

  try {
    // Stage 1: Idea
    const ideaSystemPrompt = "Сен Білге AI платформасының архитект агентісің. Берілген мүмкіндік идеясын React, TypeScript, Firebase стегінде іске асыру жолын сипатта. Тек қысқа мәтін түрінде жауап бер, JSON емес.";
    const ideaUserPrompt = `Атауы: ${idea.title}\nСипаттамасы: ${idea.description}`;
    
    const ideaResults = await Promise.all([
      callAgent('generator', ideaSystemPrompt, ideaUserPrompt),
      callAgent('critic', ideaSystemPrompt, ideaUserPrompt),
      callAgent('refiner', ideaSystemPrompt, ideaUserPrompt)
    ]);
    
    const ideaVersions = ideaResults.map(r => r.success ? r.content : '');

    // Stage 2: Logic
    const logicSystemPrompt = "Сен Білге AI платформасының логика сарапшысысың. Берілген мүмкіндіктің техникалық логикасын анықта: қай компоненттермен байланысады, қандай деректер керек, қандай тәуекел бар. Тек қысқа мәтін түрінде жауап бер.";
    const logicUserPrompt = `
      Атауы: ${idea.title}
      Сипаттамасы: ${idea.description}
      Архитектуралық нұсқалар:
      1: ${ideaVersions[0]}
      2: ${ideaVersions[1]}
      3: ${ideaVersions[2]}
    `;
    
    const logicResults = await Promise.all([
      callAgent('generator', logicSystemPrompt, logicUserPrompt),
      callAgent('critic', logicSystemPrompt, logicUserPrompt),
      callAgent('refiner', logicSystemPrompt, logicUserPrompt)
    ]);
    
    const logicVersions = logicResults.map(r => r.success ? r.content : '');

    // Stage 3: Plan
    const planSystemPrompt = "Сен Білге AI платформасының жоспарлаушы агентісің. Берілген мүмкіндікті іске асыру үшін қадам-қадам жоспар жаса. JSON форматында қайтар: steps (string массиві, әр қадам), affectedFiles (string массиві, өзгеретін файлдар), riskLevel (low немесе medium немесе high), estimatedChanges (өзгеретін жол саны шамасы).";
    const planUserPrompt = `
      Атауы: ${idea.title}
      Архитектура: ${ideaVersions.join('\n\n')}
      Логика: ${logicVersions.join('\n\n')}
    `;
    
    const planResults = await Promise.all([
      callAgent('generator', planSystemPrompt, planUserPrompt),
      callAgent('critic', planSystemPrompt, planUserPrompt),
      callAgent('refiner', planSystemPrompt, planUserPrompt)
    ]);
    
    const planVersions = planResults.map(r => r.success ? r.content : '');

    // Refinement
    const refinerSystemPrompt = "Сен үш жоспар нұсқасынан ең жақсы тұстарын біріктіріп финалды жоспар жасайсың. JSON форматында қайтар: steps (string массиві), affectedFiles (string массиві), riskLevel (low немесе medium немесе high), estimatedChanges (number).";
    const refinerUserPrompt = `
      Жоспар нұсқалары:
      1: ${planVersions[0]}
      2: ${planVersions[1]}
      3: ${planVersions[2]}
    `;
    
    const finalResult = await callAgent('refiner', refinerSystemPrompt, refinerUserPrompt);
    
    if (finalResult.success && finalResult.content) {
      const cleaned = cleanJsonContent(finalResult.content);
      const parsed = JSON.parse(cleaned);
      
      return {
        plan: {
          idea,
          logic: logicVersions.join('\n\n---\n\n'),
          steps: parsed.steps || [],
          affectedFiles: parsed.affectedFiles || [],
          riskLevel: parsed.riskLevel || 'medium',
          estimatedChanges: parsed.estimatedChanges || 0
        },
        ideaVersions,
        logicVersions,
        planVersions
      };
    }

    return { plan: defaultPlan, ideaVersions, logicVersions, planVersions };
  } catch (error) {
    console.error('Error generating plan:', error);
    return { plan: defaultPlan, ideaVersions: [], logicVersions: [], planVersions: [] };
  }
}

export function saveProposal(proposal: ExtensionProposal): void {
  let proposals = loadProposals();
  proposals.push(proposal);
  
  if (proposals.length > 20) {
    // Remove old implemented or rejected
    const toRemove = proposals.length - 20;
    let removedCount = 0;
    
    proposals = proposals.filter(p => {
      if (removedCount < toRemove && (p.status === 'implemented' || p.status === 'rejected')) {
        removedCount++;
        return false;
      }
      return true;
    });
    
    // If still > 20, just slice the oldest
    if (proposals.length > 20) {
      proposals = proposals.slice(-20);
    }
  }
  
  saveProposals(proposals);
}

export async function generateCode(plan: ExtensionPlan): Promise<string> {
  try {
    // Agent 1: Creator
    const creatorSystem = "Сен React және TypeScript кодын жазатын AI агентісің. Берілген жоспар бойынша жаңа компонент немесе функция кодын жаз. Ереже: тек TypeScript және React пайдалан, Firebase импорттары дұрыс болсын, бар кодқа кедергі жасама, тек жаңа функционал қос. Кодты ``` блоктарынсыз тікелей жаз.";
    const creatorUser = `
      Атауы: ${plan.idea.title}
      Сипаттамасы: ${plan.idea.description}
      Қадамдар: ${plan.steps.join(', ')}
      Файлдар: ${plan.affectedFiles.join(', ')}
    `;
    
    const creatorResult = await callAgent('generator', creatorSystem, creatorUser);
    if (!creatorResult.success || !creatorResult.content) return '';
    const rawCode = creatorResult.content;

    // Agent 2: Critic
    const criticSystem = "Сен TypeScript және React код сарапшысысың. Берілген кодты мына критерийлер бойынша тексер: 1) TypeScript типтері дұрыс па? 2) React hooks ережелері сақталған ба? 3) Firebase импорттары дұрыс па? 4) Қауіпсіздік мәселесі бар ма? 5) Бар компоненттермен конфликт болуы мүмкін бе? Табылған қателерді нақты тізімдеп жаз. Егер бәрі дұрыс болса ‘Код сапалы’ деп жаз.";
    const criticUser = `Код:\n${rawCode}\n\nФайлдар: ${plan.affectedFiles.join(', ')}`;
    
    const criticResult = await callAgent('critic', criticSystem, criticUser);
    const codeReview = criticResult.success ? criticResult.content : '';

    // Agent 3: Refiner
    const refinerSystem = "Сен React және TypeScript код редакторысың. Агент 1 жазған кодты Агент 2 тексеруіне сүйеніп жетілдір. Ереже: 1) Агент 2 тапқан барлық қателерді түзет. 2) Кодтың құрылымын сақта. 3) Тек кодты жаз, түсіндірме жазба. 4) Егер Агент 2 ‘Код сапалы’ десе кодты өзгеріссіз қайтар.";
    const refinerUser = `Бастапқы код:\n${rawCode}\n\nСараптама:\n${codeReview}`;
    
    const refinerResult = await callAgent('refiner', refinerSystem, refinerUser);
    
    if (refinerResult.success && refinerResult.content) {
      return refinerResult.content;
    }
    
    return rawCode;
  } catch (error) {
    console.error('Error generating code:', error);
    return '';
  }
}

export async function createProposalFromIdea(idea: ExtensionIdea): Promise<ExtensionProposal> {
  const { plan, ideaVersions, logicVersions, planVersions } = await generatePlan(idea);
  
  const generatedCode = await generateCode(plan);
  plan.generatedCode = generatedCode;

  const proposal: ExtensionProposal = {
    plan,
    ideaVersions,
    logicVersions,
    planVersions,
    createdAt: Date.now(),
    status: 'pending'
  };

  saveProposal(proposal);
  return proposal;
}

export function approveProposal(proposalIndex: number): ExtensionProposal | null {
  const proposals = loadProposals();
  if (proposals[proposalIndex]) {
    proposals[proposalIndex].status = 'approved';
    if (proposals[proposalIndex].plan) {
      proposals[proposalIndex].plan!.idea.status = 'approved';
    }
    saveProposals(proposals);
    return proposals[proposalIndex];
  }
  return null;
}

export function rejectProposal(proposalIndex: number): void {
  const proposals = loadProposals();
  if (proposals[proposalIndex]) {
    proposals[proposalIndex].status = 'rejected';
    if (proposals[proposalIndex].plan) {
      proposals[proposalIndex].plan!.idea.status = 'rejected';
    }
    saveProposals(proposals);
  }
}

const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO;
const GITHUB_BRANCH = 'feature/ai-extension';

export async function pushToGitHub(proposal: ExtensionProposal, code: string): Promise<boolean> {
  if (!GITHUB_TOKEN || !GITHUB_REPO || !proposal.plan) return false;

  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // 1. Check if branch exists
    const branchRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/branches/${GITHUB_BRANCH}`, { headers });
    
    if (branchRes.status === 404) {
      // Create branch from main
      const mainRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/branches/main`, { headers });
      if (!mainRes.ok) return false;
      const mainData = await mainRes.json();
      const sha = mainData.commit.sha;

      const createBranchRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${GITHUB_BRANCH}`,
          sha: sha
        })
      });
      if (!createBranchRes.ok) return false;
    }

    // 2. Create or update file
    const filePath = `src/components/AIGenerated/${proposal.plan.idea.id}.tsx`;
    const fileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
    
    // Check if file exists to get SHA
    const existingFileRes = await fetch(`${fileUrl}?ref=${GITHUB_BRANCH}`, { headers });
    let existingSha: string | undefined;
    if (existingFileRes.ok) {
      const existingData = await existingFileRes.json();
      existingSha = existingData.sha;
    }

    const base64Content = btoa(unescape(encodeURIComponent(code)));

    const putRes = await fetch(fileUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `AI Extension: ${proposal.plan.idea.title}`,
        content: base64Content,
        branch: GITHUB_BRANCH,
        sha: existingSha
      })
    });

    return putRes.ok;
  } catch (error) {
    console.error('Error pushing to GitHub:', error);
    return false;
  }
}
