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

## WP-03 — Backend core

What happens when a request arrives:

```
request ─▶ express.json() ─▶ morgan (log) ─▶ route ─▶ protect (who?) ─▶ controller ─▶ JSON reply
                                                 │                         │
                                                 └──── any error ──────────┴──▶ errorHandler ─▶ { code, message, hint }
```

| File                              | What it does                                                                                                                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/settings.js`              | Loads the root `.env` once and exports `settings` — every setting with its default. Other files import `settings` instead of reading `process.env`.                                                                                                |
| `config/db.js`                    | `connectDB(uri)` connects Mongoose to MongoDB (Atlas or local); `isDBConnected()` is used by the health check.                                                                                                                                     |
| `server.js`                       | Connects to the database first; if that fails it prints a clear message and stops. Then starts listening.                                                                                                                                          |
| `models/User.js`                  | Account: email (unique, lower-case), `passwordHash`, role. The hash is removed from every JSON reply.                                                                                                                                              |
| `models/CatalogModel.js`          | A Hugging Face model we allow, with its pinned `revision` (commit hash), size, licence, demo/active flags.                                                                                                                                         |
| `models/DeviceProfile.js`         | A user's target device: RAM, free disk, threads, preference (quality/speed/smallest/balanced).                                                                                                                                                     |
| `models/Job.js`                   | One compression request and everything it produces. Also exports `JOB_STATUSES` and `QUANT_LEVELS` so other files use the same lists. Variants (files), their metrics and the recommendation are stored _inside_ the job.                          |
| `models/JobEvent.js`              | One log line of a job (stage, info/warn/error, message).                                                                                                                                                                                           |
| `utils/errors.js`                 | The table of error codes (HTTP status, message, hint) and `appError(code)` to throw one.                                                                                                                                                           |
| `middleware/errorHandler.js`      | `notFound` for unknown `/api` addresses; `errorHandler` turns any error — ours, Mongoose validation, bad id, bad JSON, duplicate key, or a crash — into `{ code, message, hint }`. Crashes are logged in the terminal but never shown to the user. |
| `middleware/authMiddleware.js`    | `protect` sets `req.user`. For now it always uses the demo user (created on first use). WP-21 swaps in the real login check without touching any route.                                                                                            |
| `utils/systemInfo.js`             | Reads RAM (`os`), threads and free disk (`fs.statfs`) — works on Windows and Linux.                                                                                                                                                                |
| `controllers/systemController.js` | `getHealth` and `getHostProfileHandler`.                                                                                                                                                                                                           |
| `routes/systemRoutes.js`          | `/api/system/health` (public) and `/api/system/host-profile` (protected).                                                                                                                                                                          |

### Tests

`npm test` starts **one in-memory MongoDB** (`tests/helpers/globalSetup.js`, using
mongodb-memory-server) and gives every test file its own empty database (`tests/helpers/testDb.js`).
So tests never touch Atlas and need no setup. The first run downloads a MongoDB binary (~100 MB,
cached afterwards).

- `system.test.js` — health, host profile, demo user created once.
- `errors.test.js` — every code has a message/hint; the handler's output for our errors, crashes,
  validation errors, unknown routes and bad JSON.
- `models.test.js` — schemas accept good data and reject bad data (unknown preference, no level,
  F16 requested, unknown level).
