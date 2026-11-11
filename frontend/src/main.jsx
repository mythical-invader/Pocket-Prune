// main.jsx — starts the React app: loads the font, turns theme.js into CSS variables,
// then renders <App /> inside <div id="root">. Owner: Huzaifah.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter'; // served from our own files, no external font request
import { applyTheme } from './theme/applyTheme.js';
import './index.css';
import './components/components.css';
import App from './App.jsx';

applyTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
