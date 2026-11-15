# PocketPrune — Build Prompt for an AI Coding Agent (Claude Code / Antigravity)

> **How to use this file**
> - **Claude Code:** save this file in the repository root as `CLAUDE.md` (read automatically every session).
> - **Antigravity or another agent:** keep it in the repo as `AGENTS.md` and paste it (or tell the agent to read it) at the start of a session.
> - Put these in `docs/`: `PocketPrune_SRS.docx`/`.pdf` and `PocketPrune_Implementation_Roadmap.pdf` (reference only).
> - Start each session with one line, e.g. **"Continue with WP-06 from CLAUDE.md."**

---

## 0. Your role and the golden rules

You are the implementation assistant **and guide** for **PocketPrune – Edge LLM Compression & Deployment Toolkit**, a BSCS Final Year Project (Lahore Garrison University) by **Huzaifah Saleem** and **Sibghatullah**, supervised by Ms. Hafsa Tahir and co-supervised by Ms. Unaisa Batool.

The students have **no prior experience with model compression**. Keep the work understandable, but the result must still look and feel like a solid FYP: a working pipeline, real measurements, a clear recommendation, a clean website and later an app.

**Rule 1 — Simple, explainable code.**
- Use **JavaScript** (`.js`) and **JSX** (`.jsx`). Use TypeScript (`.ts`/`.tsx`) **only if something really can't be done well in JS** — say why first.
- **Backend files stay especially simple:** short controller functions, one job per file, plain functions, `async/await`, no classes or patterns unless they clearly help. A classmate should understand any backend file in a few minutes.
- Add a library when it genuinely makes the code simpler or better (e.g. Redux Toolkit if shared state grows, a UI kit, a chart library) — mention why in the PR. Avoid heavy architecture that doesn't fit a 2-person FYP (microservices, GraphQL, Redis, Kubernetes).
- Comments explain *why*. Every file starts with a short header (what it does, SRS requirements, owner).

**Rule 2 — Teach as you go.** Before a work package that introduces a new idea (GGUF, quantization levels, perplexity, benchmarking, recommendation rules, JWT, polling…), explain it in simple words in chat and add it to `docs/LEARNING_NOTES.md`. After finishing, explain what was built so the owner can present it in the viva.

**Rule 3 — GitHub history is graded (~20 marks), and it must stay simple.** Each member has a personal branch (`huzaifah`, `sibghatullah`). A WP is built on a small WP branch → PR into the personal branch → when ready, PR personal branch → `main`, reviewed by the other member (Section 11). **2–3 short commits per WP** with plain captions like `WP-08: add preflight checks`. Never push to `main` directly, and never build several work packages in one PR.

**Rule 5 — Secrets stay local.** Anything secret (MongoDB Atlas string, HF token, JWT secret, passwords, API keys) goes **only** into the local `.env` file, which is git-ignored. Never write real secrets into code, docs, `.env.example`, commit messages, PR text or issues.

**Rule 4 — Document as you go.** Anyone opening the project must be able to see what was done, how it works and what's left (Section 10).

**Deadline that drives the plan:** about **40 % of the project must be demonstrated on 7 December 2026** (mid-term). Phases 1 and 2 (WP-00 to WP-13) are exactly 40 % by the weights in Section 12, and are planned for weeks 1–4. Keep both teammates in sync (Section 12.2) so neither blocks the other.

**Current scope: backend + website.** The mobile app spec is in Section 13 — **do not start it until the user explicitly says "start the mobile app"**. Build the API and the website theme so the app can reuse them later.

---

## 1. What PocketPrune does

A website (and later a mobile app) that takes a small open-source language model from Hugging Face and, in the background:

1. runs **preflight checks** (model in catalog, disk space, RAM, licence accepted, tool version),
2. **downloads** the model (safetensors only, pinned revision),
3. **converts** it to an F16 GGUF file with llama.cpp,
4. **quantizes** it to **Q5_K_M** and **Q4_K_M** (Q8_0 optional),
5. **smoke-tests** each file (load it and generate a few words),
6. **benchmarks** each file (size, prompt speed, generation speed, peak RAM) and measures **perplexity** on a fixed WikiText-2 text,
7. **recommends** the best file for the user's device with simple, explainable rules,
8. shows **live progress**, a **comparison table and charts**, **history** and **downloads**.

It does **not** invent a new compression method; it automates a known route (llama.cpp + GGUF), catches problems early and reports measured trade-offs honestly.
**Out of scope:** uploading any model, GPTQ, AWQ, pruning, GPU clusters, training.

---

## 2. Team and ownership

| Member | Owns | Reviews PRs of |
| --- | --- | --- |
| **Huzaifah Saleem** (H) | Backend API (models, controllers, routes, auth), website, design theme, mobile app screens (later) | Sibghatullah |
| **Sibghatullah** (S) | llama.cpp setup, catalog, worker and pipeline, evaluation, recommender, storage clean-up, Docker, mobile job/progress screens and APK build (later) | Huzaifah |

So commits show the real author, **each member works on their own computer, with their own Git name/email and GitHub login**, on the WPs they own. At the start of each session check:
```bash
git config user.name      # the member's real name
git config user.email     # matches their GitHub account
```
If it's wrong, stop and help fix it before any commit.

### 2.1 Machines — who needs what
| Machine | Who | Operating system | Runs |
| --- | --- | --- | --- |
| **Model machine** (also the reference machine for all measurements in the SRS) | Sibghatullah | **Windows 11** (native; decided 14 Nov 2026 — Linux also works) | llama.cpp, the worker, real compressions and benchmarks; also the API + website when needed |
| **Web machine** | Huzaifah | **Windows** — no llama.cpp needed | Node.js, the Express API, the React website, later the Expo app |

- **Shared development database:** one free **MongoDB Atlas M0** cluster. Both laptops put the same `MONGO_URI` in their `.env`. A job created from Huzaifah's website is stored in Atlas; when Sibghatullah's worker is running, it picks the job up and writes real results back, which then appear on Huzaifah's website. (GGUF files stay on the model machine, so test file downloads there.) Either member can still use a local MongoDB when working alone.
- **Cross-platform rule:** everything Huzaifah runs must work on Windows — npm scripts use `concurrently`/`cross-env` (no bash commands), file paths use `path.join`, no Linux-only tools in the API or website. Setup scripts are Node (`scripts/setup-llamacpp.js`), not bash, so they run on Windows and Linux.
- **Final demo:** everything runs on the model machine (or the optional hosted server).

