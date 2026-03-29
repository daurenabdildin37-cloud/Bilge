
import React from 'react';
import { Save, X, Upload, Loader2 } from 'lucide-react';

interface KBProgressIndicatorProps {
  status: 'idle' | 'processing' | 'saving' | 'completed' | 'error';
  progress: { stage: string; percent: number };
  currentFileName: string | null;
  onViewClick: () => void;
  onCloseClick: () => void;
  onStopClick?: () => void;
}

export const KBProgressIndicator: React.FC<KBProgressIndicatorProps> = ({
  status,
  progress,
  currentFileName,
  onViewClick,
  onCloseClick,
  onStopClick
}) => {
  if (status === 'idle' || status === 'error') return null;

  if (status === 'completed') {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-80 animate-in slide-in-from-right-10 duration-500">
        <div className="card card-pad bg-emerald-50 dark:bg-emerald-900/20 shadow-2xl border-emerald-200 dark:border-emerald-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Өңдеу аяқталды!</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Бөлімдерді тексеріп, сақтаңыз.</p>
            </div>
            <button 
              className="btn btn-primary btn-sm"
              onClick={onViewClick}
            >
              Көру
            </button>
            <button 
              className="p-1 text-emerald-400 hover:text-emerald-600"
              onClick={onCloseClick}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 animate-in slide-in-from-right-10 duration-500">
      <div className="card card-pad bg-white dark:bg-slate-900 shadow-2xl border-emerald-100 dark:border-emerald-900/30 overflow-hidden">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
            {status === 'saving' ? (
              <Save className="animate-pulse" size={20} />
            ) : (
              <div className="animate-spin">
                <Loader2 size={24} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {status === 'saving' ? 'Білім базасына сақталуда...' : (currentFileName || 'Файлды өңдеу...')}
            </h4>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              {progress.stage}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status === 'processing' && onStopClick && (
              <button 
                className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-red-400 hover:text-red-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("AI өңдеуді тоқтатуды растайсыз ба?")) onStopClick();
                }}
                title="Тоқтату"
              >
                <X size={16} />
              </button>
            )}
            <button 
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"
              onClick={onViewClick}
              title="Көру"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-emerald-600 h-full transition-all duration-500 ease-out"
            style={{ width: `${progress.percent}%` }}
          ></div>
        </div>
        <div className="mt-2 text-right">
          <span className="text-[10px] font-bold text-emerald-600">{progress.percent}%</span>
        </div>
      </div>
    </div>
  );
};
