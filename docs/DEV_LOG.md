# Development log

Newest entry first. Each entry: who, which WP, what was built, files touched, decisions and why,
problems, next step.

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
