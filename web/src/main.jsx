import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { useStore } from './lib/store';
import './styles/global.css';

document.documentElement.dataset.theme = useStore.getState().theme;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// debugging handle (also handy for power users)
window.__csleaf = { store: useStore };