---

## 3. Tech stack (MERN + what the project needs)

| Part | Choice | Notes |
| --- | --- | --- |
| Database | **MongoDB** + **Mongoose** | |
| Backend | **Node.js 20** + **Express**, ES modules (`import`) | Simple controllers/routes like the team's last project |
| Frontend | **React** with **Vite** (JSX), **React Router**, **axios**, **Recharts** (charts) | Styling approach is open (Section 9). Redux Toolkit / Context as needed |
| Auth | **bcryptjs** + **jsonwebtoken**, **express-rate-limit** on login | |
| Logging | **morgan** | |
| Background jobs | A **separate Node process** `backend/worker/worker.js` that picks the oldest `QUEUED` job from MongoDB | No Redis needed |
| Model tools | **llama.cpp** at one pinned release tag (**b12376**): official Windows CPU build; built from source on Linux | `npm run setup:llamacpp` |
| Python (tool only) | Python venv inside the llama.cpp folder — runs `convert_hf_to_gguf.py` and `hf download` | We write no Python |
| Process RAM | **pidusage** | |
| Dev tools | **nodemon**, **concurrently**, **cross-env**, **dotenv** | Scripts must run on Windows and Linux |
| Tests | **Vitest** + **supertest** + **mongodb-memory-server** | |
| Lint/format | ESLint + Prettier | |
| CI | GitHub Actions | |
| Operating systems | Both machines: Windows 11 (code stays cross-platform; CI runs on Linux) | See 2.1 |
| Mobile (later) | **Expo** (React Native, JavaScript) | Section 13 |

---

## 4. Project structure

```text
pocketprune/
├── package.json               # Root scripts: install-all, dev, seed, test, build
├── README.md                  # What it is + install + run
├── CLAUDE.md / AGENTS.md      # This file
├── .env.example               # All settings with comments: MONGO_URI (Atlas or local), JWT_SECRET, LLAMA_CPP_DIR, DEMO_MODE, FAKE_PIPELINE (temporary)…
├── .gitignore                 # node_modules, .env, data/, dist/
│
├── docs/
│   ├── PROJECT_STATUS.md      # ⭐ Done / in progress / left (update every session)
│   ├── DEV_LOG.md             # ⭐ Dated entries: what changed, decisions, next step
│   ├── HOW_IT_WORKS.md        # ⭐ Plain-English walkthrough, file by file
│   ├── LEARNING_NOTES.md      # ⭐ Simple explanations of the concepts (quantization, GGUF, perplexity…)
│   ├── GIT_GUIDE.md           # ⭐ Team Git/GitHub steps
│   ├── progress.json          # ⭐ Every WP with weight %, owner, status, dependencies (source for `npm run progress`)
│   ├── API.md                 # Every endpoint with example request/response
│   ├── catalog-trials.md      # Manual model test results
│   └── release-notes/         # One file per milestone
│
├── scripts/                   # setup-llamacpp.js, fetch-wikitext.js, validate-catalog.js, regression.js,
│                              #   progress.js — prints % done, per phase, per person, and who is waiting on whom
│
├── backend/
│   ├── config/                # db.js, settings.js
│   ├── models/                # User.js, CatalogModel.js, DeviceProfile.js, Job.js, JobEvent.js
│   ├── controllers/           # auth, catalog, profile, job, result, artifact, admin, system
│   ├── routes/                # one file per controller
│   ├── middleware/            # authMiddleware.js, adminMiddleware.js, errorHandler.js
│   ├── services/              # preflightService.js, recommender.js, exportService.js
│   ├── worker/                # worker.js, pipeline.js, llamacpp.js, downloader.js, evaluator.js, storage.js
│   │                          #   + fakePipeline.js — ⏳ TEMPORARY, removed in WP-20 (see 7.7)
│   ├── utils/                 # errors.js, runCommand.js, systemInfo.js, fileHash.js
│   ├── tests/
│   ├── cli.js                 # Run the pipeline from the terminal
│   ├── seed.js                # Catalog models + demo/admin users
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── theme/             # ⭐ theme.js — colours, fonts, spacing (shared with the app later)
│   │   ├── components/        # Small reusable UI pieces (see Section 9)
│   │   ├── pages/             # Login, Register, Catalog, Profiles, JobSetup, JobProgress, Results, History, Downloads, Help
│   │   ├── admin/             # AdminCatalog, AdminStorage, AdminJobs
│   │   ├── context/           # AuthContext.jsx (Redux Toolkit store/ only if state grows)
│   │   ├── services/api.js    # One axios instance + one function per endpoint
│   │   ├── utils/format.js    # MB, tok/s, %, dates
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── mobile/                    # ⛔ Created only when the user says "start the mobile app"
├── deploy/                    # Docker + optional hosting files
└── data/                      # ⛔ git-ignored: models/, artifacts/, wikitext/
```

Root scripts: `npm run install-all`, `npm run dev` (API + website — works on Windows), `npm run dev:worker` (the worker), `npm run dev:all` (all three, model machine), `npm run seed`, `npm test`, `npm run build`, `npm run progress`.

---

## 5. Database (Mongoose)

| Model | Fields |
| --- | --- |
| **User** | email (unique), passwordHash, role (`user`/`admin`) |
| **CatalogModel** | hfRepoId (unique), revision, displayName, paramsBillion, license, gated, isActive, isDemo, f16SizeMb, lastValidatedAt |
| **DeviceProfile** | user, name, ramMb, freeDiskMb, cpuThreads, preference (`quality`/`speed`/`smallest`/`balanced`) |
| **Job** | user, model, profile, quantLevels, status, stage, progressPct, demoMode, llamaCppRef, errorCode, errorMessage, cancelRequested, heartbeatAt, startedAt, finishedAt, **variants[]**, **recommendation**, `fake` (⏳ temporary, removed in WP-20) |
| variant (inside Job) | level, filePath, fileSizeMb, sha256, smokePassed, smokeOutput, durationSec, expiresAt, pinned, **metrics** { tpsPrompt, tpsGen, peakRamMb, perplexity, runs, unstable, settings } |
| recommendation (inside Job) | chosenLevel, baselineSmallest, baselineLargest, ruleFired, explanation, qualityRisk |
| **JobEvent** | job, stage, level (`info`/`warn`/`error`), message |

