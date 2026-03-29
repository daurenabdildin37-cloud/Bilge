
import React from 'react';
import { Logo } from '../Common/Logo';
import { 
  LayoutDashboard, 
  BookOpen, 
  Gamepad2, 
  MessageSquare, 
  Book, 
  Settings,
  FileText,
  Code,
  MapPin,
  Calendar,
  Database,
  Image as ImageIcon,
  CreditCard,
  Trophy
} from 'lucide-react';

import { translations, Language } from '../../lib/translations';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isApiOk: boolean;
  onOpenApiModal: () => void;
  language: Language;
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isSidebarOpen, 
  setIsSidebarOpen,
  isApiOk,
  onOpenApiModal,
  language,
  isAdmin
}) => {
  console.log("Sidebar: Rendering, activeTab:", activeTab, "isAdmin:", isAdmin);
  const t = translations[language];
  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: <LayoutDashboard size={18} /> },
    { id: 'kmzh', label: t.kmzh, icon: <Book size={18} /> },
    { id: 'assessment', label: t.assessment, icon: <FileText size={18} /> },
    { id: 'grading_simulator', label: t.grading_simulator, icon: <Trophy size={18} /> },
    { id: 'map', label: t.map, icon: <MapPin size={18} /> },
    { id: 'coding', label: t.coding, icon: <Code size={18} /> },
    { id: 'games', label: t.games, icon: <Gamepad2 size={18} /> },
    { id: 'chat', label: t.chat, icon: <MessageSquare size={18} /> },
    { id: 'calendar', label: t.calendar, icon: <Calendar size={18} /> },
    { id: 'library', label: t.library, icon: <BookOpen size={18} /> },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin_kb', label: 'Білім базасы', icon: <Database size={18} /> });
  }

  return (
    <>
      <div 
        className={`overlay ${isSidebarOpen ? 'show' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-wrap">
            <div className="logo-mark">B</div>
            <div className="logo-info">
              <div className="logo-text">Bilge AI</div>
              <div className="logo-sub">Білім платформасы</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Негізгі</div>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.id === 'chat' && <span className="nav-badge">Жаңа</span>}
              </button>
            ))}
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Баптаулар</div>
            <button 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('settings');
                setIsSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><Settings size={18} /></span>
              <span className="nav-label">{t.settings}</span>
            </button>
            <button 
              className={`nav-item ${activeTab === 'feedback' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('feedback');
                setIsSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><MessageSquare size={18} /></span>
              <span className="nav-label">Кері байланыс</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className={`api-pill w-full flex items-center gap-2 ${isApiOk ? 'ok' : 'ok'}`}>
            <div className={`api-dot ${isApiOk ? 'ok' : 'ok'}`}></div>
            <span className="text-[11px] font-bold truncate">
              {isApiOk ? 'Gemini AI Қосулы' : 'AI Қолжетімді'}
            </span>
          </div>
          
          {isAdmin && (
            <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Admin Panel</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
              <div className="text-[10px] text-white/60 font-mono space-y-1">
                <div className="flex justify-between"><span>Tab:</span> <span className="text-white/80">{activeTab}</span></div>
                <div className="flex justify-between"><span>API:</span> <span className={isApiOk ? 'text-emerald-400' : 'text-amber-400'}>{isApiOk ? 'OK' : 'NO'}</span></div>
              </div>
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full mt-3 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-400/10 rounded-lg border border-red-400/20 transition-colors"
              >
                Reset System
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
