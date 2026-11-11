// vite.config.js — dev server settings for the website.
// The proxy sends every /api request to the Express API on port 8000, so the website and the
// API look like one site in development (no CORS setup needed).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8000' },
  },
});
