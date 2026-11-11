# How PocketPrune works

A plain-English walkthrough of the code, file by file. Each work package adds its own section.

## The big picture

```
 Website (React, port 5173) ──/api──▶ API (Express, port 8000) ──▶ MongoDB (jobs, results)
                                                                       ▲
                                     Worker (separate Node process) ───┘  runs llama.cpp
```

- The **website** is what users click. It never touches files or llama.cpp; it only calls the API.
- The **API** checks requests, saves jobs in MongoDB and returns results.
- The **worker** (from WP-11) picks the oldest waiting job from MongoDB, runs llama.cpp step by step
  and writes progress and results back. Because they only share the database, the API stays fast
  even while a model is being compressed for minutes.
- Model files (`.gguf`) live on disk in `data/`; the database stores only their path, size and
  checksum.

## WP-01 — Project setup

### Root folder

| File                                                    | What it does                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                          | Scripts that run the whole project from the root: `install-all`, `dev`, `dev:worker`, `dev:all`, `seed`, `test`, `build`, `lint`, `progress`. They use `--prefix backend` / `--prefix frontend` to run the script of a sub-folder, and `concurrently` to run several at once — both work on Windows and Linux. |
| `.env.example`                                          | Every setting the project will use, with comments. Copy it to `.env` and fill in your values. `.env` is never committed.                                                                                                                                                                                       |
| `.gitignore`                                            | Keeps `node_modules`, `.env`, `data/` (model files) and build output out of Git.                                                                                                                                                                                                                               |
| `.gitattributes`                                        | Makes Git store text files with LF line endings, so the same files work on Windows and WSL2.                                                                                                                                                                                                                   |
| `eslint.config.js`, `.prettierrc.json`, `.editorconfig` | One code style for both members. `npm run lint` finds mistakes, `npm run format` fixes spacing.                                                                                                                                                                                                                |

### Backend (`backend/`)

| File                                                                                  | What it does                                                                                                      |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `server.js`                                                                           | Loads `.env` from the root, then starts the app on `PORT` (8000).                                                 |
| `app.js`                                                                              | Creates the Express app: JSON body parsing, request logging (morgan) and the routes. For now only `GET /api`.     |
| `tests/app.test.js`                                                                   | Calls `GET /api` with supertest (no real port) and checks the answer. Every future API test follows this pattern. |
| `worker/worker.js`                                                                    | Placeholder that only prints a message, so `npm run dev:worker` already works. Real worker: WP-11.                |
| `seed.js`                                                                             | Placeholder. The real catalog seed is WP-05.                                                                      |
| `config/`, `models/`, `controllers/`, `routes/`, `middleware/`, `services/`, `utils/` | Empty for now (kept by `.gitkeep`); filled from WP-03 onwards.                                                    |

### Website (`frontend/`)

| File             | What it does                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `index.html`     | The single HTML page; React draws everything inside `<div id="root">`.                        |
| `src/main.jsx`   | Starts React.                                                                                 |
| `src/App.jsx`    | Skeleton page: calls `GET /api` and shows "API: connected". Replaced in WP-07.                |
| `vite.config.js` | Dev server on port 5173; forwards every `/api` request to the API on port 8000 (the "proxy"). |

### Scripts and docs

- `scripts/progress.js` reads `docs/progress.json` and prints the percentage done (merged WPs only),
  a bar per phase, each member's share, the next deadline and who is waiting on whom.
- `.github/workflows/ci.yml` runs on every push and pull request: install, lint, backend tests,
  website build. A red cross on the PR means something is broken.
