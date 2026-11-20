# Development log

Newest entry first. Each entry: who, which WP, what was built, files touched, decisions and why,
problems, next step.

---

## 21 Nov 2026 — Huzaifah — WP-17 Charts + downloads

**Built:** `MetricsChart` (Recharts) and three charts on the Results page; `GET /api/artifacts` and
`GET /api/artifacts/:jobId/:level/download` (`controllers/artifactController.js`,
`utils/artifactFiles.js`); the **Downloads** page; a Files card with download buttons on Results;
results now carry `ranges` (±), `downloadable`, `fileDeleted`, `onThisServer` and `machine`;
task accuracy changes in percentage points. 11 new tests (191 total). Reviewed Sibghatullah's #66.

**Decisions and why**

- **Downloads are plain links** (`<a href download>`) to an endpoint using `res.download`: the browser
  shows its own progress bar and can resume, and the server streams the file without loading it
  into memory.
- **Only files inside `data/artifacts` are ever sent**, whatever path the database holds, and only to
  the job's owner.
- **"On the model machine"** instead of an error: with the shared Atlas database a job's files are on
  the laptop that ran it; the API checks whether the file is on _its own_ disk.
- **Deleted F16 not offered** (`fileDeleted`, WP-16) — its numbers stay as the baseline.
- **Task accuracy in percentage points** (42.0 → 40.8 = −1.2 pp), and the **± range** next to perplexity
  and accuracy: with 400 HellaSwag tasks the range (~4.8) is bigger than the gap between Q5 and Q4.
- **Machine = CPU + threads** from llama-bench's saved settings (REQ-21). The fake pipeline saves no
  CPU, so fake jobs show "—".
- Speed bars are labelled with the number only ("199"): "199 tok/s" didn't fit a bar and wrapped; the
  chart caption says "tokens per second".
- Recharts makes the website bundle > 500 kB (a build warning only); fine for now, code-splitting
  later if needed.

**Problems:** at phone width the Results page was 546 px wide — the 64-character SHA-256 couldn't wrap;
it now has its own wrapping line (same as the Downloads page).

**Live test:** local MongoDB + the worker with `FAKE_PIPELINE=true`: job → Results with all metrics,
accuracy "40.8 ± 4.8 %, −1.2 pp", three charts; Downloads page lists three jobs (deleted F16, files on
"the model machine", downloadable files); a real download returned the file with its name; F16 → 404
with the explanation; phone width without sideways scrolling.

**Next step:** WP-19 (recommendation card, `POST /recommend`, profile dropdown, export).

---

## 20 Nov 2026 — Sibghatullah — WP-18 Recommender + baseline comparison (E3)

**Built**

- `services/recommender.js` (plain functions, no database): `candidates()`, `fits()`,
  `qualityLoss()`, `scoreFiles()`, `recommend()` (rules 1–6 of CLAUDE.md §7.3 → `chosenLevel`,
  `baselineSmallest`, `baselineLargest`, `ruleFired`, `explanation`, `qualityRisk`), `RULES`
  (every `ruleFired` in plain words), `compareWithBaselines()` (E3).
- `pipeline.js`: last stage RECOMMENDING when the job has a profile; problems only log a warning.
- `worker.js`: `populate(['model', 'profile'])`, saves the recommendation.
- `fakePipeline.js`: real recommender on fake numbers ("FAKE DATA —" in the explanation).
- `cli.js`: prints the recommendation; `--preference`, `--ram`, `--disk` (default: this computer).
- 28 new tests (one per rule + E3: 3 models × 4 devices × 3 preferences) — 180 in total.

**Real check:** CLI on SmolLM2-135M, balanced, this laptop: **Q5_K_M** (demo mode 85 s, normal
384 s). Normal-mode numbers: Q5_K_M 185.4 tok/s, perplexity +3.4 %; Q4_K_M 183.8 tok/s, +5.0 %.
Same speed, Q5_K_M a bit better quality → balanced picks Q5_K_M. All three speed tests were
flagged unstable in this run (the laptop was also running other commands) — the explanation said
so.

**Decisions and why**

- **Rules, not a learned model:** every answer can be checked by hand and explained in the viva.
- **F16 is never recommended:** it is the yardstick and is deleted after evaluation.
- **Files without speed/RAM numbers are skipped:** "fits" can't be checked without peak RAM.
  Missing perplexity → the quality guard can't apply, and the file size stands in for quality.
- **Unstable speed → a note in the explanation:** found in the first real run (demo mode Q4_K_M
  122 tok/s, flagged unstable) — the user should know when the speed comparison is shaky.
- **No profile → no recommendation** (regression script); a deleted profile never fails a job.
- **E3 checks properties, not only examples:** always fits, never > 10 % loss when a safer file
  fits, never worse than a baseline on the user's own preference — and it does differ from both
  baselines in some cases. The 1.5 B numbers in the tests are illustrative; WP-20 uses real ones.

**Problems:** a shell-quoting slip left three empty strings in `pipeline.js` — fixed with the
editor and caught before any test ran.

