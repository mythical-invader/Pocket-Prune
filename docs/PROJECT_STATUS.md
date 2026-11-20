# Project status

> Updated at the end of every session. Run `npm run progress` and paste its summary here.

```
PocketPrune progress: 50 % merged (in progress: 4 %)
Phase 1 ████████████████████ 25/25 %   Phase 2 ████████████████████ 15/15 %   Phase 3 █████████░░░░░░░░░░░ 10/22 %
Huzaifah: 23.5 %  ·  Sibghatullah: 26.5 %
Next checkpoint: Phase 3 (M3) on 2027-01-17 (58 days) — 12 % to go: WP-17, WP-18, WP-19, WP-20
In progress: WP-18 (S) · ready to start: WP-17 (H)
```

**Phase 2 complete — 40 %, the mid-term target — milestone `v0.2.0-M2`** ([release notes](release-notes/M2.md)).
**Phase 1 complete — milestone `v0.1.0-M1`** ([release notes](release-notes/M1.md)).

_Last updated: 20 Nov 2026 — Sibghatullah (WP-18)._

## Work packages

Status values: `not-started` · `in-progress` · `in-review` · `merged`. Weights and dependencies live in
[progress.json](progress.json).

| WP                                  | Title                                       | Owner | Status      | Branch / PR    | Notes                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------- | ----- | ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP-00                               | GitHub setup + shared Atlas database        | Both  | merged      | —              | Repo, labels, milestones, issues, collaborator; Atlas M0 shared + seeded; `main` protected (public repo)                                                      |
| WP-01                               | Project setup                               | H     | merged      | #38            | Skeletons, scripts, docs, CI                                                                                                                                  |
| WP-02                               | llama.cpp setup + first hand compression    | S     | merged      | #44            | Windows 11, llama.cpp b12376; SmolLM2-135M compressed by hand (3/3 smoke tests pass); revision OK                                                             |
| WP-03                               | Backend core                                | H     | merged      | #39            | Models, errors, health, host profile                                                                                                                          |
| WP-04                               | Command runner                              | S     | merged      | #45            | runCommand, llamacpp, downloader + 22 tests; real run on SmolLM2-135M passes                                                                                  |
| WP-05                               | Catalog + profiles API                      | H     | merged      | #42            | Catalog, profiles CRUD, seed with pinned revisions                                                                                                            |
| WP-06                               | CLI pipeline + fake pipeline                | S     | merged      | #46            | pipeline.js + cli.js + fakePipeline.js; CLI makes 3 valid, reproducible files                                                                                 |
| WP-07                               | Website foundation                          | H     | merged      | #41            | Pipeline-rail layout, theme, components, Catalog/Profiles/Job Setup                                                                                           |
| WP-09                               | Catalog trials                              | S     | merged      | #47            | 7/8 models compress + pass smoke tests; Llama-3.2 needs HF token; validate-catalog 8/8 OK                                                                     |
| WP-08                               | Preflight                                   | H     | merged      | #50            | 9 checks on the server, live checklist on Job Setup                                                                                                           |
| WP-10                               | Jobs API                                    | H     | merged      | #52            | Create (202, preflight again), list, status + 50 log lines + queue position, 2-job limit                                                                      |
| WP-11                               | Worker                                      | S     | merged      | #58            | Picks the oldest QUEUED job, heartbeat, cancel between stages, recovery (E-WORKER-01); a real website-API job compressed SmolLM2-135M in 35 s                 |
| WP-12                               | Job Progress page                           | H     | merged      | #60            | Live page polling every 2 s: stages, bar, elapsed, queue position, log, error with fix, FAKE DATA badge, files made                                           |
| WP-13                               | Pipeline hardening                          | S     | merged      | #61            | Process-tree timeouts, 2 GB disk reserve, no junk after fail/cancel/crash, downloads deleted after conversion; `npm run regression` PASS on the 3 demo models |
| WP-14                               | Benchmarking                                | S     | merged      | #65            | BENCHMARKING stage: llama-bench 3 runs, prompt/gen tok/s, peak RAM (OS peak counter), unstable flag, settings saved; real job shows on the Results API        |
| WP-15                               | Results table                               | H     | merged      | #63            | Results API + page: every file vs F16 (%), green/red, size estimate vs real (E1), only measured columns                                                       |
| WP-16                               | Perplexity + demo mode + task accuracy (E2) | S     | merged      | #66            | EVALUATING stage: perplexity (WikiText-2) + HellaSwag accuracy with ± ranges, datasets checked by SHA-256, demo mode, F16 deleted after evaluation            |
| WP-18                               | Recommender + baseline comparison (E3)      | S     | in-progress | `sibghatullah` | RECOMMENDING stage: 6 rules + plain-English explanation for the job's device profile; E3 vs "always Q4" and "largest that fits" (36 test cases)               |
| WP-17, WP-19 – WP-32, WP-M1 – WP-M4 | see [progress.json](progress.json)          |       | not-started |                | Phases 2–5                                                                                                                                                    |

## What works now