Use `timestamps: true`. **Status flow:** `QUEUED → DOWNLOADING → CONVERTING → QUANTIZING → VALIDATING → BENCHMARKING → EVALUATING → RECOMMENDING → COMPLETED` (or `FAILED` / `CANCELLED`).

**How the worker picks a job:**
```js
// Take the oldest queued job in one atomic step, so it can never be picked twice.
const job = await Job.findOneAndUpdate(
  { status: 'QUEUED' },
  { status: 'DOWNLOADING', startedAt: new Date(), heartbeatAt: new Date() },
  { sort: { createdAt: 1 }, new: true }
);
```
Check every 3 s, one job at a time, heartbeat every 10 s, check `cancelRequested` between stages. On start, jobs stuck "running" with an old heartbeat become `FAILED` (`E-WORKER-01`).

---

## 6. API (Express, base `/api`)

Errors always: `{ "code": "E-DISK-01", "message": "Not enough free disk space.", "hint": "Free 4 GB or choose fewer levels." }`. Validate inputs with simple checks in controllers (a small validation library is fine if it keeps code shorter).

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | account; login returns `{ token, user }` | public |
| GET | `/api/catalog`, `/api/catalog/:id` | catalog | user |
| GET/POST/PUT/DELETE | `/api/profiles[/:id]` | own device profiles | user |
| GET | `/api/system/host-profile` | this server's RAM/disk/threads | user |
| POST | `/api/jobs/preflight` | `{ modelId, levels, profileId }` → `{ passed, checks[] }` | user |
| POST | `/api/jobs` | + `licenseAccepted` → `202 { jobId }` | user |
| GET | `/api/jobs`, `/api/jobs/:id` | list / status + last 50 events | user |
| POST | `/api/jobs/:id/cancel`, `/api/jobs/:id/retry` | | user |
| GET | `/api/jobs/:id/results` | variants, metrics, change vs F16, recommendation | user |
| POST | `/api/jobs/:id/recommend` | `{ profileId }` → recalculated recommendation | user |
| GET | `/api/jobs/:id/export?format=csv\|json` | results with settings | user |
| GET | `/api/artifacts/:jobId/:level/download` | GGUF file (`res.download`) | user |
| * | `/api/admin/...` | catalog admin, storage, all jobs | admin |
| GET | `/api/system/health` | `{ status, llamaCppRef, demoMode }` | public |

Keep `docs/API.md` in sync. **Before the login WP:** `protect` sets `req.user` to the seeded demo user; the login WP replaces it with the real JWT check without touching routes.

---

## 7. The pipeline (worker)

### 7.1 Commands
llama.cpp commands are built **only** in `worker/llamacpp.js` and run via `utils/runCommand.js` with `spawn(command, argsArray)` — **never** `shell: true` or string concatenation. Every command has a timeout; output lines become `JobEvent`s. Use `-ngl 0` (CPU only) so results are comparable. Check flags with `--help` of the pinned build; record the tag in `README.md`.
```bash
hf download <repo> --revision <commit> --include "*.safetensors" "*.json" "tokenizer*" --local-dir <dir>
<venv>/Scripts/python.exe convert_hf_to_gguf.py <dir> --outfile <name>-F16.gguf --outtype f16   # <venv>/bin/python on Linux
llama-quantize <name>-F16.gguf <name>-Q4_K_M.gguf Q4_K_M
llama-completion -m <file> -p "<fixed prompt>" -n 32 --seed 42 --temp 0 -ngl 0 -no-cnv   # smoke test (llama-cli is chat-only in b12376)
llama-bench -m <file> -p 512 -n 128 -r 3 -t <threads> -ngl 0 -o json
llama-perplexity -m <file> -f data/wikitext/wiki.test.raw -c 512 --chunks 100 -t <threads> -ngl 0
```
(If the pinned version uses `huggingface-cli download` or renamed a flag, adapt and note it in the PR.)

### 7.2 Stage rules
| Stage | Rule |
| --- | --- |
| Preflight | model active; levels only from {Q5_K_M, Q4_K_M, Q8_0}; free disk ≥ 3 × F16 + quantized sizes + 2 GB (less if cached); free RAM ≥ 1.2 × F16; licence accepted; gated → HF token set; llama.cpp found at pinned tag; < 2 active jobs |
| Download | safetensors + tokenizer + config only (never `.bin`); pinned revision; reuse if present |
| Convert | F16 GGUF; save size, SHA-256, time |
| Quantize | each level; one failure doesn't stop the others |
| Smoke test | fixed prompt, seed 42, temp 0, 32 tokens; valid if it exits normally in 120 s and prints text |
| Benchmark | llama-bench JSON, 3 runs averaged; `unstable` if > 10 % variation; peak RAM via pidusage every 100 ms |
| Perplexity | fixed local WikiText-2 (save SHA-256), context 512, 100 chunks (10 in demo mode) |
| Clean-up | delete half-written files on failure/cancel; delete the downloaded snapshot after conversion; **delete the F16 file once evaluation is finished** (its metrics stay in the database); stop if free disk < 2 GB |

Time limits in `.env`: download 60 min, convert 30, quantize 20/level, smoke 2, bench 15, perplexity 30.

