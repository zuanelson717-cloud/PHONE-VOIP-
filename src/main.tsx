import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CallProvider } from './context/CallContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CallProvider>
      <App />
    </CallProvider>
  </StrictMode>,
);