**Next step:** PR `sibghatullah` → `main` (closes #19). Then WP-20 after Huzaifah's WP-19.

---

## 20 Nov 2026 — Sibghatullah — WP-16 Perplexity + demo mode + task accuracy (E2)

**Built**

- `llamacpp.js`: `perplexity()` (`-c 512 --chunks N`, reads "Final estimate: PPL = x +/- y") and
  `hellaswag()` (`--hellaswag --hellaswag-tasks N`, reads accuracy + 95 % range from the last line).
- `evaluator.js`: `DATASETS` (two fixed files + SHA-256), `checkDatasets()` (`E-DATA-01`),
  `qualitySizes()` (100 / 400; demo 10 / 100), `measureQuality()`, `addQuality()`.
- `pipeline.js`: EVALUATING stage after BENCHMARKING; the F16 file is deleted at the end
  (`fileDeleted: true`, numbers kept); returns `demoMode`. `worker.js` saves `demoMode`.
- `Job.js`: `perplexityStd`, `taskAccuracy`, `taskAccuracyMargin`, `taskName`, `fileDeleted`.
- `resultsService.js` (Huzaifah's): `taskAccuracy` added to the compared metrics (one line; his
  results test now expects it).
- `scripts/fetch-datasets.js` (renamed from fetch-wikitext.js; `npm run fetch:datasets`, old name
  kept): WikiText-2 + HellaSwag, SHA-256 checked. `errors.js`: `E-EVAL-01`, `E-DATA-01`.
- `fakePipeline.js`: real HellaSwag numbers, `fileDeleted` on F16, `demoMode`.
- `regression.js` runs in demo mode (it compares sizes, not quality) — PASS in 9 min.
- 16 new tests — 152 in total.

**Real check:** CLI on SmolLM2-135M: perplexity F16 18.92 / Q5_K_M 19.57 / Q4_K_M 19.87 (exactly
the WP-02 hand measurement); HellaSwag 42.0 / 40.5 / 40.8 % (± 4.8) → Q4_K_M keeps 97 % of F16's
accuracy. 456 s per job (demo mode 101 s). Then API + worker on Atlas: the website job reached
COMPLETED; `GET /api/jobs/:id/results` lists all six metrics with changes vs F16; only the Q5_K_M
and Q4_K_M files are left on disk, F16 has `fileDeleted: true`.

**Decisions and why**

- **HellaSwag via llama-perplexity** (no new tool, no Python): the same binary and pinned build.
- **Fixed tasks:** llama.cpp picks the 400 tasks with a fixed seed — two runs gave byte-identical
  output, so every file is tested on the same tasks.
- **Ranges are saved and shown** (PPL ±, accuracy ± half of the 95 % range): with 400 tasks the
  range is ±4.8 points, so a 1–2 point drop is not a real difference — the report must say so.
- **Refuse to measure on changed data** (`E-DATA-01`): checked by SHA-256 before every job; a
  missing or changed file means "no quality numbers", never a failed job.
- **Demo mode numbers are for live demos only** (±9 % HellaSwag, short speed tests flagged
  unstable) — the report uses normal mode.

**Problems:** a name clash (`f16` declared twice in `runStages`) — caught by the tests. The
regression rewrote `docs/regression-M2.md`; restored it, because that file is the M2 record.

**Next step:** PR `sibghatullah` → `main` (closes #17). Then WP-18 (recommender).

---

## 15 Nov 2026 — Sibghatullah — WP-14 Benchmarking

**Built**

- `backend/worker/evaluator.js`: `benchmarkFile()` + `summarise()` → `metrics` (tpsPrompt,
  tpsGen + std, peakRamMb, runs, unstable, settings); `spread()` = (fastest − slowest) / average.
- `backend/worker/llamacpp.js`: `benchmark()` — `llama-bench -p 512 -n 128 -r 3 -ngl 0 -o json`
  (demo mode 128 / 32; `-t` from `BENCH_THREADS` if set); stderr → job log; `E-BENCH-01`.
- `backend/utils/peakMemory.js`: `watchPeakMemory(pid)` — OS peak counter (Windows
  PeakWorkingSet64 via one PowerShell loop, Linux VmHWM).
- `runCommand`: `onSpawn(child)` option. `pipeline.js`: BENCHMARKING stage after the smoke tests.
  `cli.js`: speed / RAM columns. `.env.example`: `BENCH_THREADS`. CLAUDE.md: RAM method.
- Tests: evaluator (real llama-bench JSON), benchmark command, pipeline stage, a REAL RAM-watcher
  test (a program fills 200 MB) — 136 in total.

**Real check:** CLI on SmolLM2-135M — F16 2209 / 105 tok/s, 315 MB; Q5_K_M 1524 / 201 tok/s,
169 MB; Q4_K_M 990 / 209 tok/s, 170 MB; all stable; same speeds as the WP-02 hand measurement and
the same SHA-256 as before. Then API + worker on Atlas: a website job went … → BENCHMARKING →
COMPLETED, and `GET /api/jobs/:id/results` (WP-15) showed the real numbers vs F16 (Q4_K_M:
size −61 %, generation +102 %, RAM −46 %). The worker also finished a job that had been waiting
in the shared queue since 18:50 (started from a website while no worker was running).

**Decisions and why**

- **OS peak counter instead of pidusage.** pidusage reads memory through `wmic`, which this
  Windows 11 build (26200) no longer has; and a peak counter can't miss a short spike between
  samples. Same method as the WP-02 hand measurement (peak working set).
- **Benchmark only files that passed the smoke test**, F16 included (it is the baseline).
- **A failed benchmark doesn't fail the job** — that file just has no numbers (`E-BENCH-01` in
  the log).
- **Threads:** llama.cpp's default (20 = physical cores here); the value used is saved.

**Problems:** the RAM watcher could miss the last numbers when the benchmark ended → `stop()` now
waits (max 3 s) for the watcher to finish. Peak RAM in llama-bench (512 + 128 tokens) is lower
than WP-02's 4096-token run — explained in LEARNING_NOTES §9.

**Next step:** PR `sibghatullah` → `main` (closes #15). Then WP-16.

---

## 15 Nov 2026 — Huzaifah — WP-15 Results table

**Built:** `utils/sizeEstimate.js` (shared by preflight + results), `services/resultsService.js`,
`controllers/resultController.js` + `GET /api/jobs/:id/results`, the `MetricsTable` component, the
Results page (`/jobs/:id/results`), a "See results" button on finished jobs, the rail's Results
step. 8 new tests (106 total).

**Decisions and why**

- **Change vs F16 is computed on the server** (plain functions, unit-tested), so the website and
  the mobile app show the same numbers.
- **Each metric knows whether lower or higher is better**, so the table can colour changes green or
  red without special cases.
- **Only measured columns appear.** Real jobs before WP-14/16 have sizes and smoke tests only; the
  page lists what wasn't measured instead of showing empty columns of dashes.
- **E1 is visible on the site:** the size estimate from before the job is shown under the real
  size, with its error (−21 % for SmolLM2-135M Q4_K_M).
- **Results only for COMPLETED jobs** (404 with a clear message otherwise).
- A basic recommendation block shows when a job has one (fake jobs do); WP-19 builds the full card.

**Live test:** on my local MongoDB: the fake job shows all five metrics and their changes; a
sizes-only job shows Size + Smoke test with the "not measured" note; an unfinished job shows
"No results yet"; at phone width the table scrolls inside its card.

**Next step:** WP-17 charts + downloads (needs WP-15 merged).

---

## 15 Nov 2026 — Sibghatullah — Phase 2 complete (M2, 40 %)

- WP-13 merged (#61) after merging WP-12 from `main` (doc conflicts kept both sides; LEARNING_NOTES
  WP-12 polling = 8b, WP-13 = 8c). Every Phase 2 WP is on `main` → **40 %**, the mid-term target,
  22 days early.
- `docs/release-notes/M2.md` for the tag `v0.2.0-M2`.

**Next step:** rehearse the mid-term demo on both laptops (Atlas + the worker on the model machine).
Phase 3: WP-14 (S) and WP-15 (H) are ready.

---

## 15 Nov 2026 — Sibghatullah — WP-13 Pipeline hardening

**Built**

- `runCommand.js`: `killTree()` — a timeout stops the tool and everything it started
  (`taskkill /T /F` on Windows, the process group on Linux).
- `pipeline.js`: `ensureDiskReserve()` before download, convert and each quantization
  (E-DISK-01 below `DISK_RESERVE_MB` = 2 GB); any error or cancel deletes `data/artifacts/<jobId>/`;
  the download is deleted after conversion unless the model is a demo model; `jobDir()`.
- `downloader.js`: a refused gated download (E-HF-01) removes its empty folder.
- `worker.js`: `removeJobFiles()` on FAILED / CANCELLED / recovered jobs (also covers the fake
  pipeline); empties `data/tmp` at start.
- `scripts/regression.js` (`npm run regression`) → `docs/regression-M2.md`.
- 14 new tests — 111 in total.

**Real check:** `npm run regression` → **PASS**: SmolLM2-135M (11 s), SmolLM2-360M (15 s),
Qwen2.5-0.5B (19 s), every size identical to the WP-09 measurements, all smoke tests pass; the stop
test (1-second conversion limit) ended with E-TIME-01 and no files. No python/llama process left
running, demo downloads kept, nothing written to C:.

**Decisions and why**

- **Half-finished downloads are kept** — the SRS asks for resume support (REQ-11) and REQ-15's
  "partial files" are the job's output files. A partial download has no `.pocketprune-revision`
  marker, so it is never mistaken for a complete one; `hf` resumes it next time.
- **Demo models keep their download** (CLAUDE.md §7.4: demo models are downloaded in advance);
  every other model's download is deleted after conversion (§7.2, REQ-15).
- **The worker cleans up too**, not only the pipeline: the fake pipeline has no clean-up, and a
  crashed worker's job can only be cleaned by whoever recovers it.
- **Regression compares sizes, not just "it ran"**: identical sizes show the pipeline is
  reproducible; a llama.cpp upgrade or a changed flag would show up at once.

**Problems**

1. The first process-tree test passed even with the old "stop only the tool" code: on Windows a
   Node child is tied to its parent and dies with it. Made the test's grandchild _detached_ on
   Windows; now the test fails with the old code and passes with the fix.
2. My first downloader change deleted half-finished downloads — that would have broken resume
   (REQ-11). Changed after reading the SRS.

**Next step:** PR `sibghatullah` → `main` (closes #14). After WP-12 (Huzaifah) is merged, Phase 2 is
complete (40 %) → tag `v0.2.0-M2`.

---

## 15 Nov 2026 — Huzaifah — WP-12 Job Progress page

**Built:** `pages/JobProgressPage.jsx` (`/jobs/:id`), `utils/usePolling.js`, a `failed` state in
`StageStepper`, `formatDuration` / `formatTime`, `errorHint` in `GET /api/jobs/:id`; Job Setup now
opens the progress page after **Start compression**, and the rail's **Run** step links to the
latest job. 1 new test (98 total).

**Decisions and why**

- **Polling every 2 s** (CLAUDE.md §8) instead of live sockets: simplest to explain and enough for
  jobs that take minutes. It stops when the job is finished and pauses while the tab is hidden.
- **Stages never reached stay grey.** The Phase 2 real pipeline stops after the smoke test, so the
  page must not tick Benchmark / Evaluate / Recommend; they light up when WP-14/16/18 add them. The
  furthest stage comes from the status, the log and whether files exist.
- **The API sends the "how to fix" hint** for a failed job (looked up from `errors.js` by code), so
  the error card shows code, message and fix like everywhere else.
- **FAKE DATA badge** while running too: the fake pipeline's stage text ends in "(FAKE)"; after it
  finishes, `job.fake` is set by the worker.
- **Only the log box scrolls** to the newest line, not the whole page (a first version jumped the
  page down on every update — fixed).
- **"Elapsed" uses the time each update arrived**, not the clock during drawing (React 19's lint
  rule forbids impure calls in render).
- **No Cancel button yet**: the cancel API belongs to WP-22 / WP-23.

**Live test:** API + Sibghatullah's worker with `FAKE_PIPELINE=true` against my **local** MongoDB
(so the shared Atlas queue was not touched): a fake job went Queued → … → Done in 20 s with three
files; a failed `E-HF-01` job showed the red stage and the fix; at phone width the page stays put
while progress moves.

**Next step:** Sibghatullah WP-13; then the mid-term rehearsal. Mine after the mid-term: WP-15.

---

## 15 Nov 2026 — Sibghatullah — WP-11 Worker

**Built**

- `backend/worker/worker.js` (`npm run dev:worker`): every 3 s `recoverStuckJobs()` → `pickNextJob()`
  (oldest `QUEUED` → `DOWNLOADING` in one `findOneAndUpdate`) → `processJob()`: loads the catalog
  model, heartbeat every 10 s, runs `pipeline.js` or `fakePipeline.js` (`FAKE_PIPELINE=true`) with a
  `cancellableReporter`, saves `COMPLETED` + variants / `FAILED` + code / `CANCELLED`. Ctrl+C fails
  the running job at once; a job with no heartbeat for 60 s → `E-WORKER-01`.
- `backend/tests/worker.test.js`: 11 tests (oldest first, no double pick, all three endings, deleted
  model → `E-CAT-01`, crash → `E-SERVER-01`, recovery, fake vs real) — 97 in total.
- `backend/tests/helpers/globalSetup.js`: the MongoDB test download stays in `node_modules/.cache`.

**Real check (shared Atlas):** API + worker on the model machine; a SmolLM2-135M job created with
`POST /api/jobs` (preflight 9/9) was picked up within 3 s and went DOWNLOADING → CONVERTING →
QUANTIZING → VALIDATING → COMPLETED in ~35 s (download reused): F16 258.3 / Q5_K_M 106.9 / Q4_K_M
100.6 MB, 3/3 smoke tests pass, 50 log lines visible through `GET /api/jobs/:id`.

**Decisions and why**

- **Cancel is checked before each stage** (inside the reporter), so the pipeline needs no changes;
  stopping a tool mid-stage is WP-22.
- **Recovery runs before every pick**, not only at start: a crashed worker's job is failed within
  ~60 s even if no worker restarts on that machine. 60 s (6 missed heartbeats) avoids failing a
  job that another running worker is still working on.
- **The model is loaded inside the try block**: any error after the pick fails the job at once.

**Problems**

1. `populate('model')` threw "Schema hasn't been registered" — `worker.js` never imported
   `CatalogModel` (the tests did, so they passed). The job had already been taken, so it stayed
   "running" until recovery failed it 60 s later. Fixed: import the model, populate inside `try`,
   new test for a deleted model.
2. Stopping the background terminal did not stop the Node worker inside it: the old, buggy worker
   took the next job too. Found with the process list; stopped it.
3. `npx vitest` started from `backend/` downloaded the MongoDB test binary to the home folder (C:).
   Deleted it and pinned `MONGOMS_DOWNLOAD_DIR` to the repo cache.

**Next step:** PR `sibghatullah` → `main` (closes #12). Then WP-13. Huzaifah can start WP-12.

---

## 15 Nov 2026 — Sibghatullah — Git guide + SRS versions

**Changed**

- **Simpler Git flow** (`docs/GIT_GUIDE.md`, CLAUDE.md §0 Rule 3, §11.2, §11.3): each member now
  commits a WP **directly on their own branch** and opens one PR per WP into `main` — no more
  `wpNN-…` sub-branches. Files are staged by name, never `git add .`. Added the
  `querySrv ECONNREFUSED` fix for Atlas.
- **SRS** (`docs/PocketPrune_SRS.docx`): operating environment and tech stack now say
  **Node.js 22 LTS** (what `package.json` and CI require; Node 20 is end-of-life), **MongoDB 8**
  (the shared Atlas M0 runs 8.0) and **Python 3.12** (the llama.cpp venv). CLAUDE.md §3 says Node 22.
- Deleted the WP-09 trial downloads and GGUF files from `data/` (44 GB; results are in
  `catalog-trials.md`). Kept the three demo-model downloads so demo jobs start without downloading.

**Why:** sub-branches added a second PR per WP without making the history clearer; the SRS must
match what the project really runs on.

---

## 15 Nov 2026 — Huzaifah — Evaluation plan for Phase 3

To make the project clearly FYP-level, we add **measured evidence** rather than more features:
[`EVALUATION_PLAN.md`](EVALUATION_PLAN.md). Six items (E1–E6) slot into existing Phase 3 WPs —
no new WPs, no weight changes, nothing before the mid-term:

- **E1** size estimates vs real files (WP-20 report, WP-15 site). Already visible in
  `catalog-trials.md`: the Q4_K_M estimate is 21 % too small for SmolLM2-135M, about right for 1.7B.
- **E2** HellaSwag task accuracy next to perplexity (WP-16).
- **E3** recommender vs "always Q4" and "largest that fits" (WP-18 tests, WP-20 report).
- **E4** the same benchmark on both laptops (WP-20).
- **E5** Q4_K_M with an importance matrix (could-have, WP-16); **E6** compare outputs (could-have).

Updated: `CLAUDE.md` (WP-15/16/18/20 rows + could-have list), `progress.json` titles, GitHub issues.

---

## 15 Nov 2026 — Huzaifah — Polish fixes (while WP-11 is in progress)

- `progress.json` / `PROJECT_STATUS.md`: WP-10 marked merged (#52) → project at 33 %.
- Website CSS: the leftover off-scale sizes from WP-07 now use theme tokens — 12px text →
  `--font-size-sm` (13px); 12/14px gaps and paddings → `--space-md` (16px); 6/10px → `--space-sm`
  (8px); 2px → `--space-xs` (4px); empty-state 40px → `--space-xl`. Kept on purpose: the 20px card
  padding (recorded in `DESIGN.md`) and the 1–3px nudges that line icons up with text.
- No behaviour change; build and lint pass.

---

## 15 Nov 2026 — Huzaifah — WP-10 Jobs API

**Built:** `POST /api/jobs` (202 `{ jobId }`), `GET /api/jobs`, `GET /api/jobs/:id` (status, stage,
%, queue position, latest 50 log lines), the **Start compression** button on Job Setup, 8 new
tests (86 total). Shared Atlas `MONGO_URI` now in my local `.env`.

**Decisions and why**

- **Preflight runs again when the job is created**, so the checks can't be skipped by calling the
  API directly. A failed check answers with the first failure's code and `details` listing all.
- **The API doesn't set `fake` / `demoMode`**: the worker runs on another laptop with its own
  `.env`, so it records which pipeline it actually used.
- **Queue position counts everyone's queued jobs**, because there is one worker for all users.
- **50 log lines** per `GET /api/jobs/:id` (CLAUDE.md §6). The SRS (REQ-26) says 200; 50 keeps the
  2-second refresh light — revisit on the Progress page if more are needed.
- Job list leaves out `variants` / `recommendation` to keep it small.

**Problems:** Node on Windows can't resolve `mongodb+srv://` (same as on the model machine), so my
`.env` uses the standard `mongodb://host1,host2,host3/pocketprune?tls=true&authSource=admin&replicaSet=…`
form. Live test: created one real job in Atlas from the website (queue position 1), then deleted it.

**Next step:** Sibghatullah WP-11 worker; then WP-12 Job Progress page.

---

## 15 Nov 2026 — Huzaifah — WP-08 Preflight

**Built:** `services/preflightService.js` (9 checks, one small function each),
`POST /api/jobs/preflight`, the live checklist on the Job Setup page, 14 new tests (78 total).

**Decisions and why**

- **All checks run every time** and the page shows every failure at once, so the user can fix
  everything in one go instead of one error per click.
- **A failed check answers 200**, not an error status: "your disk is too small" is a normal
  answer. Only real server problems use the error format.
- **Disk and RAM are measured on the API's machine** (the model machine does the work). The device
  profile is for the recommender later, not for preflight.
- **llama.cpp check reuses Sibghatullah's `checkInstalled()`**, so API and worker agree; with
  `FAKE_PIPELINE=true` it is shown as skipped (the web machine has no llama.cpp).
- **The licence is part of preflight** (`licenseAccepted` in the body) so the checklist shows it
  too; WP-10 checks it again when the job is created.
- Changing a level or the licence box clears the old result, so a stale "passed" is never shown.

**Problems:** my local `.env` still had the placeholder `LLAMA_CPP_REF=b0000`; updated it to
`b12376` and set `FAKE_PIPELINE=true` (local only, not committed).

**Next step:** WP-10 Jobs API (`POST /api/jobs` → 202, list, status + events, 2-job limit).

---

## 15 Nov 2026 — Sibghatullah — WP-00 shared Atlas database · Phase 1 complete (M1)

**Done**

- Shared **MongoDB Atlas M0** connection string put in the local `.env` (`MONGO_URI`, database
  `pocketprune`) — git-ignored, never in code, docs or commits.
- `npm run seed` on Atlas: 8 catalog models + the demo user.
- WP-00 and WP-09 marked `merged` in `progress.json`; Phase 1 = 25/25 %, project 27 %.
- `docs/release-notes/M1.md` for the `v0.1.0-M1` tag.

**Problem and fix:** Atlas gives a short `mongodb+srv://` string; Node needs a special DNS lookup
(SRV record) for it. On the model machine Node sends that lookup to `127.0.0.1` and gets
`ECONNREFUSED`, although Windows DNS works. Fix without code changes: use the **standard
`mongodb://host1,host2,host3/pocketprune?tls=true&authSource=admin&replicaSet=…`** form of the same
string (hosts and replica set come from the cluster's public DNS records). Ping OK.

**Next step:** Huzaifah puts the same `MONGO_URI` in his `.env` (sent privately) and checks his IP
in Atlas → Network Access. Tag `v0.1.0-M1`. Phase 2: WP-08 (H) → WP-10 (H) → WP-11 (S).

---

## 15 Nov 2026 — Sibghatullah — WP-09 Catalog trials

**Built**

- `scripts/validate-catalog.js` (`npm run validate:catalog`): asks the Hugging Face API about every
  seed model **without downloading it** — pinned revision exists, has `.safetensors`, real
  parameter count ≤ 4 B and within 3 % of `paramsBillion`, `gated` flag correct. Result: 8/8 OK.
- `scripts/fetch-wikitext.js` (`npm run fetch:wikitext`): downloads WikiText-2 `wiki.test.raw`
  into `data/wikitext/` and checks its SHA-256 (the one measured in WP-02). Safe to run again.
- `backend/utils/runCommand.js`: every tool gets `TMP`/`TEMP`/`TMPDIR` = `data/tmp`, so no
  temporary files land on C: (+1 test, 64 in total).
- `backend/cli.js`: uses `checkCatalogEntry()` (same 4 B / full-commit rules as `seed.js`).
- `backend/seedData.js`: measured F16 sizes; note that the revisions are confirmed.
- `docs/catalog-trials.md`: every catalog model marked works / doesn't.

**Trials** (CLI, Q5_K_M + Q4_K_M, one model after another, ~1 h in total): SmolLM2-360M,
Qwen2.5-0.5B, TinyLlama-1.1B, Qwen2.5-1.5B, SmolLM2-1.7B and Phi-3.5-mini all made 3 files that
pass the smoke test (142 s … 1566 s per model). Llama-3.2-1B stopped at download with `E-HF-01`
(gated, no token) — the expected, friendly error. Nothing new was written to C:.

**Decisions and why**

- **Validate through the HF API, not by downloading**: checking 8 models takes seconds instead of
  ~20 GB of downloads, so it can be re-run any time (later: the catalog validation job, WP-24).
- **Real parameter count from safetensors metadata**, not from the model name ("1.7B" is rounded).
- **Measured F16 sizes in the seed**: preflight (WP-08) uses `f16SizeMb` for the disk/RAM checks,
  so real numbers make those checks honest.
- **Llama-3.2 stays in the catalog as optional** (gated) — it works once a token is set.

**Next step:** commit, PR `sibghatullah` → `main` (closes the WP-09 issue). Then WP-11 (worker)
once Huzaifah's WP-10 is merged; meanwhile WP-00 (Atlas `MONGO_URI`).

---

## 15 Nov 2026 — Sibghatullah — WP-06 CLI pipeline + fake pipeline

**Built**

- `backend/worker/pipeline.js`: `runPipeline(job, report)` — download → F16 → quantize each level →
  smoke test each file; returns `{ variants, llamaCppRef }`. Convert failure stops the job; a
  failed level is logged and its half-written file deleted; no passing quantized file → `E-VAL-01`.
- `backend/worker/reporter.js`: `consoleReporter()` (terminal) and `dbReporter(job)` (Job
  status/stage/progress/heartbeat + JobEvents, for the worker in WP-11); `STAGE_PROGRESS`.
- `backend/worker/fakePipeline.js` ⏳: same `runPipeline`, all 7 stages, real WP-02 numbers scaled
  by `f16SizeMb`, placeholder files, `fake: true` + a FAKE recommendation.
- `backend/utils/fileHash.js`: streamed SHA-256 + size in MB.
- `backend/cli.js` + `npm run pipeline` (root and backend): `--model`, `--levels`, `--fake`.
- 8 new tests (pipeline, reporter, fileHash, model name) — 63 in total.

**Real check:** `npm run pipeline` on SmolLM2-135M → F16 258.3 / Q5_K_M 106.9 / Q4_K_M 100.6 MB,
3/3 smoke tests PASS, 12–14 s (download reused). Fake run: 7 stages, ~20 s.

**Decisions and why**

- **Pipeline returns the results, the caller saves them.** cli.js prints them; the worker (WP-11)
  will save them on the Job. So the pipeline needs no database and is easy to test.
- **Reporter object** instead of `console.log` / `JobEvent.create` inside the pipeline (same code
  for CLI, worker and tests).
- **`--model-name` for the converter**: without it the GGUF metadata contains the download folder
  name, so identical weights gave different SHA-256s. With it, two runs are byte-identical.
- **Tool lines are logged without waiting** (`report.log(line).catch(...)`), so hundreds of lines
  don't slow the pipeline down.
- **The fake pipeline has no automated test** (CLAUDE.md §7.7: deleting it in WP-20 must break
  nothing); it was checked by running `npm run pipeline -- --fake`.

**Problems:** the checksum difference above — fixed.

**Next step:** PR `sibghatullah` → `main` (closes #7). Phase 1 then only needs WP-00 (Atlas).
Next for Sibghatullah: WP-09 (catalog trials) — needs WP-06 merged.

---

## 15 Nov 2026 — Sibghatullah — WP-04 Command runner

**Built**

- `backend/utils/runCommand.js`: runs one program with `spawn(program, args)` and no shell,
  passes every output line to `onLine`, keeps the last 200 lines, stops slow programs
  (`E-TIME-01`), reports a missing program as `E-TOOL-01`.
- `backend/worker/llamacpp.js`: `toolPath`, `pythonPath`, `checkInstalled` (VERSION = pinned tag),
  `convertToF16`, `quantize`, `smokeTest`. The only file that knows llama.cpp flags.
- `backend/worker/downloader.js`: `hf download` at the pinned revision (safetensors / json /
  tokenizer only), reuse via a `.pocketprune-revision` marker, `E-HF-01` (gated) / `E-HF-02`.
- 22 new tests (`runCommand`, `llamacpp`, `downloader`) — 55 in total, no llama.cpp or internet.
- `E-TOOL-01` hint now points to `npm run setup:llamacpp`.

**Real check (Windows, b12376):** download 47 s → F16 20 s → Q4_K_M 1.1 s → smoke test PASS
("Paris. Paris is a city…"); second download reused; 862 log lines collected.

**Files touched:** `backend/utils/runCommand.js`, `backend/worker/llamacpp.js`,
`backend/worker/downloader.js`, `backend/tests/runCommand.test.js`,
`backend/tests/llamacpp.test.js`, `backend/tests/downloader.test.js`, `backend/utils/errors.js`,
docs.

**Decisions and why**

- **runCommand resolves with the exit code instead of throwing** on a non-zero code; the caller
  picks the right error code (convert, quantize and smoke test mean different things).
- **A smoke-test timeout is a failed file, not a crash** (`passed: false`), so one bad level doesn't
  stop the job; a missing program still throws `E-TOOL-01`.
- **HF token via the environment**, never in arguments (arguments end up in the job log).
- **Downloads go to `data/models/<owner>__<name>`** (`/` is not allowed in folder names);
  `HF_HOME` points into `data/` so nothing is cached on C:.
- **Bench and perplexity commands are not added yet** — they belong to WP-14 / WP-16.
- **Commits go directly on `sibghatullah`** (no WP sub-branch), as Sibghatullah prefers.

**Problems:** none. Note: `data/models/SmolLM2-135M-Instruct` (the WP-02 hand download) is now a
duplicate of `HuggingFaceTB__SmolLM2-135M-Instruct` and can be deleted.

**Next step:** PR `sibghatullah` → `main`. Then WP-06: `pipeline.js` + `cli.js` + `fakePipeline.js`.

---

## 14 Nov 2026 — Sibghatullah — WP-02 llama.cpp setup + first hand compression

**Built**

- `scripts/setup-llamacpp.js` + `npm run setup:llamacpp`: installs llama.cpp **b12376** into
  `LLAMA_CPP_DIR` (source for the converter, the official Windows CPU build, a Python 3.12 venv with
  the converter's packages and `hf`). Safe to run again. On Linux it builds the same tag with CMake.
- Compressed `HuggingFaceTB/SmolLM2-135M-Instruct` by hand: download → F16 → Q5_K_M + Q4_K_M →
  smoke test (all 3 pass). Also measured speed, peak RAM and perplexity for WP-06's fake pipeline.
- Docs: LEARNING_NOTES §4–5 (every command explained + results), `catalog-trials.md`, README
  install + pinned tag, `.env.example` (`LLAMA_CPP_DIR`, `LLAMA_CPP_REF=b12376`), CLAUDE.md.

**Files touched:** `scripts/setup-llamacpp.js`, `package.json`, `.env.example`, `README.md`,
`CLAUDE.md`, `docs/LEARNING_NOTES.md`, `docs/catalog-trials.md`, `docs/progress.json`,
`docs/PROJECT_STATUS.md`, `docs/HOW_IT_WORKS.md`, `docs/DEV_LOG.md`.

**Decisions and why**

- **Model machine = native Windows 11, not WSL2.** llama.cpp publishes a ready-made Windows CPU
  build (nothing to compile), both teammates are on Windows, and CPU speed is practically the same.
  The Node code must be cross-platform anyway. Cost: Docker (WP-26) will need WSL2 later; the SRS
  operating-environment paragraph now says "Windows 11 (64-bit)" (`docs/PocketPrune_SRS.docx`).
- **Setup script in Node instead of `build-llamacpp.sh`**, so it runs on Windows and Linux.
- **Pinned b12376** (latest release on 14 Nov 2026). llama.cpp releases several times a day; the tag
  is in `.env` and `LLAMA_CPP_DIR/VERSION`.
- **Smoke test uses `llama-completion`, not `llama-cli`**: in b12376 `llama-cli` is chat-only.
  `llama-completion ... -no-cnv` writes 32 tokens and exits (WP-04 must use it).
- **Python 3.12 for the venv** (`py -3.12`): the safest version for torch/numpy wheels.
- `LLAMA_CPP_DIR` must have **no spaces** (`D:/llama.cpp`); the repo path has spaces, but tools
  get paths as separate arguments, so that is fine.
- The pinned SmolLM2-135M revision `12fd25f7…` in `seedData.js` is **correct** (it downloaded at
  exactly that commit).

**Results (i7-14700HX, 20 threads):** F16 258 MiB / Q5_K_M 107 MiB / Q4_K_M 101 MiB; generation
105 / 191 / 199 tok/s; perplexity 18.92 / 19.57 / 19.87. Details in LEARNING_NOTES §5.

**Problems:** none blocking. Files are only ~2.5× smaller (big vocabulary table kept at higher
precision in a tiny model) — explained in the notes. Peak RAM on Windows is measured with the
process's peak working set; `pidusage` on Windows must be checked in WP-14.

**Next step:** Huzaifah reviews WP-02 (`sibghatullah` → `main`). Then WP-04 (command runner).
Still open from WP-00: shared Atlas `MONGO_URI` in both `.env` files.

---

## 12 Nov 2026 — Huzaifah — Simpler Git workflow

- `main` history squashed to one commit per finished WP (7 commits) so it is easy to read.
- New personal branches `huzaifah` and `sibghatullah`: WP branch → PR into your branch → PR into
  `main` reviewed by the other member.
- 2–3 short commits per WP with plain captions (`WP-08: add preflight checks`).
- Secrets only in the local `.env`, never on GitHub. Rules written into `CLAUDE.md` (Rule 3,
  Rule 5, Section 11) and `docs/GIT_GUIDE.md`; shorter PR template.

---

## 11 Nov 2026 — Huzaifah — WP-05 Catalog and profiles API

**Built:** `seedData.js` (8 catalog models with pinned commit hashes), `catalogService.js`
(catalog rules), a repeatable `seed.js`, catalog and profile controllers + routes, 13 new tests,
`API.md` for both. The WP-07 pages now show real data.

**Decisions and why**

- **Revisions and parameter counts from the Hugging Face API** (`/api/models/<repo>`, fields
  `sha` and `safetensors.total`), looked up on 11 Nov 2026, because WP-02 (Sibghatullah's hand
  trial) is not merged yet. He confirms or updates them in WP-02 / WP-09.
- **F16 size = parameters × 2 bytes**, in MiB (what the site calls MB).
- **Seed upserts by `hfRepoId`** — running it twice is safe, and an admin's on/off switch is kept.
- **Catalog rules in a service** (`checkCatalogEntry`) so the seed now and the admin page later
  (WP-25) use the same 4 B limit and commit-hash check.
- **Own data only already now**: every profile query filters by `req.user._id`; another user's
  profile answers 404. When login arrives (WP-21) this keeps working unchanged.
- No admin user in the seed yet: an admin needs a real password hash, which comes with login (WP-21).
- Small frontend fix found with real data: parameters now show as "1.2 B" instead of "1.236 B".

**Problems:** none.

**Next step:** WP-08 Preflight (needs WP-05 + WP-07, both done after this merges).

---

## 11 Nov 2026 — Huzaifah — WP-07 Website foundation

**Built:** `theme.js` + CSS variables, base styles, 13 reusable components (incl. the
`CompressionLadder` signature and `JobSummary`), the app layout with the pipeline rail, React
Router pages (Catalog, Profiles, Job Setup, placeholders for History / Downloads / Help / 404),
`services/api.js`, `JobDraftContext`, `useLoad`, `format.js`. Also `PRODUCT.md` (product record
used by the design tool) and the design-tool config in `.impeccable/`.

**Decisions and why**

- **Plain CSS + CSS variables, no UI kit.** Easiest to read, nothing new to learn, and `theme.js`
  can be reused as-is in React Native later. Libraries added: `react-router-dom` (pages),
  `axios` (API calls), `lucide-react` (icons), `@fontsource-variable/inter` (font from our own
  files, no Google request).
- **Layout = "Pipeline rail"**, picked by Huzaifah from three layout sketches generated with the
  impeccable design skill: a five-step rail (Model → Device → Preflight → Run → Results) on every
  job page, a "Your job" summary on the right. On phones the rail shows numbers plus the current
  step's name, and the summary moves under the content.
- **Extra theme shades** (`primarySoft`, `primaryHover`, `successText`, …): the CLAUDE.md green and
  amber are too light for small text on pale badges (fail WCAG AA), so badges use darker text
  shades of the same colours.
- **Estimated sizes before a job runs** from bits per weight (F16 16, Q8_0 8.5, Q5_K_M 5.7,
  Q4_K_M 4.9), always shown with "≈" and "Sizes are estimates until a job runs".
- **Job draft in `sessionStorage`** so a page refresh doesn't lose the chosen model and device.
- **Preflight / Start buttons are visible but disabled** with a note, rather than hidden, so the
  flow is demonstrable now; WP-08 and WP-10 switch them on.
- The pages were checked against a throwaway stand-in API (not committed) because `/api/catalog`
  and `/api/profiles` arrive in WP-05.

**Problems:** React 19's lint rule forbids resetting state inside an effect → added the small
`useLoad` hook. Profile card buttons wrapped at desktop width → Edit/Delete became icon buttons
with labels for screen readers. An empty "Free disk" field passed validation → fixed.

**Known drift (for a later polish PR):** a few sizes sit off the CLAUDE.md §9 scale — 12px text
on badges, ladder hints and card notes; some 14px / 12px / 6px / 10px gaps. `DESIGN.md` records
the intended scale, not these values.

**Next step:** WP-05 (catalog + profiles API) so these pages show real data.

---

## 11 Nov 2026 — Huzaifah — WP-03 Backend core

**Built:** `settings.js` (all settings in one place), `db.js`, the five Mongoose models (User,
CatalogModel, DeviceProfile, Job with variants/metrics/recommendation, JobEvent), `errors.js`
(every error code with status, message and hint), `errorHandler.js`, the temporary demo-user
`protect`, `GET /api/system/health` and `GET /api/system/host-profile`, and 19 new tests.

**Files touched:** `backend/config/*`, `backend/models/*`, `backend/utils/errors.js`,
`backend/utils/systemInfo.js`, `backend/middleware/*`, `backend/controllers/systemController.js`,
`backend/routes/systemRoutes.js`, `backend/app.js`, `backend/server.js`, `backend/tests/*`,
`backend/vitest.config.js`, `.env.example`, docs.

**Decisions and why**

- **`settings.js` loads `.env` itself.** Any file (API, worker, seed, CLI) that imports settings
  gets the same values; `server.js` no longer needs its own dotenv call.
- **Three extra error codes**: `E-INPUT-01` (bad input), `E-NOTFOUND-01`, `E-SERVER-01`. The list in
  `CLAUDE.md` §7.6 only has pipeline errors; normal API mistakes need codes too.
- **The demo user is created by `protect` on first use** (upsert), so the API works before the
  seed exists (WP-05). Its `passwordHash` is not a real hash, so nobody can log in as it later.
- **`tpsPromptStd` / `tpsGenStd` in the metrics**: REQ-19 asks for the standard deviation of the
  3 runs, not only the mean.
- **Mongoose 9:** the `new: true` option of `findOneAndUpdate` is deprecated — use
  `returnDocument: 'after'`. (The worker snippet in `CLAUDE.md` §5 still shows `new: true`;
  Sibghatullah should use `returnDocument: 'after'` in WP-11.)
- **One in-memory MongoDB for all test files** (Vitest `globalSetup`), each file with its own
  database. Starting one server per file in parallel sometimes hung for 2 minutes on Windows.

**Problems:** the flaky test start above — fixed by the shared server (5/5 runs green).

**Next step:** Sibghatullah reviews WP-03. Huzaifah: WP-07 (website foundation) can start now;
WP-05 (catalog + profiles API) after WP-03 merges.

---

## 11 Nov 2026 — Huzaifah — WP-00 / WP-01 Project setup

**Built**

- WP-00: created the local repository, pushed a bootstrap commit to `main` (project brief
  `CLAUDE.md`, SRS, roadmap, `.gitignore`), created labels, milestones and one issue per WP.
- WP-01: the whole folder structure from `CLAUDE.md` §4, root npm scripts, backend skeleton
  (Express, one test), website skeleton (React + Vite), worker and seed placeholders, `.env.example`
  with every setting, all `docs/` files, `progress.json` + `scripts/progress.js`, PR/issue templates
  and CI.

**Files touched:** `package.json`, `.env.example`, `.gitattributes`, `.editorconfig`,
`eslint.config.js`, `.prettierrc.json`, `backend/*`, `frontend/*`, `scripts/progress.js`, `docs/*`,
`.github/*`, `README.md`, `CHANGELOG.md`.

**Decisions and why**

- **Node.js 22 LTS instead of 20.** Node 20 reached end-of-life in April 2026 and the current Vite
  and Vitest releases need Node 22+. Nothing else in the plan changes.
- **`backend/app.js` + `backend/server.js`** instead of only `server.js`: `app.js` builds the Express
  app, `server.js` starts it. Tests can then import the app without opening a port.
- **One `.env` in the repo root**, read by the API, the worker and the scripts, so there is only one
  file to fill in on each laptop.
- **Vite proxy** (`/api` → `localhost:8000`): the website calls `/api/...` as if it were the same
  site, so no CORS setup is needed in development.
- **ESLint 9** (not 10): `eslint-plugin-react` does not support ESLint 10 yet.
- **`.gitattributes` forces LF line endings** so files edited on Windows still run inside WSL2
  (bash scripts break with Windows line endings).
- Empty folders carry a `.gitkeep` so Git keeps the structure before the files exist.

**Problems:** none.

**Next step:** Sibghatullah reviews and merges the WP-01 PR. Then Huzaifah starts WP-03 (backend
core); Sibghatullah starts WP-02 (llama.cpp on WSL2).
