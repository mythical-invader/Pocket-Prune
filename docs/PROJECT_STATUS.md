# Project status

> Updated at the end of every session. Run `npm run progress` and paste its summary here.

```
PocketPrune progress: 3 % merged (in review: 3 %, in progress: 1 %)
Phase 1 ██░░░░░░░░░░░░░░░░░░ 3/25 %
Huzaifah: 3 %  ·  Sibghatullah: 0 %
Next checkpoint: Phase 1 (M1) on 2026-11-22 (11 days) — 22 % to go
Ready to start: WP-07 (H)
Waiting: WP-02 (S) needs WP-00 · WP-05 (H) needs WP-03 (in review)
```

_Last updated: 11 Nov 2026 — Huzaifah (WP-03)._

## Work packages

Status values: `not-started` · `in-progress` · `in-review` · `merged`. Weights and dependencies live in
[progress.json](progress.json).

| WP                           | Title                                    | Owner | Status      | Branch / PR                      | Notes                                                                                               |
| ---------------------------- | ---------------------------------------- | ----- | ----------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| WP-00                        | GitHub setup + shared Atlas database     | Both  | in-progress | —                                | Repo, labels, milestones, issues done; collaborator, Atlas left; branch protection needs GitHub Pro |
| WP-01                        | Project setup                            | H     | merged      | #38                              | Skeletons, scripts, docs, CI                                                                        |
| WP-02                        | llama.cpp setup + first hand compression | S     | not-started | `chore/wp02-llamacpp-setup`      |                                                                                                     |
| WP-03                        | Backend core                             | H     | in-review   | `feat/wp03-backend-core`         | Models, errors, health, host profile                                                                |
| WP-04                        | Command runner                           | S     | not-started | `feat/wp04-command-runner`       | Needs WP-02                                                                                         |
| WP-05                        | Catalog + profiles API                   | H     | not-started | `feat/wp05-catalog-profiles-api` | Needs WP-03                                                                                         |
| WP-06                        | CLI pipeline + fake pipeline             | S     | not-started | `feat/wp06-cli-pipeline`         | Needs WP-04                                                                                         |
| WP-07                        | Website foundation                       | H     | not-started | `feat/wp07-website-foundation`   | Ready to start                                                                                      |
| WP-08 – WP-32, WP-M1 – WP-M4 | see [progress.json](progress.json)       |       | not-started |                                  | Phases 2–5                                                                                          |

## What works now

- `npm run install-all`, then `npm run dev` starts the API (port 8000) and the website (port 5173) on Windows.
- The API connects to MongoDB at start-up (local or Atlas via `MONGO_URI`) and stops with a clear message if it can't.
- `GET /api/system/health` reports database status, llama.cpp tag and demo mode.
- `GET /api/system/host-profile` returns this computer's RAM, free disk and CPU threads.
- All Mongoose models exist; every error comes back as `{ code, message, hint }`.
- `npm test` (20 tests, in-memory MongoDB), `npm run build`, `npm run lint`, `npm run progress`; CI on every PR.

## What's next

- **Huzaifah:** WP-07 Website foundation (ready now), then WP-05 Catalog + profiles API after WP-03 merges.
- **Sibghatullah:** join the repo, review WP-03, start WP-02 llama.cpp setup on WSL2.
- **Both:** finish WP-00 — MongoDB Atlas M0 cluster and shared `MONGO_URI`.

## Known issues

- Branch protection on `main` is not active (private repo needs GitHub Pro / Student Pack). Follow the rule by hand.

## How to run what exists

See the [README](../README.md#run-it). Short version:

```bash
npm run install-all
copy .env.example .env      # Windows (cp on Linux/WSL)
npm run dev
```

You need a MongoDB to connect to: the shared Atlas string in `MONGO_URI`, or a local MongoDB.
