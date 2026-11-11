// main.jsx — starts the React app inside <div id="root"> in index.html.
// WP-07 adds the theme (theme.js → CSS variables) and React Router here. Owner: Huzaifah.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
