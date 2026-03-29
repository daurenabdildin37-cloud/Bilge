
export interface KMZHMetadata {
  ministry: string;
  school: string;
  subject: string;
  section: string;
  teacher: string;
  date: string;
  grade: string;
  participants: string;
  absent: string;
  topic: string;
  learningObjective: string;
  lessonObjective: string;
  value: string;
  quote: string;
}

export interface KMZHStage {
  period: string;
  teacherAction: string;
  studentAction: string;
  assessment: string;
  resources: string;
}

export interface KMZHDescriptor {
  taskName: string;
  descriptor: string;
  points: number;
}

export interface KMZHData {
  metadata: KMZHMetadata;
  lessonObjectives: string[];
  assessmentCriteria: string[];
  languageObjectives: {
    vocabulary: string[];
    phrases: string[];
  };
  values: string;
  crossCurricularLinks: string;
  previousLearning: string;
  stages: KMZHStage[];
  descriptorsTable?: KMZHDescriptor[];
  differentiation: string;
  assessmentCheck: string;
  healthAndSafety: string;
  reflection: string;
}

export interface GameQuestion {
  q: string;
  a: string;
  opts: string[];
}

export interface GameCard {
  q: string;
  a: string;
}

export interface GamePair {
  left: string;
  right: string;
}

export interface GameData {
  questions?: GameQuestion[];
  cards?: GameCard[];
  pairs?: GamePair[];
}

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  gemini_api_key?: string;
  claude_api_key?: string;
  school?: string;
  role?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: any;
}

export interface KMZHParams {
  subject: string;
  grade: string;
  topic: string;
  learningObjectives: string;
  section: string;
  teacherName: string;
  schoolName: string;
  date: string;
  value: string;
  quote: string;
  participants: string;
  absent: string;
  time: string;
  lang: string;
  bloom: string[];
  additionalRequests: string;
  sourceText: string;
}

export interface GameParams {
  topic: string;
  grade: string;
  lang: string;
  type: string;
  count: number;
  sourceText?: string;
  useKB?: boolean;
}

export interface LibraryItem {
  id: string;
  userId: string;
  type: 'ҚМЖ' | 'Ойын' | 'БЖБ/ТЖБ' | 'Бағалау';
  title: string;
  subject: string;
  grade: string;
  data: KMZHData | GameData | GradingData | any;
  date: string;
  createdAt: any;
}

export interface GradingData {
  students: { id: string; name: string; score: number }[];
  gradingType: string;
  title: string;
  metadata?: {
    mode: 'online' | 'offline';
  };
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  rank: number;
  date?: string;
}

export interface AssessmentTask {
  number: number;
  task: string;
  criteria: string;
  level: string; // Cognitive level: Knowledge, Understanding, Application, Analysis
  descriptors: { description: string; point: number }[];
  maxPoint: number;
  type: 'text' | 'choice' | 'map' | 'table' | 'matching' | 'cards' | 'true_false' | 'ordering' | 'map_mark' | 'map_draw' | 'map_territory' | 'map_route';
  options?: string[];
  matchingPairs?: { left: string; right: string }[];
  orderingItems?: string[];
  cards?: string[];
  correctAnswer?: string;
  mapUrl?: string;
  mapConfig?: {
    center: [number, number];
    zoom: number;
    territories?: {
      id: string;
      name: string;
      color: string;
      correctBoundary: [number, number][];
    }[];
    routes?: {
      id: string;
      name: string;
      color: string;
      correctPath: [number, number][];
    }[];
  };
}

export interface Student {
  name: string;
  accessCode: string;
  status: 'pending' | 'started' | 'submitted' | 'locked';
}

export interface AssessmentData {
  id?: string;
  analysis?: {
    topic: string;
    keyConcepts: string[];
    importantFacts: string[];
    skills: string[];
  };
  metadata: {
    type: string;
    subject: string;
    grade: string;
    topic: string;
    totalPoints: number;
    mode: 'online' | 'offline';
    difficulty?: string;
    students?: Student[];
  };
  tasks: AssessmentTask[];
  answerKey: { taskNumber: number; answer: string }[];
}

export interface AssessmentResult {
  id?: string;
  assessmentId: string;
  studentName: string;
  answers: { taskNumber: number; answer: string; score: number }[];
  totalScore: number;
  maxScore: number;
  createdAt: any;
}

export interface Feedback {
  id?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  category: 'Bug Report' | 'Suggestion' | 'General Feedback';
  message: string;
  contactInfo?: string;
  status: 'new' | 'reviewed' | 'resolved';
  createdAt: any;
}

export type KBCategory = 'standard' | 'book' | 'curriculum' | 'lesson_plan' | 'method' | 'assessment';

export interface KBChunk {
  id?: string;
  content: string;
  title: string;
  category: KBCategory;
  subcategory?: string;
  subject?: string;
  grade?: string;
  quarter?: string;
  topic?: string;
  learningObjectives?: string[];
  tags?: string[];
  structure?: {
    headings?: string[];
    level?: number;
  };
  chunkIndex: number;
  totalChunks: number;
  sourceFile?: string;
  embedding?: number[];
  createdAt: any;
}

export interface KBChunkDraft extends Omit<KBChunk, 'id' | 'createdAt' | 'embedding'> {
  id?: string;
  embedding?: number[];
}
