# Project status

> Updated at the end of every session. Run `npm run progress` and paste its summary here.

```
PocketPrune progress: 27 % merged
Phase 1 ████████████████████ 25/25 %   Phase 2 ███░░░░░░░░░░░░░░░░░ 2/15 %
Huzaifah: 12.5 %  ·  Sibghatullah: 14.5 %
Next checkpoint: Mid-term demo (40 %) on 2026-12-07 (22 days) — 13 % to go: WP-08, WP-10, WP-11, WP-12, WP-13
Ready to start: WP-08 (H)
```

**Phase 1 complete — milestone `v0.1.0-M1`** ([release notes](release-notes/M1.md)).

_Last updated: 15 Nov 2026 — Sibghatullah (WP-00 done, milestone M1)._

## Work packages

Status values: `not-started` · `in-progress` · `in-review` · `merged`. Weights and dependencies live in
[progress.json](progress.json).

| WP                                  | Title                                    | Owner | Status      | Branch / PR | Notes                                                                                                             |
| ----------------------------------- | ---------------------------------------- | ----- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| WP-00                               | GitHub setup + shared Atlas database     | Both  | merged      | —           | Repo, labels, milestones, issues, collaborator; Atlas M0 shared + seeded; no branch protection (needs GitHub Pro) |
| WP-01                               | Project setup                            | H     | merged      | #38         | Skeletons, scripts, docs, CI                                                                                      |
| WP-02                               | llama.cpp setup + first hand compression | S     | merged      | #44         | Windows 11, llama.cpp b12376; SmolLM2-135M compressed by hand (3/3 smoke tests pass); revision OK                 |
| WP-03                               | Backend core                             | H     | merged      | #39         | Models, errors, health, host profile                                                                              |
| WP-04                               | Command runner                           | S     | merged      | #45         | runCommand, llamacpp, downloader + 22 tests; real run on SmolLM2-135M passes                                      |
| WP-05                               | Catalog + profiles API                   | H     | merged      | #42         | Catalog, profiles CRUD, seed with pinned revisions                                                                |
| WP-06                               | CLI pipeline + fake pipeline             | S     | merged      | #46         | pipeline.js + cli.js + fakePipeline.js; CLI makes 3 valid, reproducible files                                     |
| WP-07                               | Website foundation                       | H     | merged      | #41         | Pipeline-rail layout, theme, components, Catalog/Profiles/Job Setup                                               |
| WP-09                               | Catalog trials                           | S     | merged      | #47         | 7/8 models compress + pass smoke tests; Llama-3.2 needs HF token; validate-catalog 8/8 OK                         |
| WP-08, WP-10 – WP-32, WP-M1 – WP-M4 | see [progress.json](progress.json)       |       | not-started |             | Phases 2–5                                                                                                        |

## What works now

- **llama.cpp b12376** on Windows (`npm run setup:llamacpp`); SmolLM2-135M compressed by hand (WP-02).
- **Node runs llama.cpp** (WP-04): `downloadModel`, `convertToF16`, `quantize`, `smokeTest` with time limits and log lines.
- **CLI pipeline** (WP-06): `npm run pipeline` compresses a catalog model end to end in the terminal; `--fake` runs the fake pipeline (no llama.cpp).
- **Every catalog model tried** (WP-09): 7 of 8 compress and pass the smoke test ([catalog-trials.md](catalog-trials.md)); `npm run validate:catalog` checks the catalog on Hugging Face; `npm run fetch:wikitext` gets the perplexity text.
- `npm run seed` fills the catalog with 8 models pinned to exact Hugging Face commits (safe to run again).
- Website: pipeline rail (Model → Device → Preflight → Run → Results); **Catalog** shows the real models with compression ladders; **Profiles** saves, edits and deletes device profiles through the API ("Use this computer's values" fills the form); **Job Setup** shows levels with estimated sizes, the preflight checklist and the licence box.
- API: `/api/catalog`, `/api/catalog/:id`, `/api/profiles` (CRUD, own data only), `/api/system/health`, `/api/system/host-profile`. Every error comes back as `{ code, message, hint }`.
- `npm run install-all`, then `npm run dev` starts the API (port 8000) and the website (port 5173) on Windows.
- `npm test` (64 tests, in-memory MongoDB, no llama.cpp needed), `npm run build`, `npm run lint`, `npm run progress`; CI on every PR.

## What's next

- **Huzaifah:** WP-08 Preflight (ready now) — makes "Run preflight" on Job Setup work.
- **Sibghatullah:** WP-11 (worker) once WP-10 is merged; meanwhile WP-13 groundwork can be planned.
- **Huzaifah:** put the shared Atlas `MONGO_URI` in your `.env` (sent privately) and check your IP is allowed in Atlas → Network Access.

## Known issues

- On the model machine Node cannot resolve `mongodb+srv://` addresses; `.env` uses the standard `mongodb://host1,host2,host3/…` form of the Atlas string instead.
- Llama-3.2-1B (gated) needs `HF_TOKEN` in `.env` and the licence accepted on Hugging Face; without it the job stops with `E-HF-01`.
- "Run preflight" and "Start compression" are disabled until WP-08 / WP-10.
- Branch protection on `main` is not active (private repo needs GitHub Pro / Student Pack). Follow the rule by hand.

## How to run what exists

See the [README](../README.md#run-it). Short version:

```bash
npm run install-all
copy .env.example .env      # Windows (cp on Linux/WSL)
npm run seed
npm run dev
```

You need a MongoDB to connect to: the shared Atlas string in `MONGO_URI`, or a local MongoDB.