### 7.3 Recommender (`services/recommender.js`, plain functions, one test per rule)
Per valid file: size **S**, peak RAM **M**, generation speed **T**, perplexity **P**; F16 perplexity **P0**; device RAM **R**, free disk **D**, preference.
1. **Fits:** M ≤ 75 % of R and S ≤ D − 2 GB.
2. **Quality guard:** loss = (P − P0)/P0; drop loss > 10 % unless nothing else fits (`qualityRisk`).
3. **Preference:** quality → lowest P; speed → highest T; smallest → smallest S; balanced → best 0.4·speed + 0.4·quality + 0.2·size (each scaled 0–1).
4. **Tie:** smaller file. 5. **Nothing fits:** say what RAM/disk is needed. 6. **Baselines:** smallest-that-fits and largest-that-fits.
Return `ruleFired` + a plain-English `explanation` naming the machine. Never say "guaranteed".

### 7.4 Demo mode
`DEMO_MODE=true`: perplexity 10 chunks, bench `-p 128 -n 32`, demo models downloaded in advance; save `demoMode` in results; "Demo mode" badge in the UI.

### 7.5 Catalog seed
- **Demo** (`isDemo`, ~2–3 min jobs): `HuggingFaceTB/SmolLM2-135M-Instruct`, `HuggingFaceTB/SmolLM2-360M-Instruct`, `Qwen/Qwen2.5-0.5B-Instruct`
- **Standard:** `TinyLlama/TinyLlama-1.1B-Chat-v1.0`, `Qwen/Qwen2.5-1.5B-Instruct`, `HuggingFaceTB/SmolLM2-1.7B-Instruct`, `meta-llama/Llama-3.2-1B-Instruct` (gated — optional)
- **Stretch:** `microsoft/Phi-3.5-mini-instruct`
Pinned commit hash for each; reject > 4 B parameters.

### 7.6 Error codes (`utils/errors.js`, explained on the Help page)
`E-CAT-01` model not in catalog · `E-LVL-01` unsupported level · `E-DISK-01` not enough disk · `E-RAM-01` not enough RAM · `E-LIC-01` licence not accepted · `E-HF-01` gated model needs a token · `E-HF-02` download failed · `E-TOOL-01` llama.cpp missing/wrong version · `E-CONV-01` conversion failed · `E-QNT-01` quantization failed · `E-VAL-01` no file passed the smoke test · `E-TIME-01` stage too slow · `E-WORKER-01` worker restarted · `E-AUTH-01` wrong email or password · `E-LIMIT-01` too many active jobs · `E-QUOTA-01` storage limit reached.

### 7.7 Fake pipeline — ⏳ temporary helper (WP-06 → removed in WP-20)
Purpose: let Huzaifah build and test the Job Setup, Progress, Results and Downloads pages on Windows **without llama.cpp**, and without waiting for real jobs.
- `backend/worker/fakePipeline.js` exports the **same function as `pipeline.js`** (`runPipeline(job)`), so the worker can call either one.
- It walks through the same stages, waiting 2–3 seconds per stage, writes normal `JobEvent`s and progress, and saves variants with **realistic numbers copied from Sibghatullah's hand trial in WP-02** (sizes, tok/s, RAM, perplexity) plus a simple recommendation. It creates small placeholder files instead of real GGUFs.
- The worker uses it only when `.env` has `FAKE_PIPELINE=true`. Every job it produces is saved with `fake: true`, and the website shows a clear **"FAKE DATA"** badge on those jobs so nobody mistakes them for real results.
- Automated tests do **not** use it (they mock `runCommand`), so removing it later breaks nothing.
- **Removal (WP-20):** once the real pipeline, worker, evaluation and recommender are all merged (end of Phase 3), Sibghatullah deletes `fakePipeline.js`, the `FAKE_PIPELINE` setting, the `fake` field and the "FAKE DATA" badge, and updates the docs. From then on Huzaifah sees real jobs through the shared Atlas database while the worker runs on the model machine. Record the removal in `DEV_LOG.md`.

### 7.8 Where model files live, and how disk space is kept under control
- **Model files are never stored in MongoDB.** The database keeps only each file's path, size, SHA-256 and metrics (a few KB per job). The `.gguf` files live on the server disk in `data/artifacts/` and are streamed with `res.download` (resumable).
- **Typical sizes (Q4_K_M):** SmolLM2-135M ≈ 0.1 GB, SmolLM2-360M ≈ 0.25 GB, Qwen2.5-0.5B ≈ 0.4 GB, 1–1.7 B models ≈ 0.7–1.1 GB.
- **Space rules:** (1) delete the downloaded snapshot after conversion and the F16 file after evaluation; (2) **reuse identical files** — if a valid, unexpired file already exists for the same model, revision, level and llama.cpp version, link it to the new job instead of compressing again (saves minutes and disk); (3) quantized files expire after **7 days** unless an admin pins them; (4) **per-user storage limit** (default 3 GB, `USER_STORAGE_LIMIT_MB`), checked in preflight (`E-QUOTA-01`) and shown on the Downloads page.
- **Mobile app:** never downloads model files; it links to the website's Downloads page.
- **Could-have (only after M4):** a "Publish to Hugging Face" button that uploads a file to the *user's own* Hugging Face account with their token — only for models whose licence allows redistribution (Apache-2.0, MIT).

---

## 8. Website pages

| Page | Contents |
| --- | --- |
| Login / Register | simple forms, error under each field |
| Catalog | model cards: name, size, licence, "Demo" badge, "Start job" |
| Profiles | list + form; "Use this computer's values" |
| Job Setup | levels (with expected sizes), profile → **Run preflight** checklist → licence checkbox → **Submit** |
| Job Progress | stage stepper, progress bar, elapsed time, latest log lines, **Cancel**; refreshes every 2 s |
| Results | recommendation card (rule + explanation), comparison table (absolute and % vs F16), 3 bar charts (size, speed, RAM), profile dropdown, Export CSV/JSON, Demo badge, machine name |
| History · Downloads · Help | past jobs + Retry · files with size/SHA-256/expiry · concepts, metrics, rules, error codes |
| Admin | catalog add/edit/disable, storage usage, all jobs |

Every error shows what failed, why, how to fix, and its code. Always show units.

---

## 9. Design system — looks good, stays simple, copies to the app

The website should look clean and modern, but **not complex**: the same look must be easy to rebuild in React Native later.

**Styling approach is open** — plain CSS / CSS modules, Tailwind, React-Bootstrap, Chakra or MUI are all fine. Pick one in WP-07, explain why in the PR, and stick to it. Whatever you pick:

