import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CallProvider } from './context/CallContext.tsx';

import { LanguageContextProvider } from './context/LanguageContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CallProvider>
      <LanguageContextProvider>
        <App />
      </LanguageContextProvider>
    </CallProvider>
  </StrictMode>,
);