- **llama.cpp b12376** on Windows (`npm run setup:llamacpp`); SmolLM2-135M compressed by hand (WP-02).
- **Node runs llama.cpp** (WP-04): `downloadModel`, `convertToF16`, `quantize`, `smokeTest` with time limits and log lines.
- **CLI pipeline** (WP-06): `npm run pipeline` compresses a catalog model end to end in the terminal; `--fake` runs the fake pipeline (no llama.cpp).
- **Every catalog model tried** (WP-09): 7 of 8 compress and pass the smoke test ([catalog-trials.md](catalog-trials.md)); `npm run validate:catalog` checks the catalog on Hugging Face; `npm run fetch:wikitext` gets the perplexity text.
- `npm run seed` fills the catalog with 8 models pinned to exact Hugging Face commits (safe to run again).
- Website: pipeline rail (Model → Device → Preflight → Run → Results); **Catalog** shows the real models with compression ladders; **Profiles** saves, edits and deletes device profiles through the API ("Use this computer's values" fills the form); **Job Setup** shows levels with estimated sizes, the licence box and **Run preflight**: 9 server checks (catalog, levels, profile, disk, RAM, licence, HF token, llama.cpp, job limit), each with a tick or a cross, reason, fix and code. After a passed preflight, **Start compression** creates a real job in the shared database ("waiting in the queue, position N").
- API: `/api/catalog`, `/api/catalog/:id`, `/api/profiles` (CRUD, own data only), `/api/system/health`, `/api/system/host-profile`, `POST /api/jobs/preflight`, `POST /api/jobs` (202), `GET /api/jobs`, `GET /api/jobs/:id`. Every error comes back as `{ code, message, hint }`.
- **Job Progress page** (WP-12): after **Start compression** the site opens `/jobs/:id`, which updates every 2 s — stage stepper (unreached stages stay grey, a failed stage shows a red cross), progress bar, elapsed time, queue position, the latest log lines, the error with its fix and code, a **FAKE DATA** badge for fake jobs, and the files made when it finishes.
- **Worker** (WP-11): `npm run dev:worker` takes queued jobs from the database and runs the real pipeline (or the fake one with `FAKE_PIPELINE=true`); status, stage, % and log lines appear through `GET /api/jobs/:id`.
- **Pipeline hardening** (WP-13): a timed-out tool is stopped with everything it started; jobs stop with E-DISK-01 before free disk drops below 2 GB; failed, cancelled and crashed jobs leave no files; `npm run regression` checks the demo models ([regression-M2.md](regression-M2.md)).
- **Results page** (WP-15): `/jobs/:id/results` — every file compared with F16 (size, speeds, peak RAM, perplexity, % change in green/red), the size estimate vs the real size (E1), smoke tests, settings; only measured columns appear. "See results" on a finished job.
- **Benchmarking** (WP-14): every file that passes the smoke test is measured with llama-bench (3 runs) — prompt and generation speed, peak RAM, stability; the numbers appear in the Results API/page. SmolLM2-135M Q4_K_M: 209 tok/s generation (2× F16), 170 MB peak RAM.
- **Quality** (WP-16): every file that passes is also measured for perplexity (WikiText-2, 100 chunks) and HellaSwag task accuracy (400 tasks), each with its ± range; the F16 file is deleted afterwards (numbers kept). SmolLM2-135M Q4_K_M: perplexity +5 %, keeps 97 % of F16's HellaSwag accuracy. `npm run fetch:datasets` gets both test files. Demo mode: ~100 s per job instead of ~450 s.
- **Recommender** (WP-18, on `sibghatullah`): after the measurements the job picks the best file for its device profile with six rules (fits in 75 % of RAM and disk − 2 GB, ≤ 10 % perplexity loss, preference, tie → smaller, nothing fits → what is needed, smallest/largest that fit) and explains why in plain English. Saved as `recommendation` on the job (already in the Results API). `npm run pipeline -- --preference speed --ram 4096 --disk 8000` tries other devices.
- Both laptops use the shared **MongoDB Atlas** database (`MONGO_URI` in each local `.env`).
- `npm run install-all`, then `npm run dev` starts the API (port 8000) and the website (port 5173) on Windows.
- `npm test` (180 tests, in-memory MongoDB, no llama.cpp needed), `npm run build`, `npm run lint`, `npm run progress`; CI on every PR.

## What's next

- **Sibghatullah:** WP-18 PR into `main`, then WP-20 (benchmark report E1/E3/E4 + remove the fake pipeline) once WP-19 is merged.
- **Huzaifah:** WP-17 charts + downloads — don't offer files with `fileDeleted: true` (the F16 baseline); show task accuracy with a `%` (the table prints it without one yet). Then WP-19: the recommendation card (`recommend()` in `services/recommender.js` is ready for `POST /recommend`; show the card also when `chosenLevel` is null — `ruleFired: "nothing-fits"` explains what RAM/disk is needed).
- **Both, before 7 Dec:** rehearse the demo — SmolLM2-135M on the website → preflight → start → live progress while the real worker compresses it → two valid files.
- **Phase 3 (after the mid-term):** follow [EVALUATION_PLAN.md](EVALUATION_PLAN.md) — extra measured checks E1–E6 inside WP-15/16/18/20.

## Known issues

- On the model machine Node cannot resolve `mongodb+srv://` addresses; `.env` uses the standard `mongodb://host1,host2,host3/…` form of the Atlas string instead.
- Llama-3.2-1B (gated) needs `HF_TOKEN` in `.env` and the licence accepted on Hugging Face; without it the job stops with `E-HF-01`.
- **Run only ONE worker against the shared Atlas database.** Two workers never take the same job, but a fake worker on the web machine would "win" some real jobs and finish them with FAKE DATA. Real jobs: the worker on the model machine.
- Cancel stops the job between stages; stopping a running tool at once comes in WP-22.
- Preflight measures disk and RAM on the machine running the API. With the shared Atlas database, run the API on the model machine for real jobs (the web machine uses `FAKE_PIPELINE=true`).
- `main` is protected (repo is public): PRs only, CI must pass, no force-push.

## How to run what exists

See the [README](../README.md#run-it). Short version:

```bash
npm run install-all
copy .env.example .env      # Windows (cp on Linux/WSL)
npm run seed
npm run dev
```

You need a MongoDB to connect to: the shared Atlas string in `MONGO_URI`, or a local MongoDB.