1. **One theme file is the source of truth:** `frontend/src/theme/theme.js`
   ```js
   // theme.js — the single source of colours, fonts and spacing.
   // The mobile app copies this file unchanged, so web and app look the same.
   export const theme = {
     colors: {
       primary: '#2F5DE1', primaryText: '#FFFFFF',
       background: '#F7F8FA', surface: '#FFFFFF', border: '#E3E6EB',
       text: '#1B1F24', textMuted: '#5F6B7A',
       success: '#1E9E5A', warning: '#C98A00', danger: '#D2393C', info: '#2F5DE1',
       status: { QUEUED: '#8A94A6', RUNNING: '#2F5DE1', COMPLETED: '#1E9E5A', FAILED: '#D2393C', CANCELLED: '#8A94A6' },
     },
     font: { family: 'Inter, system-ui, sans-serif', size: { sm: 13, md: 15, lg: 18, xl: 24 }, weight: { regular: 400, bold: 600 } },
     space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
     radius: { sm: 6, md: 10, lg: 16 },
   };
   ```
   `main.jsx` turns these values into CSS variables (`--color-primary` …) so CSS can use them. **Never hard-code a colour or font size in a component.**
2. **A small set of reusable components** in `frontend/src/components/`, which the app will copy with the same names and props: `Button`, `Card`, `Badge`, `StatusBadge`, `ProgressBar`, `StageStepper`, `MetricsTable`, `MetricsChart`, `PageHeader`, `EmptyState`, `ErrorAlert`, `Loader`.
3. **Portable visual rules:** flat cards with soft borders/shadows; one font; simple icons (lucide); no effects that are hard in React Native (backdrop blur, complex gradients, hover-only information, fancy CSS grid art). Anything shown on hover must also be reachable by click/tap.
4. **Layouts that also work narrow:** pages are built from stacked cards so they translate naturally to a phone screen.
5. Keep animations minimal (simple fades, progress bars).

---

## 10. Documentation (update at the end of EVERY session)

0. **`docs/progress.json`** — set the WP's status (`not-started` / `in-progress` / `in-review` / `merged`) and run `npm run progress`; copy its summary to the top of PROJECT_STATUS.md (Section 12.1).
1. **`docs/PROJECT_STATUS.md`** — table of all WPs: `| WP | Title | Owner | Status | Branch / PR | Notes |` + "What works now", "What's next", "Known issues", "How to run what exists".
2. **`docs/DEV_LOG.md`** — dated entry: who, which WP, what was built, files touched, decisions and why, problems, next step.
3. **`docs/HOW_IT_WORKS.md`** — plain-English explanation of each new part.
4. **`docs/LEARNING_NOTES.md`** — the concepts in simple words with small examples.
5. **`docs/API.md`**, **`README.md`**, **`CHANGELOG.md`** — kept correct.
6. Code comments and file headers.

At the end of every session, tell the user in 5–10 simple lines what was built and how it works.

---

## 11. Git & GitHub — step by step, by both teammates

### 11.1 One-time setup (WP-00 — walk the user through it)
1. Create the GitHub repo (public is simplest — branch protection is free).
2. Add the other member as collaborator.
3. Labels: `backend`, `worker`, `frontend`, `mobile`, `docs`, `test`, `bug`, `phase-1` … `phase-5`.
4. Milestones: `M1 Setup + First Compression`, `M2 Website Job End-to-End`, `M3 Metrics + Recommender`, `M4 Complete Product`, `M5 Final`.
5. One **issue per WP** from Section 12 (assignee = owner, label, milestone).
6. Protect `main`: require PR + 1 approval + passing checks; block force-push. (Private repo: may need GitHub Pro, free with the Student Developer Pack; otherwise follow the rule by hand.)
7. Allow **"Create a merge commit"** so branches stay visible in history.
Write this in `docs/GIT_GUIDE.md`.

### 11.2 Branches — simple and per person (agreed 12 Nov 2026)

```text
main                 ← finished, reviewed work only
├── huzaifah         ← Huzaifah's branch
│   └── wp08-preflight, wp10-jobs-api …   (one small branch per WP)
└── sibghatullah     ← Sibghatullah's branch
    └── wp02-llamacpp-setup, wp04-command-runner …
```

- **One WP = one small branch** off your personal branch, named `wpNN-short-name` (e.g. `wp02-llamacpp-setup`). The long names in the Section 12 tables are only descriptions.
- WP branch → **PR into your personal branch** (you may merge this one yourself).
- Personal branch → **PR into `main`**, reviewed by the other member, merged with **Create a merge commit**. Do this after each WP (or a couple of small ones) so the other person can build on it. A WP counts as `merged` in `progress.json` only when it is on `main`.
- **2–3 commits per WP**, plain captions: `WP-02: build llama.cpp`, `WP-02: hand compression notes`. No `feat(area):` prefixes, no long bodies.
- **Never generate future WPs early.** If the user asks to "do everything", do the next WP only.
- The reviewer leaves at least one real comment or approval note on every PR into `main`.
- Tag a release at each milestone: `v0.1.0-M1`, `v0.2.0-M2`, `v0.3.0-M3`, `v0.4.0-M4`, `v1.0.0`.
- No AI attribution lines (`Co-Authored-By`, "Generated with …") in commits, PRs or docs.

### 11.3 Show these Git boxes to the user every time
(Example for Sibghatullah; Huzaifah uses `huzaifah`.)

**▶ START of a WP** — update your branch from `main`, then branch off it
```bash
git checkout sibghatullah
git pull
git merge origin/main
git checkout -b wp02-llamacpp-setup
```

**▶ COMMIT** (a part works, tests pass) — 2–3 per WP
```bash
git add .
git status          # check: no .env, data/, model files
git commit -m "WP-02: build llama.cpp"
```

**▶ END of a WP**
```bash
npm test
git push -u origin wp02-llamacpp-setup
```
1. Open a PR **wp02-llamacpp-setup → sibghatullah**, merge it.
2. Open a PR **sibghatullah → main** (title `WP-02: llama.cpp setup`, body: what, how tested, `Closes #__`). Ask the other member to review and merge.

