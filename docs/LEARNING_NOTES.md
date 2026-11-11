# Learning notes

Simple explanations of the ideas behind PocketPrune, written as we learn them. Read the section
before starting the work package that needs it — and use it to prepare for the viva.

## Contents

1. [How the project is organised (WP-01)](#1-how-the-project-is-organised-wp-01)
2. [Environment variables and `.env` (WP-01)](#2-environment-variables-and-env-wp-01)
3. [Branches, pull requests and CI (WP-00 / WP-01)](#3-branches-pull-requests-and-ci-wp-00--wp-01)
4. Language models, GGUF and llama.cpp — _added in WP-02 (Sibghatullah)_
5. Quantization levels: F16, Q8_0, Q5_K_M, Q4_K_M — _WP-02_
6. [REST APIs, Express, MongoDB and Mongoose (WP-03)](#6-rest-apis-express-mongodb-and-mongoose-wp-03)
7. Preflight checks — _WP-08_
8. Background workers and polling — _WP-11 / WP-12_
9. Benchmarking: tokens per second and peak RAM — _WP-14_
10. Perplexity — _WP-16_
11. The recommendation rules — _WP-18_
12. Passwords and JWT login — _WP-21_

---

## 1. How the project is organised (WP-01)

PocketPrune is one Git repository with three parts that run as separate programs:

| Part    | Folder                   | Runs as                    | Talks to              |
| ------- | ------------------------ | -------------------------- | --------------------- |
| Website | `frontend/`              | Vite dev server, port 5173 | the API only          |
| API     | `backend/` (`server.js`) | Node process, port 8000    | MongoDB               |
| Worker  | `backend/worker/`        | a second Node process      | MongoDB and llama.cpp |

Each part has its own `package.json` (its own libraries). The **root** `package.json` only holds
shortcuts, so you can type `npm run dev` once instead of opening two terminals.

**npm scripts** are named commands in `package.json`. `npm run dev` in the root runs
`concurrently "npm run dev --prefix backend" "npm run dev --prefix frontend"`:

- `--prefix backend` means "run this inside the backend folder".
- `concurrently` runs both at the same time in one terminal, with coloured `[api]` and `[web]`
  labels. Press `Ctrl+C` once to stop both.

**Why not one big program?** Compressing a model takes minutes. If the API did that itself, the
website would freeze for everyone. Splitting the slow work into a worker keeps the API instant.

## 2. Environment variables and `.env` (WP-01)

Some values differ per laptop (database address, llama.cpp folder) or are secret (passwords,
tokens). They must **not** be written in the code or committed to GitHub.

- They are **environment variables**: named values the program reads at start-up, e.g.
  `process.env.API_PORT`.
- To avoid typing them every time, we write them in a file called `.env` in the repo root.
  The `dotenv` library reads that file when `server.js` starts.
- `.env` is listed in `.gitignore`, so Git never uploads it.
- `.env.example` **is** committed: same names, safe example values and a comment for each. A new
  teammate copies it to `.env` and fills in real values.

```js
// server.js
dotenv.config({ path: path.join(import.meta.dirname, '..', '.env') });
const port = process.env.API_PORT || 8000; // use 8000 if API_PORT is not set
```

## 3. Branches, pull requests and CI (WP-00 / WP-01)

- **`main`** always holds working, reviewed code. Nobody pushes to it directly.
- Each work package gets its own **branch**, e.g. `feat/wp03-backend-core`. You commit there in
  small steps.
- When the WP is done, you push the branch and open a **pull request (PR)**: "please add these
  changes to `main`". The other teammate **reviews** it (reads it, leaves a comment, approves) and
  **merges** it.
- **CI (Continuous Integration)** is a robot on GitHub (GitHub Actions) that runs on every PR:
  installs everything, runs the linter, the tests and the website build. A green tick means the
  change does not break anything; a red cross must be fixed before merging.
- Commit messages follow `type(area): what changed (#issue)`, e.g.
  `feat(api): add catalog routes (#6)`. Writing `Closes #6` in the PR closes the issue on merge.

Full step-by-step commands: [GIT_GUIDE.md](GIT_GUIDE.md).

## 6. REST APIs, Express, MongoDB and Mongoose (WP-03)

**REST API.** The website and the app never touch the database. They send HTTP requests to
addresses like `GET /api/system/health` and get JSON back. `GET` reads, `POST` creates, `PUT`
updates, `DELETE` removes. The **status code** says how it went: `200` OK, `201` created,
`202` accepted (job queued), `400` your input is wrong, `401` not logged in, `404` not found,
`409` conflict (e.g. not enough disk), `429` too many, `500` server bug.

**Express** turns a request into a call to our function:

```js
router.get('/health', getHealth); // GET /api/system/health → getHealth(req, res)
```

**Middleware** is a function that runs _before_ the route, and can stop the request or add
something to it. `protect` adds `req.user`; if it fails, it calls `next(err)` and Express jumps
straight to the **error handler** — one place that formats every error the same way.

**MongoDB** stores **documents** (JSON-like objects) in **collections** (`users`, `jobs`, …).
There are no tables or joins; a job can hold its files and metrics inside itself.

**Mongoose** adds a **schema** on top: which fields exist, their types, which are required, which
values are allowed. Wrong data is rejected _before_ it reaches the database:

```js
preference: { type: String, enum: ['quality', 'speed', 'smallest', 'balanced'] }
// saving preference: 'fastest' → ValidationError → our handler replies 400 E-INPUT-01
```

`ref: 'User'` stores just the other document's id; `.populate()` can fetch it later.
`timestamps: true` adds `createdAt` and `updatedAt` automatically.

**Why error codes?** "Something went wrong" helps nobody. `E-DISK-01 — Not enough free disk
space. Free some space or choose fewer levels.` tells the user what failed, why, and what to do —
and the code can be looked up on the Help page.

**Testing with an in-memory database.** `mongodb-memory-server` starts a real MongoDB in memory
for the tests and throws it away afterwards, so tests are fast, repeatable and never touch the
shared Atlas data.
