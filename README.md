# PocketPrune — Edge LLM Compression & Deployment Toolkit

PocketPrune takes a small open-source language model from Hugging Face and, in the background,
checks your machine, downloads the model, converts it to GGUF with llama.cpp, quantizes it to
**Q5_K_M** and **Q4_K_M**, smoke-tests each file, measures size, speed, peak RAM and perplexity,
and **recommends the best file for your device** with simple, explainable rules.

> Status: early development — see [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) or run
> `npm run progress`.

## Tech stack

MongoDB + Mongoose · Node.js 22 + Express · React + Vite · a separate Node worker process ·
llama.cpp (pinned release) · Vitest + supertest · GitHub Actions.

## Which machine runs what

| Machine       | Who          | OS                                       | Runs                                                                               |
| ------------- | ------------ | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Model machine | Sibghatullah | Ubuntu 22.04 via WSL2 (or native Ubuntu) | llama.cpp, the worker, real compressions and benchmarks; API + website when needed |
| Web machine   | Huzaifah     | Windows                                  | API + website (no llama.cpp or WSL2 needed)                                        |

Both use one shared **MongoDB Atlas M0** database during development (same `MONGO_URI`).

## Install

You need **Node.js 22 LTS or newer** and **Git**.

### Windows (web machine)

```bash
git clone https://github.com/mythical-invader/Pocket-Prune.git
cd Pocket-Prune
npm run install-all
copy .env.example .env
```

Open `.env` and set `MONGO_URI` to the shared Atlas connection string (ask your teammate).

### Ubuntu / WSL2 (model machine)

```bash
# Inside Ubuntu (WSL2). Install Node 22 via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install 22
git clone https://github.com/mythical-invader/Pocket-Prune.git
cd Pocket-Prune
npm run install-all
cp .env.example .env
```

Keep the repo inside the Linux file system (e.g. `~/Pocket-Prune`), not under `/mnt/c/...` — it is
much faster. llama.cpp setup (`scripts/build-llamacpp.sh`) arrives in WP-02.

## Run it

| Command                           | What it starts                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`                     | API (http://localhost:8000/api) + website (http://localhost:5173) — works on Windows |
| `npm run dev:worker`              | The background worker (model machine)                                                |
| `npm run dev:all`                 | API + website + worker together (model machine)                                      |
| `npm run seed`                    | Fill the database with catalog models and demo users (from WP-05)                    |
| `npm test`                        | Backend tests                                                                        |
| `npm run build`                   | Production build of the website                                                      |
| `npm run lint` / `npm run format` | Check / fix code style                                                               |
| `npm run progress`                | Project % done, per phase and per person, and who is waiting on whom                 |

Open http://localhost:5173 — the page should say **API: connected**.

## Project layout

```text
backend/    Express API (app.js, server.js), worker/, tests/
frontend/   React website (Vite)
scripts/    Helper scripts (progress.js; llama.cpp build script from WP-02)
docs/       Status, dev log, how it works, learning notes, Git guide, API, SRS, roadmap
deploy/     Docker files (WP-26)
data/       Model files and downloads — git-ignored, created at run time
```

## Documentation

- [Project status](docs/PROJECT_STATUS.md) · [Dev log](docs/DEV_LOG.md) · [How it works](docs/HOW_IT_WORKS.md)
- [Learning notes](docs/LEARNING_NOTES.md) · [Git guide](docs/GIT_GUIDE.md) · [API](docs/API.md)
- [SRS](docs/PocketPrune_SRS.docx) · [Implementation roadmap](docs/PocketPrune_Implementation_Roadmap.pdf)
- Project rules for the AI coding assistant: [CLAUDE.md](CLAUDE.md)

## Pinned tool versions

| Tool      | Version                                          |
| --------- | ------------------------------------------------ |
| Node.js   | 22 LTS (Node 20 is end-of-life since April 2026) |
| llama.cpp | _release tag recorded in WP-02_                  |