**▶ AFTER merge**
```bash
git checkout sibghatullah
git pull
git merge origin/main
git branch -d wp02-llamacpp-setup
```

**▶ MILESTONE** (after its last PR merges)
```bash
git checkout main && git pull
git tag -a v0.2.0-M2 -m "M2: first full job from the website"
git push origin v0.2.0-M2
```
Create a GitHub Release from `docs/release-notes/M2.md`; close the milestone.

**At the start of every session:** run `git status` and `git branch`, tell the user which branch they're on and whether anything is uncommitted.

### 11.4 Files created in WP-01
`.github/pull_request_template.md` (What / Why / `Closes #` / SRS requirements / How tested / Screenshots / Checklist), `.github/ISSUE_TEMPLATE/feature.md` + `bug.md`, `.github/workflows/ci.yml` (backend `npm test`, frontend `npm run build`; tests never need internet or llama.cpp — mock `runCommand`).

---

## 12. Work packages — build order

### 12.0 Why this order
The team is new to model compression, so the order is: **learn → prove compression works → connect it end to end → measure and recommend → complete the product → polish**.

1. **Learn and prove the risky part first (Phase 1).** Before any job pages, Sibghatullah compresses a tiny model by hand, then turns that into a command-line pipeline. If llama.cpp works on your machine, the rest of the project is normal web development. The mid-term demo then shows a *real* compression, not mock-ups.
2. **One thin path from the website, end to end (Phase 2).** Job Setup → preflight → job → worker → files → live progress, with plain pages. No charts, no login, no admin yet. A simple working path beats a polished half-path.
3. **Measure, compare, recommend (Phase 3).** This is what makes it an FYP rather than a wrapper: real numbers, a comparison against F16, explainable rules checked against baselines, and downloads of the files.
4. **Complete the product (Phase 4).** Login, history, cancel/retry, storage clean-up, admin, help, Docker — then the mobile app if you decide to build it.
5. **Prove and present it (Phase 5).** Tests, security check, usability test, optional hosting, guides.

**Must-have** (the core FYP): catalog, preflight, pipeline, worker, progress, metrics, perplexity, recommender, results, downloads.
**Should-have:** login, history, cancel/retry, storage clean-up and limits, admin, help, Docker, the mobile app (planned for weeks 15–18, started only when you say), tests, docs.
**Could-have (only when the rest is done):** free hosting, "Publish to Hugging Face", a "compare outputs" box (type a prompt, see F16 vs Q4 answers side by side), Q8_0 level, the gated Llama-3.2 model, Phi-3.5-mini.

