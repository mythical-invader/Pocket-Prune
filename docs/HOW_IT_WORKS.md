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
| `server.js`                                                                           | Loads `.env` from the root, then starts the app on `API_PORT` (8000).                                             |
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

## WP-07 — Website foundation

### Styling choice: plain CSS + CSS variables

No UI kit. `theme/theme.js` holds every colour, font size, spacing and radius; `theme/applyTheme.js`
copies it into CSS variables (`--color-primary`, `--space-md`, …) when the site starts, and the CSS
files only use those variables. Why: it is the simplest thing a classmate can read, it adds no
library to learn, and the same `theme.js` object can be used directly in React Native
`StyleSheet`s later, so the app looks the same.

### Layout: the pipeline rail

Every job page shows the five steps of a compression job across the top — **Model → Device →
Preflight → Run → Results** — so the user always knows where they are. The step content is on
the left; a **"Your job"** card on the right keeps the choices made so far and the button to the
next step. History, Downloads and Help sit in the top bar.

| File                               | What it does                                                                                                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme/theme.js`                   | The single source of colours, fonts, spacing, radius (CLAUDE.md §9 plus a few extra shades for selected items and readable badge text).                                                                         |
| `theme/applyTheme.js`              | Turns `theme.js` into CSS variables on `<html>`.                                                                                                                                                                |
| `index.css`                        | Base styles: font, headings, focus ring, text selection colour, reduced motion.                                                                                                                                 |
| `main.jsx`                         | Loads the Inter font from our own files, applies the theme, renders `App`.                                                                                                                                      |
| `App.jsx`                          | The pages and their addresses (React Router): `/catalog`, `/profiles`, `/job/new`, `/history`, `/downloads`, `/help`.                                                                                           |
| `components/AppLayout.jsx`         | Top bar + pipeline rail around every page. `PIPELINE_STEPS` lists the steps.                                                                                                                                    |
| `components/JobSummary.jsx`        | The "Your job" card.                                                                                                                                                                                            |
| `components/CompressionLadder.jsx` | PocketPrune's signature picture: one bar per level, length ∝ file size.                                                                                                                                         |
| `components/*.jsx`                 | Small reusable pieces: `Button`, `Card`, `Badge`, `StatusBadge`, `ProgressBar`, `StageStepper`, `PageHeader`, `EmptyState`, `ErrorAlert`, `Loader`, `Field`. The mobile app will copy the same names and props. |
| `components/components.css`        | Styles for those components and the layout, including the phone layout (`@media (max-width: 720px)`).                                                                                                           |
| `context/JobDraftContext.jsx`      | Remembers the chosen model, device and levels while moving between steps (kept in `sessionStorage`, so a refresh keeps them).                                                                                   |
| `services/api.js`                  | The only file that calls the backend: one function per endpoint; every failure becomes `{ code, message, hint }`.                                                                                               |
| `utils/useLoad.js`                 | Loads data when a page opens, with `reload()` for the "Try again" button.                                                                                                                                       |
| `utils/format.js`                  | `formatMb`, `formatParams`, … and `estimateSizeMb` (expected size per level from bits per weight).                                                                                                              |
| `pages/CatalogPage.jsx`            | Step 1: model cards with badges (Demo, Needs token), parameters, licence, F16 size and the ladder; **Select** stores the model.                                                                                 |
| `pages/ProfilesPage.jsx`           | Step 2: device cards; add / edit / delete; **Use this computer's values** fills the form from `/api/system/host-profile`; the form works in GB and sends MB.                                                    |
| `pages/JobSetupPage.jsx`           | Step 3: level choices with estimated sizes, expected-files ladder, the preflight checklist, licence checkbox. Run preflight / Start compression stay disabled until WP-08 / WP-10.                              |
| `pages/PlaceholderPage.jsx`        | History, Downloads, Help and "page not found" until their WPs are built.                                                                                                                                        |

### What needs the next WPs

- The catalog and profile lists call `/api/catalog` and `/api/profiles`, which arrive in **WP-05**.
  Until then the pages show the standard error card (`E-NOTFOUND-01`, with "Try again").
- **WP-08** makes "Run preflight" work and shows real pass/fail per check; **WP-10** enables
  "Start compression".

## WP-05 — Catalog and profiles API

| File                                                 | What it does                                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/seedData.js`                                | The 8 catalog models (3 demo, 4 standard incl. the gated Llama 3.2, 1 stretch) with their **pinned commit hash**, parameter count, licence and F16 size (= parameters × 2 bytes).                                   |
| `backend/services/catalogService.js`                 | `checkCatalogEntry()` — the catalog rules: `owner/model` id, a full 40-character commit hash, and at most `MAX_PARAMS_BILLION` (4 B) parameters.                                                                    |
| `backend/seed.js`                                    | `npm run seed`: checks each entry, then **upserts** it by `hfRepoId` (safe to run again; it never duplicates and keeps an admin's on/off switch), and creates the demo user.                                        |
| `controllers/catalogController.js`                   | `listCatalog` (active models, demo first, then smallest) and `getCatalogModel` (`E-CAT-01` when missing or switched off).                                                                                           |
| `controllers/profileController.js`                   | List / read / create / update / delete device profiles. Every query includes `user: req.user._id`, so another user's profile is simply "not found". Only the five editable fields are copied from the request body. |
| `routes/catalogRoutes.js`, `routes/profileRoutes.js` | `/api/catalog…` and `/api/profiles…`, all behind `protect`.                                                                                                                                                         |

Validation lives in the Mongoose schema (`models/DeviceProfile.js`); a failed save turns into
`400 E-INPUT-01` with the field names, which the website shows under each field.

Tests: `catalog.test.js` (ordering, inactive hidden, `E-CAT-01`, seed rules) and
`profiles.test.js` (CRUD, validation, ignored `user` field, other user's profile → 404).

## WP-02 — llama.cpp setup

| Path                          | What it does                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/setup-llamacpp.js`   | `npm run setup:llamacpp`. Reads `LLAMA_CPP_DIR` and `LLAMA_CPP_REF` from `.env`, downloads that llama.cpp tag (source + Windows CPU build, or a CMake build on Linux), creates the Python venv, checks `--version`, writes `VERSION`. Skips everything if `VERSION` already matches. |
| `LLAMA_CPP_DIR/bin`           | The llama.cpp programs: `llama-quantize`, `llama-completion`, `llama-bench`, `llama-perplexity`, …                                                                                                                                                                                   |
| `LLAMA_CPP_DIR/src`           | llama.cpp source at the same tag — we only use `convert_hf_to_gguf.py` (and its `gguf-py` library) from it.                                                                                                                                                                          |
| `LLAMA_CPP_DIR/venv`          | Private Python with the converter's packages and the `hf` download tool.                                                                                                                                                                                                             |
| `data/models/<model>`         | Downloaded safetensors snapshot (git-ignored; deleted after conversion once the pipeline exists).                                                                                                                                                                                    |
| `data/artifacts/*.gguf`       | The F16 and quantized GGUF files (git-ignored).                                                                                                                                                                                                                                      |
| `data/wikitext/wiki.test.raw` | WikiText-2 test text for perplexity (SHA-256 `173c87a5…dd08`; WP-09's `fetch-wikitext.js` will download it automatically).                                                                                                                                                           |

The commands themselves are explained step by step in [LEARNING_NOTES §5](LEARNING_NOTES.md#5-quantization-levels-and-the-hand-compression-wp-02). From WP-04 on, Node runs them through `runCommand.js`.

## WP-04 — Command runner

| File                           | What it does                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/utils/runCommand.js`  | `runCommand(program, args, { timeoutMs, onLine, env, cwd })` starts a program without a shell, sends each output line to `onLine`, and resolves `{ code, stdout, lines, durationSec }`. Too slow → `E-TIME-01`; cannot start → `E-TOOL-01`. |
| `backend/worker/llamacpp.js`   | Builds the llama.cpp commands: `convertToF16`, `quantize` (`E-LVL-01` / `E-QNT-01`), `smokeTest` (returns `{ passed, output }`), `checkInstalled` (pinned tag), `toolPath` / `pythonPath` (adds `.exe` / `Scripts\` on Windows).            |
| `backend/worker/downloader.js` | `downloadModel(repo, revision)` runs `hf download` into `data/models/<owner>__<name>`, reuses a finished download of the same revision, and maps failures to `E-HF-01` / `E-HF-02`.                                                         |

What the pipeline (WP-06) will do with these:

```js
const { dir } = await downloadModel(model.hfRepoId, model.revision, { onLine });
await convertToF16(dir, f16File, { onLine });
await quantize(f16File, q4File, 'Q4_K_M', { onLine });
const { passed } = await smokeTest(q4File, { onLine });
```

## WP-06 — CLI pipeline + fake pipeline

| File                             | What it does                                                                                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend/worker/pipeline.js`     | `runPipeline(job, report)`: checks llama.cpp, downloads, converts to F16 (with a fixed `--model-name`), quantizes each level (a failure skips only that level), smoke-tests every file, and returns `{ variants, llamaCppRef }`. Files go to `data/artifacts/<jobId>/<name>-<LEVEL>.gguf`. |
| `backend/worker/reporter.js`     | `consoleReporter()` prints stages and log lines; `dbReporter(job)` writes them to the Job and JobEvent collections. `STAGE_PROGRESS` maps each stage to a progress %.                                                                                                                      |
| `backend/worker/fakePipeline.js` | ⏳ Temporary. Same function, no tools: walks all stages with a delay and returns real WP-02 numbers + `fake: true`.                                                                                                                                                                        |
| `backend/utils/fileHash.js`      | `sha256File(path)` (streamed, works for multi-GB files) and `fileSizeMb(path)`.                                                                                                                                                                                                            |
| `backend/cli.js`                 | `npm run pipeline -- --model <repo> --levels Q5_K_M,Q4_K_M [--fake]`. Looks up the pinned revision in `seedData.js`, runs the pipeline with the console reporter, prints a table. No database needed.                                                                                      |

How the worker (WP-11) will use it:

```js
const result = await runPipeline(job, dbReporter(job)); // or fakePipeline when FAKE_PIPELINE=true
job.variants = result.variants; // then status COMPLETED (or FAILED with the error code)
```

## WP-09 — Catalog trials

| File                          | What it does                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/validate-catalog.js` | `npm run validate:catalog`: for each model in `seedData.js`, asks the Hugging Face API (no download) whether the pinned commit exists, has safetensors, is ≤ 4 B, and has the right `gated` flag. |
| `scripts/fetch-wikitext.js`   | `npm run fetch:wikitext`: downloads WikiText-2 `wiki.test.raw` to `data/wikitext/` and checks its SHA-256, so perplexity (WP-16) is always measured on identical text.                            |
| `backend/utils/runCommand.js` | Now also points `TMP`/`TEMP`/`TMPDIR` of every tool to `data/tmp`, so no scratch files go to C:.                                                                                                  |
| `backend/seedData.js`         | Measured F16 sizes (used by preflight); revisions confirmed.                                                                                                                                      |
| `docs/catalog-trials.md`      | Result of compressing every catalog model with the CLI: sizes, smoke tests, works / doesn't.                                                                                                      |

## WP-08 — Preflight

| File                                   | What it does                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/services/preflightService.js` | One small function per check (`checkModel`, `checkLevels`, `checkProfile`, `checkDisk`, `checkRam`, `checkLicence`, `checkToken`, `checkTool`, `checkActiveJobs`), each returning a row `{ id, label, passed, message, code?, hint? }`. `runPreflight()` looks everything up once (model, your profile, your active jobs, free disk on `DATA_DIR`, free RAM) and returns `{ passed, checks }`. |
| `backend/controllers/jobController.js` | `preflight` — reads `{ modelId, levels, profileId, licenseAccepted }` and answers with the checklist. A failed check is a normal answer (200), not an error.                                                                                                                                                                                                                                   |
| `backend/routes/jobRoutes.js`          | `POST /api/jobs/preflight`, behind `protect`. More job routes arrive in WP-10.                                                                                                                                                                                                                                                                                                                 |
| `frontend/src/pages/JobSetupPage.jsx`  | Licence box + **Run preflight**; shows each check with a green tick or red cross, the reason, the fix and the code. Changing a level or the licence box clears the old result.                                                                                                                                                                                                                 |

The llama.cpp check reuses Sibghatullah's `checkInstalled()` from `worker/llamacpp.js`, so the
API and the worker agree on what "installed" means. With `FAKE_PIPELINE=true` it is skipped.

Tests: `backend/tests/preflight.test.js` — one test per check, plus the endpoint (all pass, every
failure listed at once, bad model id, someone else's profile, the 2-job limit).

## WP-10 — Jobs API

The website never runs a compression itself. It **creates a job** in MongoDB and walks away;
the worker (WP-11) picks the oldest `QUEUED` job and runs it.

```
Job Setup ──POST /api/jobs──▶ preflight again ──▶ Job { status: QUEUED } ──▶ worker picks it up
                                                         │
Progress page ◀──GET /api/jobs/:id (status, %, log)──────┘  (worker updates status + JobEvents)
```

| File                                   | What it does                                                                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/controllers/jobController.js` | `createJob` runs preflight again (so nobody can skip it), saves the job and a first log line, answers `202 { jobId }`. `listJobs` lists your jobs. `getJob` returns one job with its latest 50 log lines and its queue position. Every query filters by `user: req.user._id`. |
| `backend/routes/jobRoutes.js`          | `POST /api/jobs/preflight`, `POST /api/jobs`, `GET /api/jobs`, `GET /api/jobs/:id`.                                                                                                                                                                                           |
| `frontend/src/pages/JobSetupPage.jsx`  | After a passed preflight, **Start compression** creates the job and shows "waiting in the queue (position N)" with the job ID.                                                                                                                                                |

The API does **not** set `fake` or `demoMode` on the job: the worker decides which pipeline to
run (its own `.env`), so it writes those when it finishes.

Tests: `backend/tests/jobs.test.js` — 202 within 1 s, the preflight gate (first code + every
failed check), the 2-job limit (429), list order, queue position, 50 log lines, other user's job → 404.

## WP-11 — Worker

| File                                   | What it does                                                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/worker/worker.js`             | `npm run dev:worker`. Every 3 s: `recoverStuckJobs()` (running jobs with a heartbeat older than 60 s → FAILED E-WORKER-01), then `pickNextJob()` (oldest QUEUED → DOWNLOADING in one atomic step), then `processJob()`. |
| `processJob(job)`                      | Loads the catalog model, starts a 10 s heartbeat, runs `pipeline.js` (or `fakePipeline.js` when `FAKE_PIPELINE=true`) with `cancellableReporter`, then saves COMPLETED + variants, FAILED + error code, or CANCELLED.   |
| `cancellableReporter(job)`             | The normal `dbReporter`, but before every new stage it re-reads `cancelRequested` and stops the pipeline if the user cancelled.                                                                                         |
| `backend/tests/worker.test.js`         | 11 tests on the in-memory MongoDB: oldest-first, no double pick, COMPLETED/FAILED/CANCELLED, deleted model, crash → E-SERVER-01, recovery, fake vs real. Both pipelines are mocked.                                     |
| `backend/tests/helpers/globalSetup.js` | Now keeps the MongoDB test download in `node_modules/.cache` (never the home folder on C:).                                                                                                                             |

A job's life: website **Start compression** → `POST /api/jobs` saves `QUEUED` → the worker takes it
within 3 s → stages update `status`, `stage`, `progressPct` and add JobEvents → `GET /api/jobs/:id`
shows them → `COMPLETED` with three files in `data/artifacts/<jobId>/`.

## WP-12 — Job Progress page

```
Start compression ──▶ /jobs/:id ──every 2 s──▶ GET /api/jobs/:id ──▶ redraw
                                   (stops when COMPLETED / FAILED / CANCELLED)
```

| File                                       | What it does                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/utils/usePolling.js`         | `usePolling(fetcher, ms, stopWhen)` — loads once, then again every `ms` until `stopWhen(data)` is true; skips rounds while the tab is hidden; also returns `fetchedAt` (when the latest answer arrived).                                                                                                                                                                          |
| `frontend/src/pages/JobProgressPage.jsx`   | The page: header with status and **FAKE DATA** badges, the 9-stage stepper (Queued → Download → Convert → Quantize → Smoke test → Benchmark → Evaluate → Recommend → Done), progress bar, "now", elapsed time, queue position, a hint when waiting long for the worker, the error card (code, message, fix), the files made (level, size, smoke test, SHA-256) and the log panel. |
| `frontend/src/components/StageStepper.jsx` | Now also shows a **failed** step (red cross) where a job stopped.                                                                                                                                                                                                                                                                                                                 |
| `backend/controllers/jobController.js`     | `GET /api/jobs/:id` adds `errorHint` for failed jobs.                                                                                                                                                                                                                                                                                                                             |
| `frontend/src/pages/JobSetupPage.jsx`      | After **Start compression**, saves the job id and opens `/jobs/:id`.                                                                                                                                                                                                                                                                                                              |
| `frontend/src/components/AppLayout.jsx`    | The rail shows **Run** on `/jobs/...`; the Run step links to the latest job.                                                                                                                                                                                                                                                                                                      |

**Which stages get a tick:** every stage before the furthest one the job really reached (from its
status, its log lines and whether files exist). A stage the pipeline doesn't run yet stays grey.

## WP-13 — Pipeline hardening

| File                           | What changed                                                                                                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/utils/runCommand.js`  | `killTree(child)`: a timeout stops the tool **and every program it started** (`taskkill /T /F` on Windows, the process group on Linux).                                                                                                                                    |
| `backend/worker/pipeline.js`   | `ensureDiskReserve()` before download, convert and each quantization (E-DISK-01 below `DISK_RESERVE_MB`); any error or cancel deletes `data/artifacts/<jobId>/`; after conversion the download is deleted unless the model `isDemo`. `jobDir(jobId)` gives a job's folder. |
| `backend/worker/downloader.js` | A half-finished download stays for resume (REQ-11); a refused gated download (E-HF-01) is removed.                                                                                                                                                                         |
| `backend/worker/worker.js`     | `removeJobFiles()` on every FAILED / CANCELLED job and every recovered (crashed) job — also covers the fake pipeline; empties `data/tmp` at start.                                                                                                                         |
| `scripts/regression.js`        | `npm run regression`: real pipeline on the 3 demo models, sizes compared with earlier measurements (±1 %), plus a 1-second-limit stop test; writes `docs/regression-M2.md`.                                                                                                |
| Tests                          | +14: process tree, clean-up on failure / cancel / E-VAL-01, disk reserve before and during a job, snapshot kept for demo models, download resume, worker clean-up.                                                                                                         |

## WP-15 — Results table

```
Progress page (job COMPLETED) ──"See results"──▶ /jobs/:id/results ──▶ GET /api/jobs/:id/results
```

| File                                       | What it does                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/utils/sizeEstimate.js`            | `estimateSizeMb(f16SizeMb, level)` from bits per weight — now shared by preflight and results.                                                                                                                                                                                   |
| `backend/services/resultsService.js`       | Plain functions, no database: `pctChange`, `compareVariant` (every metric vs F16 + estimate vs real size), `buildResults` (rows F16 first, which metrics were measured, recommendation if any). `METRICS` lists each number with its unit and whether lower or higher is better. |
| `backend/controllers/resultController.js`  | `GET /api/jobs/:id/results` — own jobs only, and only when `COMPLETED` (otherwise a clear 404 "not finished").                                                                                                                                                                   |
| `frontend/src/components/MetricsTable.jsx` | The comparison table (the mobile app copies it): one row per file, one column per measured number, change vs F16 in green/red, "est." under the size. Scrolls sideways inside its card on phones.                                                                                |
| `frontend/src/pages/ResultsPage.jsx`       | Results page: FAKE DATA / Demo badges, recommendation (when the job has one), the table, a note listing what wasn't measured, and the settings (model, revision, llama.cpp, finished).                                                                                           |

Only measured columns appear: a real job before WP-14/16 shows Size and Smoke test; fake jobs (and
later real ones) show all five numbers. The recommendation block is basic for now; WP-19 adds the
full card, the profile dropdown and export.

## WP-14 — Benchmarking

| File                          | What it does                                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/worker/llamacpp.js`  | `benchmark(file)`: `llama-bench -p 512 -n 128 -r 3 -ngl 0 -o json` (demo mode `-p 128 -n 32`; `-t` only if `BENCH_THREADS` is set). Only stderr goes to the job log; stdout is the JSON answer. Errors → `E-BENCH-01`.                        |
| `backend/utils/peakMemory.js` | `watchPeakMemory(pid)` reads the OS peak counter of a running program every 200 ms (Windows `PeakWorkingSet64` via one PowerShell loop, Linux `/proc/<pid>/status` `VmHWM`); `await stop()` gives the peak in MB.                             |
| `backend/worker/evaluator.js` | `benchmarkFile(file)`: runs the benchmark while watching its RAM; `summarise()` turns the JSON into `metrics` — `tpsPrompt`, `tpsGen` (+ std), `peakRamMb`, `runs`, `unstable` (runs differ > 10 %), `settings` (threads, sizes, CPU, build). |
| `backend/worker/pipeline.js`  | New stage **BENCHMARKING** after the smoke tests, for every file that passed (F16 too, as the baseline). A failed benchmark is logged; the job continues.                                                                                     |
| `backend/cli.js`              | The result table shows prompt / generation speed, peak RAM and stability.                                                                                                                                                                     |

The metrics are saved on each variant by the worker, so Huzaifah's Results page
(`GET /api/jobs/:id/results`) shows real speed and RAM numbers and their change vs F16.

## WP-16 — Quality: perplexity, task accuracy, demo mode, F16 clean-up

| File                                 | What it does                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/worker/llamacpp.js`         | `perplexity(file, text, { chunks })` → `llama-perplexity -c 512 --chunks N` and reads "Final estimate: PPL = x +/- y"; `hellaswag(file, data, { tasks })` → `--hellaswag --hellaswag-tasks N` and reads the last line (accuracy + 95 % range). Only stderr goes to the job log. Errors → `E-EVAL-01`. |
| `backend/worker/evaluator.js`        | `DATASETS` (the two fixed test files + their SHA-256), `checkDatasets()` (missing / changed → `E-DATA-01`), `qualitySizes()` (100 chunks / 400 tasks; demo 10 / 100), `measureQuality()`, `addQuality()` (merges into the speed metrics).                                                             |
| `backend/worker/pipeline.js`         | New stage **EVALUATING** after BENCHMARKING for every file that passed; then the **F16 file is deleted** (`fileDeleted: true`, numbers kept). Missing datasets or one failed test never fail the job. Returns `demoMode`.                                                                             |
| `backend/worker/worker.js`           | Saves `demoMode` on the job.                                                                                                                                                                                                                                                                          |
| `backend/models/Job.js`              | New metrics: `perplexityStd`, `taskAccuracy`, `taskAccuracyMargin`, `taskName`; new variant field `fileDeleted`.                                                                                                                                                                                      |
| `backend/services/resultsService.js` | `taskAccuracy` added to the compared metrics, so the Results API shows accuracy and its change vs F16.                                                                                                                                                                                                |
| `scripts/fetch-datasets.js`          | `npm run fetch:datasets` (old name `fetch:wikitext` still works): downloads WikiText-2 + HellaSwag and checks both SHA-256 values.                                                                                                                                                                    |
| `backend/worker/fakePipeline.js`     | Fake jobs now also carry HellaSwag numbers, `fileDeleted` on F16 and `demoMode`.                                                                                                                                                                                                                      |
