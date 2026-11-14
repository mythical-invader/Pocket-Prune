# Development log

Newest entry first. Each entry: who, which WP, what was built, files touched, decisions and why,
problems, next step.

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
