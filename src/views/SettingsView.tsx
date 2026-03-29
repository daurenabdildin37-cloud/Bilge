
import * as React from 'react';
import { Globe, Key, Moon, Sun, CheckCircle2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../lib/translations';

interface SettingsViewProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  saveApiKey: () => void;
  isSavingApi: boolean;
  isApiOk: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  t: any;
}

const SettingsView = ({
  language,
  setLanguage,
  apiKeyInput,
  setApiKeyInput,
  saveApiKey,
  isSavingApi,
  isApiOk,
  theme,
  toggleTheme,
  t
}: SettingsViewProps) => {
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

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm leading-relaxed">
              <p className="mb-2">{t.apiHelp}</p>
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

            <div className="fg">
              <label className="flabel">{t.apiKey}</label>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  className="inp flex-1" 
                  placeholder={t.apiPlaceholder}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
                <button 
                  className={`btn btn-primary px-8 ${isSavingApi ? 'opacity-50' : ''}`}
                  onClick={saveApiKey}
                  disabled={isSavingApi}
                >
                  {isSavingApi ? t.saving : t.save}
                </button>
              </div>
              {isApiOk && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                  Кілт белсенді және сақталған
                </div>
              )}
            </div>
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
