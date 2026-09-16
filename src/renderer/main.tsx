import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance baseline: renderer startup
const rendererStartup = performance.now();
console.log(`[MERQO] Renderer startup: ${Math.round(rendererStartup)}ms`);
