import './lib/polyfills';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/Common/ErrorBoundary';

import { AuthProvider } from './contexts/AuthContext';
import { GenerationProvider } from './contexts/GenerationContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <GenerationProvider>
          <App />
        </GenerationProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
