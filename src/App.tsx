import React, { useState, useEffect, lazy, Suspense, useCallback, useMemo } from 'react';
import { X, LogIn, Save } from 'lucide-react';
import { Logo } from './components/Common/Logo';
import { Sidebar } from './components/Layout/Sidebar';
import { Topbar } from './components/Layout/Topbar';
import { Toast } from './components/Common/Toast';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { db, isFirebaseConfigured } from './lib/firebase';
import { doc, setDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { reportErrorToAI } from './lib/error-handling';
import { useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import { useTheme } from './hooks/useTheme';
import { useApiKeys } from './hooks/useApiKeys';
import { useKmzh } from './hooks/useKmzh';
import { useKBBackground } from './hooks/useKBBackground';
import { KBProgressIndicator } from './components/KnowledgeBase/KBProgressIndicator';
import { KMZHParams, GameParams, KMZHData, GameData, AssessmentData } from './types';
import { translations, Language } from './lib/translations';
import DashboardView from './views/DashboardView';
const KMZHView = lazy(() => import('./views/KMZHView'));
const GamesView = lazy(() => import('./views/GamesView'));
const ChatView = lazy(() => import('./views/ChatView'));
const LibraryView = lazy(() => import('./views/LibraryView'));
const AssessmentView = lazy(() => import('./views/AssessmentView'));
const StudentAssessmentView = lazy(() => import('./views/StudentAssessmentView'));
const CodingView = lazy(() => import('./views/CodingView'));
const GamePlayerView = lazy(() => import('./views/GamePlayerView'));
const MapView = lazy(() => import('./views/MapView'));
const CalendarView = lazy(() => import('./views/CalendarView'));
const AdminKBView = lazy(() => import('./views/AdminKBView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const FeedbackView = lazy(() => import('./views/FeedbackView'));
const GradingSimulatorView = lazy(() => import('./views/GradingSimulatorView'));
const PublicGradingView = lazy(() => import('./views/PublicGradingView'));

import { GenerationProvider } from './contexts/GenerationContext';
import { ViewLoader } from './components/Common/ViewLoader';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard';
  });

  const validTabs = ['dashboard', 'kmzh', 'assessment', 'map', 'coding', 'chat', 'calendar', 'library', 'games', 'settings', 'admin_kb', 'feedback', 'grading_simulator'];
  
  useEffect(() => {
    if (!validTabs.includes(activeTab)) {
      console.warn("App: Invalid activeTab detected, resetting to dashboard:", activeTab);
      setActiveTab('dashboard');
    }
    localStorage.setItem('activeTab', activeTab);
    console.log('App: activeTab changed to', activeTab);
  }, [activeTab]);

  const [showDebug, setShowDebug] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Custom Hooks
  const { user, setUser, loading: authLoading, isApiOk, setIsApiOk, isClaudeApiOk, setIsClaudeApiOk, isAdmin, login, logout } = useAuth();
  

  const { notifications, addNotification } = useNotifications(user);
  const { theme, toggleTheme } = useTheme();
  const [language, setLanguage] = useState<Language>('kz');
  const t = translations[language];

  const showToast = useCallback((message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  }, []);

  const {
    isApiModalOpen, setIsApiModalOpen,
    isClaudeModalOpen, setIsClaudeModalOpen,
    apiKeyInput, setApiKeyInput,
    apiKeyInput2, setApiKeyInput2,
    apiKeyInput3, setApiKeyInput3,
    claudeKeyInput, setClaudeKeyInput,
    isSavingApi, isSavingClaude,
    saveApiKey, saveClaudeKey, 
    clearApiKey
  } = useApiKeys(user, showToast, setIsApiOk, setIsClaudeApiOk);

  const {
    kmzhLoading, setKmzhLoading,
    kmzhResult, setKmzhResult,
    assessmentResult, setAssessmentResult,
    kmzhParams, setKmzhParams
  } = useKmzh();

  const kbBackground = useKBBackground(addNotification);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    const msgs = {
      kz: 'Тіл ауыстырылды: Қазақша 🌐',
      ru: 'Язык изменен: Русский 🌐',
      en: 'Language changed: English 🌐'
    };
    showToast(msgs[lang]);
  };

  // Global safety timeout for loading screen
  const [isSafetyTimeoutReached, setIsSafetyTimeoutReached] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn("Global safety timeout reached: forcing loading screen dismissal");
      setIsSafetyTimeoutReached(true);
    }, 8000); // 8 seconds hard limit
    return () => clearTimeout(timer);
  }, []);

  const effectiveLoading = authLoading && !isSafetyTimeoutReached;

  const handleNavigate = useCallback((tab: string, item?: any) => {
    setActiveTab(tab);
    if (item) {
      if (item.type === 'ҚМЖ') setKmzhResult(item.data);
      if (item.type === 'БЖБ' || item.type === 'ТЖБ') setAssessmentResult(item.data);
    }
  }, [setKmzhResult, setAssessmentResult]);

  const handleLogin = useCallback(async () => {
    try {
      // Set active tab to dashboard before login to handle redirect cases
      localStorage.setItem('activeTab', 'dashboard');
      setActiveTab('dashboard');
      await login();
      showToast('Қош келдіңіз! 👋');
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/popup-blocked') {
        showToast('Браузер терезесі бұғатталды! 🔓');
      } else if (err.code === 'auth/cancelled-popup-request') {
        showToast('Кіру тоқтатылды ⚠️');
      } else {
        showToast(`Қате: ${err.code || 'белгісіз'} ❌`);
      }
    }
  }, [login, showToast]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      localStorage.setItem('activeTab', 'dashboard');
      setActiveTab('dashboard');
      showToast('Жүйеден шықтыңыз 👋');
    } catch (err) {
      console.error(err);
      showToast('Шығу кезінде қате туындады ❌');
    }
  }, [logout, showToast]);

  const openApiModal = useCallback(() => setIsApiModalOpen(true), [setIsApiModalOpen]);
  const openProfileModal = useCallback(() => setIsProfileModalOpen(true), []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // Firebase connection test is already handled in lib/firebase.ts
  }, []);

  // Sync KMZH params with user data
  useEffect(() => {
    if (user) {
      const newTeacherName = user.displayName || '';
      const newSchoolName = user.school || '№1 мектеп-лицей';
      
      setKmzhParams(prev => {
        if (prev.teacherName === newTeacherName && prev.schoolName === newSchoolName) {
          return prev;
        }
        return {
          ...prev,
          teacherName: newTeacherName,
          schoolName: newSchoolName
        };
      });
    }
  }, [user?.uid, user?.displayName, user?.school, setKmzhParams]);


  const isStudentView = window.location.pathname.includes('/assessment/');
  const isGameView = window.location.pathname.includes('/game/') || window.location.pathname.includes('/play');
  const isPublicGradingView = window.location.pathname.includes('/grading/');

  if (isPublicGradingView) {
    const gradingId = window.location.pathname.split('/grading/')[1];
    return (
      <Suspense fallback={<ViewLoader />}>
        <PublicGradingView 
          gradingId={gradingId} 
          addNotification={addNotification}
        />
      </Suspense>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
        <div className="card card-pad max-w-md w-full text-center">
          <div className="mx-auto mb-8 w-64">
            <Logo className="w-full h-auto" />
          </div>
          <h1 className="text-3xl font-black mb-2">Баптау қажет</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Firebase баптаулары табылмады. Жалғастыру үшін AI Studio Settings мәзірінде 
            Firebase айнымалыларын (VITE_FIREBASE_...) орнатыңыз.
          </p>
        </div>
      </div>
    );
  }

  if (effectiveLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-64 mb-8">
          <Logo className="w-full h-auto" />
        </div>
        <ViewLoader />
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 mb-4">Жүктелуде, күте тұрыңыз...</p>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => window.location.reload()} 
              className="text-xs text-blue-600 underline hover:text-blue-700"
            >
              Бетті қайта жаңарту
            </button>
            <button 
              onClick={() => setIsSafetyTimeoutReached(true)} 
              className="text-[10px] text-slate-400 hover:text-slate-600"
            >
              Күтуді тоқтату (Мәжбүрлі түрде ашу)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isStudentView) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <StudentAssessmentView addNotification={addNotification} />
      </Suspense>
    );
  }

  if (isGameView) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <GamePlayerView />
      </Suspense>
    );
  }

  if (!user) {
    return (
      <div className="page">
        {/* LEFT */}
        <div className="left">
          <div className="left-pattern"></div>
          <div className="shape s1"></div>
          <div className="shape s2"></div>
          <div className="shape s3"></div>

          <div className="left-top">
            <div className="left-logo">
              <Logo className="w-56 h-auto" />
            </div>

            <h1 className="left-headline">
              Мұғалімдер үшін<br /><span>AI көмекші</span>
            </h1>
            <p className="left-desc">
              ҚМЖ, тест, ойын — бәрін секундтарда жасаңыз.
              Қазақстан мұғалімдеріне арналған заманауи платформа.
            </p>

            <div className="features">
              <div className="feat">
                <div className="feat-ico">📋</div>
                <div className="feat-body">
                  <div className="feat-title">ҚМЖ Генератор</div>
                  <div className="feat-desc">Сабақ жоспарын AI жасайды</div>
                </div>
              </div>
              <div className="feat">
                <div className="feat-ico">🎮</div>
                <div className="feat-body">
                  <div className="feat-title">Білім Ойындары</div>
                  <div className="feat-desc">Kahoot, тест, флэшкарта</div>
                </div>
              </div>
              <div className="feat">
                <div className="feat-ico">📝</div>
                <div className="feat-body">
                  <div className="feat-title">БЖБ / ТЖБ</div>
                  <div className="feat-desc">Бағалауды автоматты жасау</div>
                </div>
              </div>
              <div className="feat">
                <div className="feat-ico">💬</div>
                <div className="feat-body">
                  <div className="feat-title">AI Чат — DostUstaz</div>
                  <div className="feat-desc">Кез келген сұраққа жауап</div>
                </div>
              </div>
            </div>
          </div>

          <div className="left-bottom">
            <div className="lb-dot"></div>
            <span className="lb-txt">Қазақстан мұғалімдеріне арналған • Тегін нұсқа қолжетімді</span>
          </div>
        </div>

        {/* RIGHT */}
        <div className="right">
          <div className="login-box">
            <div className="lb-top">
              <div className="lb-welcome">Қош келдіңіз 👋</div>
              <div className="lb-sub">Мұғалімдерге арналған AI платформаға кіру үшін Google аккаунтыңызды пайдаланыңыз.</div>
            </div>

            <button className="google-btn" onClick={handleLogin}>
              <div className="g-logo"></div>
              Google арқылы кіру
            </button>

            <div className="divider">
              <div className="div-line"></div>
              <span className="div-txt">Кіру кезінде қиындық болса</span>
              <div className="div-line"></div>
            </div>

            <div className="info-box">
              <div className="ib-title">💡 Кеңестер</div>
              <div className="ib-item">
                <div className="ib-dot"></div>
                <span>Браузерде «Third-party cookies» рұқсат етілгенін тексеріңіз</span>
              </div>
              <div className="ib-item">
                <div className="ib-dot"></div>
                <span>Safari-де «Prevent Cross-Site Tracking» өшірулі болуы керек</span>
              </div>
              <div className="ib-item">
                <div className="ib-dot"></div>
                <span>Жеке терезеде (Incognito) ашып көріңіз</span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <button 
                onClick={() => setShowDebug(!showDebug)} 
                className="text-[10px] text-slate-400 hover:text-slate-600 underline"
              >
                {showDebug ? 'Жасыру' : 'Кіруде қиындықтар туындады ма?'}
              </button>
            </div>

            {showDebug && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 text-left overflow-auto max-h-40">
                <div className="font-bold border-bottom mb-1 pb-1">Debug Info:</div>
                <div>Firebase Configured: {isFirebaseConfigured ? 'YES' : 'NO'}</div>
                <div>Auth Loading: {authLoading ? 'YES' : 'NO'}</div>
                <div>Safety Timeout: {isSafetyTimeoutReached ? 'REACHED' : 'PENDING'}</div>
                <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
                <div className="mt-2">
                  <button 
                    onClick={() => window.location.reload()} 
                    className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            )}

            <div className="trust">
              <div className="trust-item">🔒 Қауіпсіз кіру</div>
              <div className="trust-item">✓ Google OAuth</div>
              <div className="trust-item">🇰🇿 Қазақ тілі</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeTabLabel = {
    dashboard: t.dashboard,
    kmzh: t.kmzh,
    assessment: t.assessment,
    map: t.map,
    coding: t.coding,
    games: t.games,
    chat: t.chat,
    calendar: t.calendar,
    library: t.library,
    settings: t.settings,
    feedback: 'Кері байланыс',
    grading_simulator: t.grading_simulator,
    image_gen: 'Сурет генераторы',
    admin_kb: 'Білім базасы (Админ)'
  }[activeTab] || '';

  return (
    <GenerationProvider>
      <div className="app">
        <Toast show={toast.show} message={toast.message} />
        
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          isApiOk={isApiOk}
          onOpenApiModal={openApiModal}
          language={language}
          isAdmin={isAdmin}
        />

        <main className="main-area">
          <Topbar 
            activeTabLabel={activeTabLabel} 
            setIsSidebarOpen={setIsSidebarOpen} 
            setIsApiModalOpen={setIsApiModalOpen}
            onProfileClick={openProfileModal}
            isApiOk={isApiOk}
            userName={user?.displayName || ''}
            theme={theme}
            toggleTheme={toggleTheme}
            notifications={notifications}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            language={language}
            setLanguage={handleLanguageChange}
            userRole={user?.role}
          />

          <div className={`page-content ${activeTab === 'grading_simulator' ? '!max-w-none !p-0 !h-[calc(100vh-64px)]' : ''}`}>
            <ErrorBoundary>
              <Suspense fallback={<ViewLoader />}>
                {(() => {
                  console.log("App: Rendering view for tab:", activeTab, "user:", user?.uid, "authLoading:", authLoading);
                  return null;
                })()}
                {activeTab === 'dashboard' && (
                  <DashboardView 
                    user={user}
                    searchQuery={searchQuery}
                    onNavigate={handleNavigate} 
                    t={t}
                    onLogout={handleLogout}
                  />
                )}
                {activeTab === 'kmzh' && (
                  <KMZHView 
                    isApiOk={isApiOk}
                    onOpenApiModal={openApiModal}
                    addNotification={addNotification}
                  />
                )}
                {activeTab === 'assessment' && (
                  <AssessmentView 
                    isApiOk={isApiOk} 
                    onOpenApiModal={openApiModal}
                    addNotification={addNotification} 
                    result={assessmentResult}
                    setResult={setAssessmentResult}
                    onNavigate={handleNavigate}
                    t={t}
                  />
                )}
                {activeTab === 'map' && <MapView addNotification={addNotification} />}
                {activeTab === 'coding' && (
                  <CodingView 
                    isApiOk={isApiOk} 
                    isClaudeApiOk={isClaudeApiOk}
                    onOpenApiModal={openApiModal} 
                    onOpenClaudeApiModal={() => setIsClaudeModalOpen(true)}
                    addNotification={addNotification} 
                  />
                )}
                {activeTab === 'chat' && (
                  <ChatView 
                    isApiOk={isApiOk} 
                    onOpenApiModal={openApiModal} 
                    addNotification={addNotification}
                    onNavigate={handleNavigate}
                  />
                )}
                {activeTab === 'calendar' && <CalendarView />}
                {activeTab === 'library' && <LibraryView searchQuery={searchQuery} isApiOk={isApiOk} onOpenApiModal={openApiModal} addNotification={addNotification} showToast={showToast} t={t} />}
                {activeTab === 'games' && (
                  <GamesView 
                    isApiOk={isApiOk}
                    onOpenApiModal={openApiModal}
                    addNotification={addNotification}
                    onNavigate={handleNavigate}
                  />
                )}
                {activeTab === 'grading_simulator' && (
                  <GradingSimulatorView addNotification={addNotification} showToast={showToast} />
                )}
                {activeTab === 'admin_kb' && isAdmin && (
                  <Suspense fallback={<ViewLoader />}>
                    <AdminKBView kbBackground={kbBackground} showToast={showToast} />
                  </Suspense>
                )}
                {activeTab === 'settings' && (
                  <SettingsView 
                    language={language}
                    setLanguage={handleLanguageChange}
                    apiKeyInput={apiKeyInput}
                    setApiKeyInput={setApiKeyInput}
                    apiKeyInput2={apiKeyInput2}
                    setApiKeyInput2={setApiKeyInput2}
                    apiKeyInput3={apiKeyInput3}
                    setApiKeyInput3={setApiKeyInput3}
                    saveApiKey={saveApiKey}
                    isSavingApi={isSavingApi}
                    isApiOk={isApiOk}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    t={t}
                  />
                )}
                {activeTab === 'feedback' && (
                  <FeedbackView showToast={showToast} />
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        {isProfileModalOpen && (
          <div className="modal-ov show">
            <div className="modal-box">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Профиль</h3>
                <button onClick={() => setIsProfileModalOpen(false)}><X size={20} /></button>
              </div>
              <div className="flex flex-col items-center mb-6">
                <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-20 h-20 rounded-full mb-3 border-4 border-blue-100 dark:border-blue-900" referrerPolicy="no-referrer" />
                <div className="text-lg font-bold">{user.displayName}</div>
                <div className="text-sm text-slate-500">{user.email}</div>
              </div>
              <div className="space-y-4">
                <div className="fg">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flabel mb-0">Gemini API Кілті</label>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${isApiOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isApiOk ? 'Белсенді' : 'Орнатылмаған'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        className="inp flex-1" 
                        value={isApiOk ? '••••••••••••••••' : ''} 
                        disabled 
                        placeholder={isApiOk ? 'Кілт сақталған' : 'Кілт жоқ'}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button className="btn btn-primary btn-sm" onClick={() => { setIsProfileModalOpen(false); setIsApiModalOpen(true); }}>
                        {isApiOk ? 'Өзгерту' : 'Қосу'}
                      </button>
                      {isApiOk && (
                        <button className="btn btn-ghost btn-sm text-red-500 border-red-100" onClick={clearApiKey}>
                          Өшіру
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <button className="btn btn-ghost w-full text-red-500 border-red-100 dark:border-red-900" onClick={handleLogout}>Жүйеден шығу</button>
              </div>
            </div>
          </div>
        )}

        {isApiModalOpen && (
          <div className="modal-ov show">
            <div className="modal-box">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Gemini API Кілті</h3>
                <button onClick={() => setIsApiModalOpen(false)}><X size={20} /></button>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Бұл сайтта әрбір пайдаланушы <b>өз жеке Gemini API кілтін</b> пайдаланады. 
                Бұл сіздің лимиттеріңізді басқаруға және қауіпсіздікті қамтамасыз етуге мүмкіндік береді.
                Кілтті <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-600 underline font-bold">Google AI Studio</a> сайтынан тегін алуға болады.
              </p>
              
              <div className="space-y-4 mb-6">
                <div className="fg">
                  <label className="flabel">API Кілті 1 (Generator)</label>
                  <input 
                    type="password" 
                    className="inp" 
                    placeholder="AIza..." 
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                  />
                </div>
                <div className="fg">
                  <label className="flabel">API Кілті 2 (Critic)</label>
                  <input 
                    type="password" 
                    className="inp" 
                    placeholder="AIza..." 
                    value={apiKeyInput2}
                    onChange={(e) => setApiKeyInput2(e.target.value)}
                  />
                </div>
                <div className="fg">
                  <label className="flabel">API Кілті 3 (Refiner)</label>
                  <input 
                    type="password" 
                    className="inp" 
                    placeholder="AIza..." 
                    value={apiKeyInput3}
                    onChange={(e) => setApiKeyInput3(e.target.value)}
                  />
                </div>
              </div>

              <button 
                className={`btn btn-primary btn-wide ${isSavingApi ? 'opacity-50 cursor-not-allowed' : ''}`} 
                onClick={saveApiKey}
                disabled={isSavingApi}
              >
                {isSavingApi ? 'Сақталуда...' : 'Барлығын сақтау'}
              </button>
            </div>
          </div>
        )}

        {isClaudeModalOpen && (
          <div className="modal-ov show">
            <div className="modal-box">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Claude API Кілті</h3>
                <button onClick={() => setIsClaudeModalOpen(false)}><X size={20} /></button>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Claude API кілтін қосу арқылы сіз Кодинг бөлімінде Anthropic ұсынған Claude 3.5 Sonnet моделін пайдалана аласыз.
                Кілтті <a href="https://console.anthropic.com/" target="_blank" className="text-blue-600 underline font-bold">Anthropic Console</a> сайтынан алуға болады.
              </p>
              <div className="fg mb-6">
                <label className="flabel">Claude API Кілті</label>
                <input 
                  type="password" 
                  className="inp" 
                  placeholder="sk-ant-..." 
                  value={claudeKeyInput}
                  onChange={(e) => setClaudeKeyInput(e.target.value)}
                />
              </div>
              <button 
                className={`btn btn-primary btn-wide ${isSavingClaude ? 'opacity-50 cursor-not-allowed' : ''}`} 
                onClick={saveClaudeKey}
                disabled={isSavingClaude}
              >
                {isSavingClaude ? 'Сақталуда...' : 'Сақтау'}
              </button>
            </div>
          </div>
        )}

        {/* Global KB Ingestion Progress Indicator */}
        <KBProgressIndicator 
          status={kbBackground.status}
          progress={kbBackground.progress}
          currentFileName={kbBackground.currentFileName}
          onViewClick={() => {
            setActiveTab('admin_kb');
            if (kbBackground.status === 'completed') kbBackground.resetStatus();
          }}
          onCloseClick={() => kbBackground.resetStatus()}
          onStopClick={kbBackground.stopIngestion}
        />
      </div>
    </GenerationProvider>
  );
}