### 12.1 Progress percentage — how much is done
Every WP has a **weight** (its share of the whole project). The weights add up to **100 %**; the project percentage is the sum of the weights of **merged** WPs only (work on a branch or in review doesn't count yet — this keeps the number honest).

| Phase | WPs | Weight | Cumulative | Target date |
| --- | --- | --- | --- | --- |
| 1 — Learn, set up, first compression | WP-00 – WP-07 | 25 % | 25 % | 22 Nov 2026 |
| 2 — First full job from the website | WP-08 – WP-13 | 15 % | **40 %** | **6 Dec 2026 (mid-term 7 Dec)** |
| 3 — Measure, compare, recommend | WP-14 – WP-20 | 22 % | 62 % | 17 Jan 2027 |
| 4 — Complete product + mobile app | WP-21 – WP-26, WP-M1 – WP-M4 | 24 % | 86 % | 14 Mar 2027 |
| 5 — Testing and delivery | WP-27 – WP-32 | 14 % | 100 % | 25 Apr 2027 |

`docs/progress.json` holds one entry per WP: `{ "id": "WP-06", "title": "CLI pipeline", "owner": "S", "weight": 5, "phase": 1, "week": "2–3", "needs": ["WP-04"], "status": "merged", "pr": 12 }`.
`scripts/progress.js` (≈ 40 lines, created in WP-01) reads it and prints:
```
PocketPrune progress: 31 % merged (in review: 3 %, in progress: 6 %)
Phase 1 ████████████████████ 25/25 %   Phase 2 ██████░░░░░░░░ 6/15 %   ...
Huzaifah: 16 %  ·  Sibghatullah: 15 %
Next 40 % checkpoint (7 Dec): 9 % to go — WP-10, WP-11, WP-12, WP-13
Waiting: WP-12 (H) needs WP-11 (S, in progress)
```

### 12.2 Keeping both teammates in sync
- **Before starting a WP**, check its **Needs** column in `progress.json`. If a needed WP is not merged, tell the user plainly, e.g.: *"WP-12 needs WP-11 (Sibghatullah's worker), which isn't merged yet. Meanwhile you can do WP-08 or polish WP-07. Tell Sibghatullah WP-11 is blocking you."*
- **After a WP is merged**, run `npm run progress` and tell the user: the new percentage, which WPs of the **other** member are now unblocked, and a ready-to-send message, e.g.: *"✅ WP-10 merged — project is now 34 %. This unblocks WP-12 for you and WP-11 can now be tested against the real jobs API. Message for Sibghatullah: 'Jobs API is on main — pull it and start WP-11.'"*
- **Phase gate:** when every WP of a phase is merged, announce it (*"Phase 2 complete — 40 % reached"*), remind the user to tag the release (Section 11.3), and list the first WP of the next phase for each member.
- **Weekly sync (Monday, 15 min):** both run `npm run progress`, agree on this week's WPs from the tables below, and move any blocked item.
- **If a teammate is behind** a target date, suggest the smallest step that unblocks the other (e.g. merge a minimal version first, improve later in a fix PR).

### 12.3 Work packages
H = Huzaifah, S = Sibghatullah. Week 1 = 9 Nov 2026. **%** = weight. **Needs** = WPs that must be merged first.

### Phase 1 — Learn, set up, first real compression (weeks 1–2, 9–22 Nov) → `v0.1.0-M1` = 25 %
| WP | Wk | % | Owner | Needs | Branch | What to build | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WP-00 | 1 | 1 | Both | — | — | GitHub setup (11.1); agree on machines (2.1); shared MongoDB Atlas database | Both can open PRs and reach Atlas |
| WP-01 | 1 | 3 | H | WP-00 | `chore/wp01-project-setup` | Folders, root scripts (`dev`, `dev:worker`, `dev:all`, `progress`), skeletons that start, `.env.example`, README (Windows + WSL2), all `docs/` files incl. `progress.json` + `scripts/progress.js`, `.github/` files, CI | `npm run dev` and `npm run progress` work on Windows; CI green |
| WP-02 | 1 | 4 | S | WP-00 | `chore/wp02-llamacpp-setup` | Model machine (Windows 11), `setup-llamacpp.js` (pinned tag + venv), compress SmolLM2-135M **by hand**, every command explained in `LEARNING_NOTES.md` | A hand-made Q4_K_M file generates text |
| WP-03 | 1–2 | 3 | H | WP-01 | `feat/wp03-backend-core` | `db.js`, `settings.js`, Mongoose models, `errors.js`, `errorHandler.js`, demo-user `protect`, health + host-profile, first tests | Tests pass |
| WP-04 | 2 | 3 | S | WP-01, WP-02 | `feat/wp04-command-runner` | `runCommand.js`, `llamacpp.js`, `downloader.js`, mocked tests | Each command runs from Node |
| WP-05 | 2 | 3 | H | WP-03 | `feat/wp05-catalog-profiles-api` | Catalog + profile API, `seed.js` with demo models (revisions from WP-02), tests, `docs/API.md` | `/api/catalog`, `/api/profiles` tested |
| WP-06 | 2–3 | 5 | S | WP-04 | `feat/wp06-cli-pipeline` | `pipeline.js` (download → F16 → quantize → smoke test) + `cli.js`; **`fakePipeline.js`** (7.7) | CLI makes 2 valid files for SmolLM2-135M; fake pipeline runs on Windows |
| WP-07 | 2–3 | 3 | H | WP-01 | `feat/wp07-website-foundation` | Styling choice, `theme.js`, base components, layout/navbar, Catalog + Profiles pages, Job Setup form | Website shows catalog and profiles |

### Phase 2 — First full job from the website (weeks 3–4, 23 Nov – 6 Dec) → `v0.2.0-M2` = **40 %**
| WP | Wk | % | Owner | Needs | Branch | What to build | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WP-08 | 3 | 3 | H | WP-05, WP-07 | `feat/wp08-preflight` | `preflightService.js`, `POST /api/jobs/preflight`, Job Setup shows the real checklist | Test per check |
| WP-09 | 3 | 2 | S | WP-06 | `docs/wp09-catalog-trials` | Other catalog models, `catalog-trials.md`, `validate-catalog.js`, `fetch-wikitext.js`, 4 B limit, update `seed.js` | Every model marked works/doesn't |
| WP-10 | 3–4 | 3 | H | WP-08 | `feat/wp10-jobs-api` | `POST /api/jobs` (202), list, status + events, 2-job limit | API tests pass |
| WP-11 | 4 | 3 | S | WP-06, WP-10 | `feat/wp11-worker` | `worker.js` (pick job, heartbeat, cancel flag, recovery) → `pipeline.js`, or `fakePipeline.js` when `FAKE_PIPELINE=true`; `npm run dev:worker` | A website job runs in the background |
| WP-12 | 4 | 2 | H | WP-10, WP-11 | `feat/wp12-progress-page` | Job Progress page: stepper, bar, log panel, error code, "FAKE DATA" badge; refresh every 2 s | Live progress |
| WP-13 | 4 | 2 | S | WP-11 | `feat/wp13-pipeline-hardening` | Time limits, clean-up, 2 GB disk reserve, `regression.js`, `docs/regression-M2.md` | Demo models pass; a stopped job leaves no junk |

**Mid-term (7 Dec) demo at 40 %:** pick SmolLM2-135M on the website → preflight checklist → submit → live progress while the real worker compresses it → two valid files; plus the SRS and slides. If time runs short, WP-13 is the one to finish last (the demo works without it at 38 %).

### Phase 3 — Measure, compare, recommend (weeks 5–10, 7 Dec – 17 Jan) → `v0.3.0-M3` = 62 %
| WP | Wk | % | Owner | Needs | Branch | What to build | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WP-14 | 5–6 | 4 | S | WP-13 | `feat/wp14-benchmarking` | `evaluator.js`: size, llama-bench JSON, 3 runs, unstable flag, peak RAM | Metrics saved for each file |
| WP-15 | 5–6 | 3 | H | WP-12 | `feat/wp15-results-table` | `GET /api/jobs/:id/results`, Results comparison table | Real numbers on the website |
| WP-16 | 7 | 3 | S | WP-14 | `feat/wp16-perplexity-demo-mode` | Perplexity, change vs F16, saved settings, demo mode, **delete F16 after evaluation** | All metrics present; no F16 left behind |
| WP-17 | 7 | 3 | H | WP-15 | `feat/wp17-charts-downloads` | 3 charts, Demo badge, machine name; Downloads page + download endpoint | Charts render; a GGUF downloads |
| WP-18 | 8–9 | 4 | S | WP-16 | `feat/wp18-recommender` | `recommender.js` rules 1–6 + explanation + tests, called by the pipeline | All rule tests pass |
| WP-19 | 8–9 | 3 | H | WP-17, WP-18 | `feat/wp19-recommendation-export` | Recommendation card, `POST /recommend`, profile dropdown, CSV/JSON export | Profile change updates recommendation |
| WP-20 | 10 | 2 | S | WP-18, WP-19 | `chore/wp20-benchmark-report-remove-fake` | Full catalog run, repeatability check, `benchmark-report.md`; **remove the fake pipeline** (7.7) | Report done; no fake code left |

### Phase 4 — Complete product + mobile app (weeks 11–18, 18 Jan – 14 Mar) → `v0.4.0-M4` = 86 %
| WP | Wk | % | Owner | Needs | Branch | What to build | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WP-21 | 11 | 3 | H | WP-20 | `feat/wp21-auth` | Register/login, real `protect`, admin guard, own data only, Login/Register pages | 401 without token; other user's job → 404 |
| WP-22 | 11–12 | 3 | S | WP-20 | `feat/wp22-cancel-retry` | Stop the running command + clean up; retry reusing downloads | Tests pass |
| WP-23 | 12–13 | 3 | H | WP-21, WP-22 | `feat/wp23-history` | History page with filters, Cancel/Retry buttons | Cancel/retry from the website |
| WP-24 | 13 | 2 | S | WP-22 | `feat/wp24-storage` | `storage.js`: 7-day expiry + pin, **reuse identical files**, per-user usage calculation, catalog validation job | Old files removed; a repeated job reuses files |
| WP-25 | 14 | 3 | H | WP-21, WP-24 | `feat/wp25-admin-help-quota` | Admin pages + routes, Help page, **per-user storage limit** in preflight (`E-QUOTA-01`) and usage on Downloads | Admin blocked for normal users; limit enforced |
| WP-26 | 14–15 | 2 | S | WP-24 | `chore/wp26-docker-performance` | `docker-compose.yml`, integration check, load test, `performance.md` | `docker compose up` works offline |
| WP-M1 – WP-M4 | 15–18 | 8 | H + S | WP-21 | see Section 13 | Mobile app (starts only when the user says so; this is its planned slot) | APK installs and runs a job |

### Phase 5 — Testing and delivery (weeks 19–24, 15 Mar – 25 Apr) → `v1.0.0` = 100 %
| WP | Wk | % | Owner | Needs | Branch | What to build | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WP-27 | 19 | 3 | S | WP-26 | `test/wp27-worker-tests` | Pipeline/worker failure tests, coverage | Coverage in CI |
| WP-28 | 19 | 3 | H | WP-25 | `test/wp28-api-tests-security` | API failure tests, `docs/security.md` | Backend coverage ≥ 60 % |
| WP-29 | 20–21 | 2 | H | WP-25 | `test/wp29-usability` | SUS test with 5+ classmates, fixes, `usability.md` | Results documented |
| WP-30 | 20–21 | 2 | S | WP-26 | `chore/wp30-hosting-or-offline` | Optional free hosting, or polished offline demo | Demo setup works end to end |
| WP-31 | 22 | 2 | H | WP-29 | `docs/wp31-user-guide` | User guide with screenshots, demo script | In `docs/` |
| WP-32 | 22 | 2 | S | WP-30 | `docs/wp32-admin-guide` | Install/admin guide, benchmark methodology | In `docs/` |
| Fixes | 19–24 | — | Either | — | `fix/<area>-wk<nn>` | Batched small fixes; weeks 23–24: rehearsal, final report, slides, tag `v1.0.0` | Reviewed and merged |

Weights per person: Huzaifah ≈ 50 %, Sibghatullah ≈ 50 % (mobile split evenly).

---

## 13. Mobile app — ⛔ DO NOT START until the user says "start the mobile app"

When asked, build a companion app that reuses the backend API and the website's theme.

**Stack:** Expo (managed workflow, JavaScript), React Navigation (bottom tabs + stack), axios, `expo-secure-store` for the token, `react-native-svg` only if charts need it (simple bars can be plain `View`s).

**Structure**
```text
mobile/
├── App.js
├── app.json / eas.json
├── src/
│   ├── theme/theme.js        # COPIED unchanged from frontend/src/theme/theme.js
│   ├── components/           # Same names/props as the web: Button, Card, Badge, StatusBadge, ProgressBar, StageStepper, MetricsTable, ErrorAlert, Loader
│   ├── screens/              # Login, Register, Catalog, NewJob, Progress, Results, History, Settings
│   ├── navigation/           # Tabs: Catalog, History, Settings; stack for NewJob → Progress → Results
│   ├── context/AuthContext.js
│   ├── services/api.js       # Same endpoints as the web api.js
│   └── utils/format.js       # Copied from the web
└── README.md
```

**Screens:** Login/Register · Catalog · New Job (levels, profile, preflight checklist, licence) · Progress (refresh every 3 s, stop when the screen is not visible) · Results (recommendation card, compact table, simple bars) · History · Settings (server address for LAN demos, logout). No GGUF downloads on mobile.

**API address:** `EXPO_PUBLIC_API_URL`, changeable on the Settings screen (the laptop's LAN IP, e.g. `http://192.168.1.10:8000/api`). Test with **Expo Go**; build the Android APK with **EAS** (`eas build -p android --profile preview`).

**Mobile WPs (same Git workflow, alternating):**
| WP | Wk | % | Owner | Needs | Branch | What to build |
| --- | --- | --- | --- | --- | --- | --- |
| WP-M1 | 15 | 2 | H | WP-21 | `feat/wpm1-app-setup-theme` | Expo project, copied theme + components, navigation, API service, Login/Register |
| WP-M2 | 16 | 2 | S | WP-M1 | `feat/wpm2-app-new-job-progress` | Catalog, New Job with preflight, Progress screens |
| WP-M3 | 17 | 2 | H | WP-M2 | `feat/wpm3-app-results-history` | Results and History screens, Settings |
| WP-M4 | 18 | 2 | S | WP-M3 | `chore/wpm4-app-build` | EAS config, APK build, `mobile/README.md` |

---

## 14. Session checklist

**Start:** check which machine you're on (2.1) → read this file, `docs/PROJECT_STATUS.md` and the last `docs/DEV_LOG.md` entry → run `npm run progress` and tell the user the current % and days left to the next target → check the WP's **Needs** (12.2) → check Git identity, `git status`, `git branch` → confirm the WP with the user → if it introduces a new concept, explain it first → show the **START** box.

**During:** small steps; run tests; show a **COMMIT** box with a short caption at the 2–3 natural checkpoints of the WP; if something gets complicated, stop and suggest a simpler way. Secrets only in `.env` (Rule 5).

**End:** update the docs (Section 10) → if the WP is finished, show the **END** box; if not, say what's left (no push yet) → explain in simple words what was built → set the WP status in `progress.json`, run `npm run progress`, and tell the user the new %, what it unblocks for the other member, and a short message they can send to them (12.2) → name the next WP for each member.
