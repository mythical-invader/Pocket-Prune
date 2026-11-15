# Project status

> Updated at the end of every session. Run `npm run progress` and paste its summary here.

```
PocketPrune progress: 33 % merged (in progress: 3 %)
Phase 1 ████████████████████ 25/25 %   Phase 2 ███████████░░░░░░░░░ 8/15 %
Huzaifah: 18.5 %  ·  Sibghatullah: 14.5 %
Next checkpoint: Mid-term demo (40 %) on 2026-12-07 (22 days) — 7 % to go: WP-11, WP-12, WP-13
Waiting: WP-12 (H) needs WP-11 (S, in progress) · WP-13 (S) needs WP-11
```

**Phase 1 complete — milestone `v0.1.0-M1`** ([release notes](release-notes/M1.md)).

_Last updated: 15 Nov 2026 — Sibghatullah (WP-11)._

## Work packages

Status values: `not-started` · `in-progress` · `in-review` · `merged`. Weights and dependencies live in
[progress.json](progress.json).

| WP                           | Title                                    | Owner | Status      | Branch / PR    | Notes                                                                                                                                         |
| ---------------------------- | ---------------------------------------- | ----- | ----------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| WP-00                        | GitHub setup + shared Atlas database     | Both  | merged      | —              | Repo, labels, milestones, issues, collaborator; Atlas M0 shared + seeded; no branch protection (needs GitHub Pro)                             |
| WP-01                        | Project setup                            | H     | merged      | #38            | Skeletons, scripts, docs, CI                                                                                                                  |
| WP-02                        | llama.cpp setup + first hand compression | S     | merged      | #44            | Windows 11, llama.cpp b12376; SmolLM2-135M compressed by hand (3/3 smoke tests pass); revision OK                                             |
| WP-03                        | Backend core                             | H     | merged      | #39            | Models, errors, health, host profile                                                                                                          |
| WP-04                        | Command runner                           | S     | merged      | #45            | runCommand, llamacpp, downloader + 22 tests; real run on SmolLM2-135M passes                                                                  |
| WP-05                        | Catalog + profiles API                   | H     | merged      | #42            | Catalog, profiles CRUD, seed with pinned revisions                                                                                            |
| WP-06                        | CLI pipeline + fake pipeline             | S     | merged      | #46            | pipeline.js + cli.js + fakePipeline.js; CLI makes 3 valid, reproducible files                                                                 |
| WP-07                        | Website foundation                       | H     | merged      | #41            | Pipeline-rail layout, theme, components, Catalog/Profiles/Job Setup                                                                           |
| WP-09                        | Catalog trials                           | S     | merged      | #47            | 7/8 models compress + pass smoke tests; Llama-3.2 needs HF token; validate-catalog 8/8 OK                                                     |
| WP-08                        | Preflight                                | H     | merged      | #50            | 9 checks on the server, live checklist on Job Setup                                                                                           |
| WP-10                        | Jobs API                                 | H     | merged      | #52            | Create (202, preflight again), list, status + 50 log lines + queue position, 2-job limit                                                      |
| WP-11                        | Worker                                   | S     | in-progress | `sibghatullah` | Picks the oldest QUEUED job, heartbeat, cancel between stages, recovery (E-WORKER-01); a real website-API job compressed SmolLM2-135M in 35 s |
| WP-12 – WP-32, WP-M1 – WP-M4 | see [progress.json](progress.json)       |       | not-started |                | Phases 2–5                                                                                                                                    |

## What works now

- **llama.cpp b12376** on Windows (`npm run setup:llamacpp`); SmolLM2-135M compressed by hand (WP-02).
- **Node runs llama.cpp** (WP-04): `downloadModel`, `convertToF16`, `quantize`, `smokeTest` with time limits and log lines.
- **CLI pipeline** (WP-06): `npm run pipeline` compresses a catalog model end to end in the terminal; `--fake` runs the fake pipeline (no llama.cpp).
- **Every catalog model tried** (WP-09): 7 of 8 compress and pass the smoke test ([catalog-trials.md](catalog-trials.md)); `npm run validate:catalog` checks the catalog on Hugging Face; `npm run fetch:wikitext` gets the perplexity text.
- `npm run seed` fills the catalog with 8 models pinned to exact Hugging Face commits (safe to run again).
- Website: pipeline rail (Model → Device → Preflight → Run → Results); **Catalog** shows the real models with compression ladders; **Profiles** saves, edits and deletes device profiles through the API ("Use this computer's values" fills the form); **Job Setup** shows levels with estimated sizes, the licence box and **Run preflight**: 9 server checks (catalog, levels, profile, disk, RAM, licence, HF token, llama.cpp, job limit), each with a tick or a cross, reason, fix and code. After a passed preflight, **Start compression** creates a real job in the shared database ("waiting in the queue, position N").
- API: `/api/catalog`, `/api/catalog/:id`, `/api/profiles` (CRUD, own data only), `/api/system/health`, `/api/system/host-profile`, `POST /api/jobs/preflight`, `POST /api/jobs` (202), `GET /api/jobs`, `GET /api/jobs/:id`. Every error comes back as `{ code, message, hint }`.
- **Worker** (WP-11, on `sibghatullah`): `npm run dev:worker` takes queued jobs from the database and runs the real pipeline (or the fake one with `FAKE_PIPELINE=true`); status, stage, % and log lines appear through `GET /api/jobs/:id`.
- Both laptops use the shared **MongoDB Atlas** database (`MONGO_URI` in each local `.env`).
- `npm run install-all`, then `npm run dev` starts the API (port 8000) and the website (port 5173) on Windows.
- `npm test` (97 tests, in-memory MongoDB, no llama.cpp needed), `npm run build`, `npm run lint`, `npm run progress`; CI on every PR.

## What's next

- **Sibghatullah:** WP-11 PR into `main`, then WP-13 (time limits, clean-up, 2 GB disk reserve, `regression.js`).
- **Huzaifah:** WP-12 Job Progress page (needs WP-11 on `main`). Until then, run `npm run dev:worker` with `FAKE_PIPELINE=true` against a **local** MongoDB to see jobs move.

## Known issues

- On the model machine Node cannot resolve `mongodb+srv://` addresses; `.env` uses the standard `mongodb://host1,host2,host3/…` form of the Atlas string instead.
- Llama-3.2-1B (gated) needs `HF_TOKEN` in `.env` and the licence accepted on Hugging Face; without it the job stops with `E-HF-01`.
- **Run only ONE worker against the shared Atlas database.** Two workers never take the same job, but a fake worker on the web machine would "win" some real jobs and finish them with FAKE DATA. Real jobs: the worker on the model machine.
- A cancelled or failed job may leave half-made files in `data/artifacts/<jobId>/` until WP-13 adds the clean-up.
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
