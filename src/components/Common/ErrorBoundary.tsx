
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportErrorToAI } from '../../lib/error-handling';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    reportErrorToAI(error, 'uncaught_react_error', { errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      let errorMessage = 'Белгісіз қате туындады.';
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error?.includes('permission-denied')) {
            errorMessage = 'Деректер қорына кіруге рұқсат жоқ. Firebase Security Rules тексеріңіз.';
          } else if (parsed.error?.includes('offline')) {
            errorMessage = 'Интернет байланысы жоқ немесе Firestore-ға қосылу мүмкін емес.';
          } else {
            errorMessage = parsed.error || this.state.error.message;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Қате туындады</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
            {errorMessage}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Бетті жаңарту
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
