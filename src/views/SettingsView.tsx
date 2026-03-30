
import * as React from 'react';
import { Globe, Key, Moon, Sun, CheckCircle2, ExternalLink, Brain, Trash2, Eye, ChevronDown, ChevronUp, History, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../lib/translations';
import { initGoogleDriveAuth, clearMemoryAuth, loadMemory, TeacherMemory } from '../services/memoryService';
import { analyzePatternsAndSuggest, loadAnalytics } from '../services/analyticsService';
import { Sparkles, BarChart3 } from 'lucide-react';

interface SettingsViewProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  apiKeyInput2: string;
  setApiKeyInput2: (val: string) => void;
  apiKeyInput3: string;
  setApiKeyInput3: (val: string) => void;
  saveApiKey: () => void;
  isSavingApi: boolean;
  isApiOk: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  t: any;
  addNotification: (title: string, message: string, type: string) => void;
}

const SettingsView = ({
  language,
  setLanguage,
  apiKeyInput,
  setApiKeyInput,
  apiKeyInput2,
  setApiKeyInput2,
  apiKeyInput3,
  setApiKeyInput3,
  saveApiKey,
  isSavingApi,
  isApiOk,
  theme,
  toggleTheme,
  t,
  addNotification
}: SettingsViewProps) => {
  const [isConnected, setIsConnected] = React.useState(!!localStorage.getItem('google_access_token'));
  const [showMemory, setShowMemory] = React.useState(false);
  const [memoryData, setMemoryData] = React.useState<TeacherMemory | null>(null);
  const [isLoadingMemory, setIsLoadingMemory] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [analyticsCount, setAnalyticsCount] = React.useState(0);

  React.useEffect(() => {
    const data = loadAnalytics();
    setAnalyticsCount(data.actions.length);
  }, []);

  const handleConnect = async () => {
    const success = await initGoogleDriveAuth();
    if (success) {
      setIsConnected(true);
      addNotification('Сәтті ✅', 'Google Drive-қа сәтті қосылдыңыз.', 'success');
    } else {
      addNotification('Қате ❌', 'Google Drive-қа қосылу сәтсіз аяқталды.', 'error');
    }
  };

  const handleClearMemory = () => {
    clearMemoryAuth();
    localStorage.removeItem('bilge_memory_cache');
    setIsConnected(false);
    setMemoryData(null);
    setShowMemory(false);
    addNotification('Жад тазаланды', 'Барлық жергілікті және сессиялық деректер өшірілді.', 'info');
  };

  const handleViewMemory = async () => {
    if (showMemory) {
      setShowMemory(false);
      return;
    }

    setIsLoadingMemory(true);
    try {
      const data = await loadMemory();
      setMemoryData(data);
      setShowMemory(true);
    } catch (error: any) {
      if (error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden')) {
        setIsConnected(false);
        addNotification('Қайта қосылу қажет', 'Google Drive рұқсаты ескірген немесе қате. Қайта қосылыңыз.', 'warning');
      } else {
        addNotification('Қате', 'Жадты жүктеу мүмкін болмады.', 'error');
      }
    } finally {
      setIsLoadingMemory(false);
    }
  };

  const handleAnalyze = async () => {
    if (analyticsCount < 20) {
      addNotification('Мәлімет аз', 'Аналитика жинақталуда. Платформаны көбірек пайдаланыңыз.', 'info');
      return;
    }

    setIsAnalyzing(true);
    try {
      const results = await analyzePatternsAndSuggest();
      setSuggestions(results);
      if (results.length > 0) {
        addNotification('Талдау аяқталды', 'Жаңа мүмкіндіктер бойынша ұсыныстар дайын.', 'success');
      }
    } catch (error) {
      addNotification('Қате', 'Аналитиканы талдау мүмкін болмады.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getMostFrequentType = (patterns: any[]) => {
    if (!patterns || patterns.length === 0) return 'Жоқ';
    const sorted = [...patterns].sort((a, b) => b.count - a.count);
    const typeNames: { [key: string]: string } = {
      'kmzh': 'ҚМЖ',
      'assessment': 'БЖБ/ТЖБ',
      'game': 'Ойын'
    };
    return typeNames[sorted[0].pattern] || sorted[0].pattern;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fu max-w-4xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2">{t.settings}</h1>
        <p className="text-slate-500 dark:text-slate-400">Платформаны өзіңізге ыңғайлы етіп баптаңыз.</p>
      </div>

      <div className="grid gap-6">
        {/* Language Section */}
        <div className="card card-pad">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">{t.language}</h3>
              <p className="text-sm text-slate-500">Интерфейс тілін таңдаңыз</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'kz', label: 'Қазақша', flag: '🇰🇿' },
              { id: 'ru', label: 'Русский', flag: '🇷🇺' },
              { id: 'en', label: 'English', flag: '🇺🇸' }
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setLanguage(lang.id as Language)}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  language === lang.id 
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <span className="font-medium">{lang.label}</span>
                <span className="text-xl">{lang.flag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* API Key Section */}
        <div className="card card-pad">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Key size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">{t.apiKey}</h3>
              <p className="text-sm text-slate-500">AI функцияларын қосу</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm leading-relaxed">
              <p className="mb-2">{t.apiHelp}</p>
              <p className="text-slate-500 mb-2">
                Біздің жүйе мульти-агенттік технологияны қолданады. Жұмыс жылдамдығы мен лимиттерді арттыру үшін 3 түрлі кілт енгізуге болады.
              </p>
              {!isApiOk && (
                <p className="text-emerald-600 dark:text-emerald-400 font-bold mb-2">
                  ✨ Қазіргі уақытта серверлік AI қолжетімді. Өз кілтіңізді қосу жылдамдықты арттырады.
                </p>
              )}
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Google AI Studio <ExternalLink size={12} />
              </a>
            </div>

            <div className="space-y-4">
              <div className="fg">
                <label className="flabel">Gemini API Key 1 (Generator)</label>
                <input 
                  type="password" 
                  className="inp w-full" 
                  placeholder={t.apiPlaceholder}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </div>

              <div className="fg">
                <label className="flabel">Gemini API Key 2 (Critic)</label>
                <input 
                  type="password" 
                  className="inp w-full" 
                  placeholder="Екінші кілтті енгізіңіз (міндетті емес)"
                  value={apiKeyInput2}
                  onChange={(e) => setApiKeyInput2(e.target.value)}
                />
              </div>

              <div className="fg">
                <label className="flabel">Gemini API Key 3 (Refiner)</label>
                <input 
                  type="password" 
                  className="inp w-full" 
                  placeholder="Үшінші кілтті енгізіңіз (міндетті емес)"
                  value={apiKeyInput3}
                  onChange={(e) => setApiKeyInput3(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <button 
                  className={`btn btn-primary px-12 py-3 ${isSavingApi ? 'opacity-50' : ''}`}
                  onClick={saveApiKey}
                  disabled={isSavingApi}
                >
                  {isSavingApi ? t.saving : 'Барлық кілттерді сақтау'}
                </button>
              </div>

              {isApiOk && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                  Кілттер белсенді және сақталған
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Memory System Section */}
        <div className="card card-pad">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Brain size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">🧠 Білге AI Жады</h3>
              <p className="text-sm text-slate-500">Дербес тәжірибені басқару</p>
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Сіздің жеке қалауларыңыз, тарихыңыз және үлгілеріңіз Google Drive-та сақталады. Кез келген құрылғыдан қол жетеді.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleConnect}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  isConnected 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isConnected ? '✅ Қосылды' : 'Google Drive-қа қосылу'}
              </button>

              <button
                onClick={handleClearMemory}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Жадты тазалау
              </button>

              <button
                onClick={handleViewMemory}
                disabled={isLoadingMemory}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                {isLoadingMemory ? (
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <Eye size={18} />
                    Жадты көру
                    {showMemory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </>
                )}
              </button>
            </div>

            <AnimatePresence>
              {showMemory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    {!memoryData || memoryData.history.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                        <p className="text-slate-500">Әлі жад жоқ. Алдымен ҚМЖ немесе бағалау жасаңыз.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Жалпы генерация</p>
                            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{memoryData.history.length}</p>
                          </div>
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1">Жиі жасалған</p>
                            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                              {getMostFrequentType(memoryData.patterns)}
                            </p>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold mb-3 flex items-center gap-2">
                            <History size={16} className="text-slate-400" />
                            Соңғы 5 генерация
                          </h4>
                          <div className="space-y-2">
                            {memoryData.history.slice(-5).reverse().map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm">
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                    item.type === 'kmzh' ? 'bg-blue-100 text-blue-600' :
                                    item.type === 'assessment' ? 'bg-emerald-100 text-emerald-600' :
                                    'bg-amber-100 text-amber-600'
                                  }`}>
                                    {item.type === 'kmzh' ? 'ҚМЖ' : item.type === 'assessment' ? 'БЖБ' : 'Ойын'}
                                  </span>
                                  <span className="font-medium truncate max-w-[150px] sm:max-w-[300px]">{item.topic}</span>
                                </div>
                                <span className="text-slate-400 text-xs">
                                  {new Date(item.timestamp).toLocaleDateString('kk-KZ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="card card-pad">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">📊 Аналитика</h3>
              <p className="text-sm text-slate-500">Пайдалану үлгілерін талдау</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Жиналған әрекеттер:</span>
                <span className="font-bold">{analyticsCount} / 20</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (analyticsCount / 20) * 100)}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={18} />
                  Аналитиканы талдау
                </>
              )}
            </button>

            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Жасанды интеллект ұсыныстары:</h4>
                <div className="grid gap-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl flex items-start gap-3">
                      <div className="mt-0.5 text-indigo-600 dark:text-indigo-400">💡</div>
                      <p className="text-sm font-medium">{s}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {analyticsCount < 20 && !isAnalyzing && (
              <p className="text-xs text-center text-slate-400 italic">
                Аналитика жинақталуда. Платформаны көбірек пайдаланыңыз (кемінде 20 әрекет).
              </p>
            )}
          </div>
        </div>

        {/* GitHub Integration Section */}
        <div className="card card-pad">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/30 flex items-center justify-center text-slate-600 dark:text-slate-400">
              <Github size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">⚙️ GitHub Интеграциясы</h3>
              <p className="text-sm text-slate-500">Автоматты код жіберу жүйесі</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              AI жасаған кодтар автоматты GitHub-қа жіберіледі. Сен бекіткеннен кейін ғана.
            </p>

            {import.meta.env.VITE_GITHUB_TOKEN ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} />
                <span className="font-bold">✅ GitHub қосылған</span>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl flex items-center gap-3 text-amber-600 dark:text-amber-400">
                <span className="text-lg">⚠️</span>
                <span className="font-medium">VITE_GITHUB_TOKEN қосылмаған. .env файлына қосыңыз.</span>
              </div>
            )}
          </div>
        </div>

        {/* Appearance Section */}
        <div className="card card-pad">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
              {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-lg">{t.theme}</h3>
              <p className="text-sm text-slate-500">Интерфейс көрінісін реттеңіз</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => theme === 'dark' && toggleTheme()}
              className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                theme === 'light'
                  ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-600'
                  : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <Sun size={18} />
              <span className="font-medium">Жарық</span>
            </button>
            <button
              onClick={() => theme === 'light' && toggleTheme()}
              className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                theme === 'dark'
                  ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-600'
                  : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <Moon size={18} />
              <span className="font-medium">Қараңғы</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsView;
