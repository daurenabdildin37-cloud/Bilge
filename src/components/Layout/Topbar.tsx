
import React, { useState } from 'react';
import { 
  Menu, 
  Key, 
  Search, 
  Bell, 
  User,
  Sun,
  Moon,
  X,
  Check
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

interface TopbarProps {
  activeTabLabel: string;
  setIsSidebarOpen: (open: boolean) => void;
  setIsApiModalOpen: (open: boolean) => void;
  onProfileClick: () => void;
  isApiOk: boolean;
  userName: string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  notifications: any[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
  userRole?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ 
  activeTabLabel, 
  setIsSidebarOpen, 
  setIsApiModalOpen,
  onProfileClick,
  isApiOk,
  userName,
  theme,
  toggleTheme,
  notifications,
  searchQuery,
  setSearchQuery,
  language,
  setLanguage,
  userRole
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="topbar">
      <div className="flex items-center gap-4 flex-1">
        <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={20} />
        </button>
        
        {!isSearchOpen ? (
          <div className="topbar-title">
            {activeTabLabel}
          </div>
        ) : (
          <div className="flex-1 max-w-md relative animate-slideRight">
            <input 
              type="text" 
              className="inp w-full !pl-14 pr-10 py-2 bg-slate-50 border-none focus:bg-white" 
              placeholder="Материалдарды іздеу..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <button 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button 
          onClick={() => setIsApiModalOpen(true)}
          className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[11px] font-bold ${
            isApiOk 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400' 
              : 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-400 animate-pulse'
          }`}
        >
          <Key size={14} />
          <span className="hidden md:inline">{isApiOk ? 'Gemini AI' : 'API Кілті жоқ'}</span>
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>

        <button className={`btn-icon ${isSearchOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`} onClick={() => setIsSearchOpen(!isSearchOpen)}>
          <Search size={18} />
        </button>

        <div className="relative">
          <button className="btn-icon relative" onClick={() => setIsNotifOpen(!isNotifOpen)}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-pop">
              <div className="p-4 border-bottom flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h4 className="font-bold text-sm">Хабарламалар</h4>
                {notifications.length > 0 && (
                  <button 
                    className="text-[10px] text-red-500 hover:underline font-bold"
                    onClick={async () => {
                      for (const n of notifications) {
                        await deleteNotification(n.id);
                      }
                    }}
                  >
                    Барлығын өшіру
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Bell size={20} />
                    </div>
                    <p className="text-slate-400 text-xs">Хабарламалар жоқ</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-4 border-bottom hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative ${!n.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                      onClick={() => deleteNotification(n.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-bold text-xs pr-4">{n.title}</div>
                        <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{n.message}</div>
                      <div className="text-[9px] text-slate-400 mt-2 font-medium">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Қазір'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="btn-icon" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>

        <div className="flex items-center gap-2 pl-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={onProfileClick}>
          <div className="hidden sm:block text-right">
            <div className="text-[12px] font-bold leading-none mb-1">{userName}</div>
            <div className="text-[10px] text-slate-400 font-medium">
              {userRole === 'admin' ? 'Администратор' : 'Мұғалім'}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 overflow-hidden">
            <User size={18} className="text-slate-500" />
          </div>
        </div>
      </div>
    </header>
  );
};
