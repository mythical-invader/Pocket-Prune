// eslint.config.js — one lint setup for the whole repo (backend, worker, scripts, website).
// Keeps the rules close to the defaults so the code style is easy to follow.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'data/**', 'mobile/**'] },

  // Everything: modern JavaScript with recommended rules.
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },

  // Backend, worker and scripts run in Node.
  {
    files: ['backend/**/*.js', 'scripts/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['backend/tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },

  // Website: React (JSX) running in the browser.
  { files: ['frontend/**/*.{js,jsx}'], ...react.configs.flat.recommended },
  { files: ['frontend/**/*.{js,jsx}'], ...react.configs.flat['jsx-runtime'] },
  {
    files: ['frontend/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off', // we use plain JS, not PropTypes
    },
  },
  {
    files: ['frontend/vite.config.js'],
    languageOptions: { globals: globals.node },
  },
];
