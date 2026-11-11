// App.jsx — SKELETON (WP-01): shows that the website runs and can reach the API.
// WP-07 replaces this with the real layout, navbar and pages. Owner: Huzaifah.
import { useEffect, useState } from 'react';

export default function App() {
  const [apiStatus, setApiStatus] = useState('checking…');

  useEffect(() => {
    // The Vite proxy forwards /api to the Express server (see vite.config.js).
    fetch('/api')
      .then((res) => res.json())
      .then((data) => setApiStatus(data.status === 'ok' ? 'connected' : 'unexpected answer'))
      .catch(() => setApiStatus('not reachable — is `npm run dev` running?'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 640 }}>
      <h1>PocketPrune</h1>
      <p>Edge LLM Compression &amp; Deployment Toolkit — website skeleton.</p>
      <p>
        API: <strong>{apiStatus}</strong>
      </p>
    </main>
  );
}
