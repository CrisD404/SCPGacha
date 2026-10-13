import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/global.css';
import { App } from './App';

registerSW({ immediate: true });

if (import.meta.env.DEV) {
  // Atajo de depuración: window.__scp.useGame.getState(), window.__scp.useUi.getState().notify(...)
  void Promise.all([import('./store/game'), import('./store/ui')]).then(([{ useGame }, { useUi }]) => Object.assign(window, { __scp: { useGame, useUi } }));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
