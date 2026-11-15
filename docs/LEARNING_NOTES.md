# Learning notes

Simple explanations of the ideas behind PocketPrune, written as we learn them. Read the section
before starting the work package that needs it — and use it to prepare for the viva.

## Contents

1. [How the project is organised (WP-01)](#1-how-the-project-is-organised-wp-01)
2. [Environment variables and `.env` (WP-01)](#2-environment-variables-and-env-wp-01)
3. [Branches, pull requests and CI (WP-00 / WP-01)](#3-branches-pull-requests-and-ci-wp-00--wp-01)
4. [Language models, GGUF and llama.cpp (WP-02)](#4-language-models-gguf-and-llamacpp-wp-02)
5. [Quantization levels and the hand compression (WP-02)](#5-quantization-levels-and-the-hand-compression-wp-02)
   5b. [Running programs from Node: spawn, timeouts, mocking (WP-04)](#5b-running-programs-from-node-spawn-timeouts-mocking-wp-04)
   5c. [The pipeline, reporters, the fake pipeline and reproducibility (WP-06)](#5c-the-pipeline-reporters-the-fake-pipeline-and-reproducibility-wp-06)
   5d. [Checking the catalog, the fixed test text and temp folders (WP-09)](#5d-checking-the-catalog-the-fixed-test-text-and-temp-folders-wp-09)
6. [REST APIs, Express, MongoDB and Mongoose (WP-03)](#6-rest-apis-express-mongodb-and-mongoose-wp-03)
   6b. [React pages, components and the theme (WP-07)](#6b-react-pages-components-and-the-theme-wp-07)
   6c. [Pinned revisions and the catalog (WP-05)](#6c-pinned-revisions-and-the-catalog-wp-05)
7. [Preflight checks (WP-08)](#7-preflight-checks-wp-08)
8. [Background workers, heartbeats and cancelling (WP-11)](#8-background-workers-heartbeats-and-cancelling-wp-11)
   8b. [Polling: how the progress page stays live (WP-12)](#8b-polling-how-the-progress-page-stays-live-wp-12)
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

## 4. Language models, GGUF and llama.cpp (WP-02)

**What a language model file is.** A model like SmolLM2-135M is a big list of numbers called
**weights** (here 135 million of them). Generating text = doing lots of multiplications with those
weights to guess the next word (**token**), again and again. Bigger files → more RAM and slower.

**safetensors.** The format Hugging Face models are published in. It only holds numbers, so loading
it can't run hidden code (older `.bin` files could) — that's why we only download `*.safetensors`.

**GGUF.** llama.cpp's own format: one single file with the weights **and** the tokenizer and
settings. One file is easy to download, check (SHA-256) and run on any laptop.

**llama.cpp.** A free C++ program that runs language models on a normal CPU. We use five of its tools:

| Tool                    | What it does                                    |
| ----------------------- | ----------------------------------------------- |
| `convert_hf_to_gguf.py` | safetensors folder → one F16 GGUF file (Python) |
| `llama-quantize`        | F16 GGUF → smaller Q5_K_M / Q4_K_M GGUF         |
| `llama-completion`      | loads a file and writes text (our smoke test)   |
| `llama-bench`           | measures speed in tokens per second             |
| `llama-perplexity`      | measures quality on a fixed text (WikiText-2)   |

**Pinned version.** llama.cpp publishes a new release several times a day. We pin one tag
(**b12376**) so every number in the report comes from the same program. It is stored in `.env`
(`LLAMA_CPP_REF`) and in `D:/llama.cpp/VERSION`.

**Why Windows (decision 14 Nov 2026).** llama.cpp ships a ready-made Windows CPU build, so nothing
has to be compiled; both teammates use Windows; speed is practically the same as on Linux. On
Linux the same setup script builds the tag from source instead.

**`npm run setup:llamacpp`** (`scripts/setup-llamacpp.js`) does the whole install:

1. downloads the llama.cpp **source** at the tag → `D:/llama.cpp/src` (we need the Python
   converter from it),
2. downloads the **Windows CPU build** at the same tag → `D:/llama.cpp/bin` (`llama-quantize.exe`, …),
3. creates a **Python venv** → `D:/llama.cpp/venv` and installs the converter's packages + `hf`,
4. runs `llama-cli --version` to check it works, then writes `VERSION`.

A **venv** (virtual environment) is a private Python folder with its own packages, so llama.cpp's
exact package versions never clash with other Python projects on the laptop. We write no Python;
we only run the converter with it.

## 5. Quantization levels and the hand compression (WP-02)

**Quantization** = storing each weight with fewer bits. Think of rounding 3.14159265 to 3.14:
much shorter, almost the same value. The model gets smaller and faster and loses a little quality.

| Level      | Bits per weight (about) | Meaning                                                        |
| ---------- | ----------------------- | -------------------------------------------------------------- |
| **F16**    | 16                      | "Half precision" — the full-quality **baseline** we compare to |
| **Q8_0**   | 8.5                     | 8-bit, almost no quality loss (optional level)                 |
| **Q5_K_M** | 5.7                     | 5-bit "K-quant", **M**edium mix                                |
| **Q4_K_M** | 4.9                     | 4-bit "K-quant", **M**edium mix — the usual choice for laptops |

**K-quants** split weights into small blocks and store a scale per block, so each block is rounded
as accurately as possible. **\_M** means the most sensitive layers are kept at a higher level.

### The hand compression of SmolLM2-135M (what each command means)

```bash
# 1. Download only safetensors + tokenizer + config, at the pinned commit (REQ-2, REQ-11)
D:/llama.cpp/venv/Scripts/hf.exe download HuggingFaceTB/SmolLM2-135M-Instruct \
  --revision 12fd25f77366fa6b3b4b768ec3050bf629380bac \
  --include "*.safetensors" "*.json" "tokenizer*" --local-dir data/models/SmolLM2-135M-Instruct

# 2. Convert to one F16 GGUF file (REQ-12)
D:/llama.cpp/venv/Scripts/python.exe D:/llama.cpp/src/convert_hf_to_gguf.py \
  data/models/SmolLM2-135M-Instruct --outfile data/artifacts/SmolLM2-135M-Instruct-F16.gguf --outtype f16

# 3. Quantize: input file, output file, level
D:/llama.cpp/bin/llama-quantize.exe SmolLM2-135M-Instruct-F16.gguf SmolLM2-135M-Instruct-Q4_K_M.gguf Q4_K_M

# 4. Smoke test (REQ-13): fixed prompt, fixed seed, temperature 0, 32 tokens, CPU only
D:/llama.cpp/bin/llama-completion.exe -m SmolLM2-135M-Instruct-Q4_K_M.gguf \
  -p "The capital of France is" -n 32 --seed 42 --temp 0 -ngl 0 -no-cnv
```

- `--revision` = the exact commit, so we always get identical files.
- `--outtype f16` = write every weight as a 16-bit number.
- `-n 32` = write 32 tokens. `--seed 42` + `--temp 0` = no randomness, same output every run.
- `-ngl 0` = put zero layers on the GPU, so everything runs on the CPU and results are comparable.
- `-no-cnv` = plain "continue this text" mode, not an interactive chat. (In b12376 `llama-cli` is
  chat-only, so the one-shot smoke test uses `llama-completion`.)

Speed and quality were also measured (preview of WP-14 / WP-16):

```bash
llama-bench -m <file> -p 512 -n 128 -r 3 -ngl 0 -o json        # pp512 / tg128 speed, 3 runs
llama-perplexity -m <file> -f data/wikitext/wiki.test.raw -c 512 --chunks 100 -ngl 0
```

**Results** (i7-14700HX, Windows 11, llama.cpp b12376, 20 threads):

| File   | Size    | Prompt speed (pp512) | Generation (tg128) | Peak RAM | Perplexity |
| ------ | ------- | -------------------- | ------------------ | -------- | ---------- |
| F16    | 258 MiB | 2188 tok/s           | 105 tok/s          | 471 MiB  | 18.92      |
| Q5_K_M | 107 MiB | 1589 tok/s           | 191 tok/s          | 319 MiB  | 19.57      |
| Q4_K_M | 101 MiB | 974 tok/s            | 199 tok/s          | 320 MiB  | 19.87      |

What this teaches us (good viva points):

- **Quantized files are ~2.5× smaller**, not 3–4×. A tiny model has a huge vocabulary table
  (49 152 tokens × 576 numbers) that is kept at higher precision, so llama-quantize reports
  6.2–6.6 bits per weight here. Bigger models get closer to the textbook ratio.
- **Generation got ~1.9× faster**, because writing text is limited by how fast weights are read
  from memory — smaller weights, faster reading.
- **Prompt processing got slower**, because reading a long prompt is limited by calculation, and
  quantized weights must first be "unpacked". This is why we measure both speeds.
- **Quality dropped only a little:** perplexity +3.5 % (Q5_K_M) and +5.0 % (Q4_K_M) vs F16 —
  under the 10 % quality guard of the recommender.
- **Peak RAM** is the Windows "peak working set" while generating 128 tokens (context 4096). It
  includes the context memory, so it doesn't shrink as much as the file.

**Perplexity** in one line: how "surprised" the model is by real text. Lower = better. 18.9 means
the model is, on average, as unsure as picking among ~19 equally likely next tokens. (Full notes in
WP-16.)

## 5b. Running programs from Node: spawn, timeouts, mocking (WP-04)

In WP-02 we typed the llama.cpp commands by hand. WP-04 lets **Node run them for us**, which is
what the worker will do for every job.

**Child process.** A program started by another program. Node's `spawn(program, args)` starts
`llama-quantize.exe` as a child, and Node can read everything it prints while it runs.

**Why no shell.** A shell (cmd / bash) reads one long text line and splits it into a program and
arguments itself. If a model name contained `; del *`, a shell would run that as a second command
— this is called **command injection**. We give `spawn` an **array** of arguments and no shell,
so every argument is passed exactly as written and nothing extra can ever run:

```js
runCommand(toolPath('llama-quantize'), [f16File, outFile, 'Q4_K_M']); // array, no shell
```

A test proves it: the argument `model; echo hacked & del x` arrives at the program as plain text.

**Streams and lines.** A running program prints in small pieces (chunks). `runCommand` joins
them, cuts them into lines and calls `onLine(line)` for each — later each line becomes a job log
entry on the Progress page. Only the last 200 lines are kept in memory.

**Timeout.** Every command gets a time limit from `.env` (convert 30 min, quantize 20, smoke 2…).
If it is still running when the timer fires, `runCommand` stops it and reports `E-TIME-01`, so a
stuck tool can never block the worker forever.

**Exit code.** When a program finishes it returns a number: `0` = success, anything else = error.
`runCommand` just reports it; `llamacpp.js` decides what it means (`E-CONV-01`, `E-QNT-01`, or
"smoke test failed").

**Adapter.** `llamacpp.js` is the only file that knows llama.cpp's flags. If a new llama.cpp
version renames a flag, we change one file — the pipeline doesn't care.

**Secrets in the environment, not the arguments.** The Hugging Face token is passed as the
environment variable `HF_TOKEN`. Arguments are written to the job log; environment variables are
not, so the token never leaks into a log or the database.

**Mocking.** CI has no llama.cpp and no internet. So in tests we replace `runCommand` with a fake
(`vi.mock`) that returns whatever we choose (`{ code: 1 }` = "the tool failed"). Then we check
two things: that the **right command** was built, and that our code **reacts correctly** to each
result. `runCommand` itself is tested with tiny real Node scripts instead.

**Reuse.** After a complete download, `downloader.js` writes a small file
`.pocketprune-revision` with the commit hash. Next time, if that file says the same revision, the
download is skipped (seconds instead of minutes).

## 5c. The pipeline, reporters, the fake pipeline and reproducibility (WP-06)

**Pipeline** = the WP-04 commands chained in a fixed order, for one job:

```text
DOWNLOADING → CONVERTING (F16) → QUANTIZING (each level) → VALIDATING (smoke test each file)
```

Each stage has rules (CLAUDE.md §7.2):

- **Convert fails → the job stops.** Without the F16 file nothing can be quantized.
- **One level fails → the others continue.** If Q5_K_M breaks we still deliver Q4_K_M. The
  half-written file of the failed level is deleted.
- **No quantized file passes the smoke test → `E-VAL-01`.** A job with no usable file is a failure.
- Every file gets its **size, SHA-256 and time** (REQ-14).

Benchmarks, perplexity and the recommendation are added to the same pipeline in WP-14 / 16 / 18.

**Reporter.** The pipeline never prints or writes to MongoDB itself. It only calls
`report.stage('QUANTIZING', 'Quantizing to Q4_K_M')` and `report.log('…')`. Who listens decides
where it goes:

| Reporter            | Used by            | Where it goes                                                    |
| ------------------- | ------------------ | ---------------------------------------------------------------- |
| `consoleReporter()` | `cli.js`           | The terminal — so the pipeline runs without a database (REQ-16)  |
| `dbReporter(job)`   | the worker (WP-11) | `Job.status / stage / progressPct` + one `JobEvent` per log line |

This is why the same pipeline can be tested, run by hand and run by the worker without changes.

**CLI** (command-line interface): `npm run pipeline -- --model HuggingFaceTB/SmolLM2-135M-Instruct --levels Q5_K_M,Q4_K_M`
runs the whole pipeline in the terminal and prints a table of the files.

**Fake pipeline** (temporary, removed in WP-20). `fakePipeline.js` has the same
`runPipeline(job, report)` but runs no tools: it waits ~2.5 s per stage, makes tiny placeholder
files, and returns our **real WP-02 numbers** (scaled to the model's size) with `fake: true`.
Huzaifah can build the Progress and Results pages on a laptop without llama.cpp; the website shows
a "FAKE DATA" badge. Run it with `npm run pipeline -- --fake` or `FAKE_PIPELINE=true` in `.env`.

**Reproducibility and the model-name bug we found.** The SRS says: same inputs → identical
SHA-256. Our first CLI files had different checksums from the WP-02 hand-made files, although the
weights were byte-for-byte the same. The difference was inside the file's **metadata**: the
converter writes `general.name` from the **download folder name** (`HuggingFaceTB__SmolLM2…` vs
`SmolLM2…`). Fix: always pass `--model-name SmolLM2-135M-Instruct`. After the fix, two separate
runs gave identical SHA-256 for F16, Q5_K_M and Q4_K_M. (Good viva example of why checksums are
useful: they caught a difference we could not see.)

## 5d. Checking the catalog, the fixed test text and temp folders (WP-09)

**Checking a model without downloading it.** Hugging Face has a free JSON API:
`https://huggingface.co/api/models/<repo>/revision/<commit>` returns the file list, whether the
model is gated, and `safetensors.total` — the **exact number of weights**, read from the file
headers. `npm run validate:catalog` asks this for every catalog model and checks: the commit
exists, there are `.safetensors` files (never `.bin` — those can run code when loaded), the model
is ≤ 4 B parameters, our `paramsBillion` is within 3 %, and `gated` matches. It takes seconds,
so it can be re-run any time a model owner changes something.

**Why one fixed test text (WikiText-2).** Perplexity (WP-16) is "how surprised the model is by
real text". It is only comparable if every file is measured on the **same** text. So
`npm run fetch:wikitext` downloads `wiki.test.raw` and checks its **SHA-256**; if even one byte
were different, the script stops instead of quietly measuring on another text.

**Temp folders.** Programs write scratch files to the folder named by the `TMP`/`TEMP`
(Windows) or `TMPDIR` (Linux) variable — on Windows that is on C:. `runCommand` sets all three to
`data/tmp` for every tool it starts, so big scratch files stay on the data drive.

**What the trials showed.**

| Model (params)      | F16 → Q4_K_M (MiB) | Whole CLI run |
| ------------------- | ------------------ | ------------- |
| SmolLM2-360M (0.36) | 692 → 258          | 2.4 min       |
| Qwen2.5-0.5B (0.49) | 948 → 379          | 3.2 min       |
| TinyLlama (1.1)     | 2099 → 637         | 7.3 min       |
| Qwen2.5-1.5B (1.54) | 2950 → 940         | 10 min        |
| SmolLM2-1.7B (1.71) | 3266 → 1007        | 12 min        |
| Phi-3.5-mini (3.82) | 7289 → 2286        | 26 min        |

Q4_K_M is roughly **⅓ of F16** for every model — about 4.5–5 bits per weight instead of 16.
Small models shrink a bit less because their vocabulary table is a big share of the weights and
llama.cpp keeps some tensors at higher precision. Time grows with size, mostly from download and
conversion. The gated Llama-3.2 stopped with `E-HF-01`: the error we designed, with a fix hint.

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

## 6b. React pages, components and the theme (WP-07)

**Component** = a function that returns what to show. `Button`, `Card`, `Badge` are tiny
components; a page (`CatalogPage`) is a big component made of small ones. Props are its inputs:

```jsx
<Button variant="secondary" icon={Plus} onClick={openNew}>
  Add device
</Button>
```

**State** (`useState`) is data that, when it changes, redraws the component — e.g. the form values
on the Profiles page. **Effects** (`useEffect`) run after drawing — we use one (inside `useLoad`)
to fetch the catalog when the page opens.

**Context** shares state between pages without passing props through every level. The job draft
(chosen model, device, levels) lives in `JobDraftContext`, so the Catalog page can set the model
and the "Your job" card on every page can show it.

**React Router** maps addresses to pages: `/catalog` → `CatalogPage`. `<Link to="/profiles">`
changes page without reloading the browser.

**Design tokens.** Instead of writing `#2F5DE1` in fifty places, every colour and size has a name
in `theme.js` (`colors.primary`). CSS reads them as variables (`var(--color-primary)`). Change the
token once and the whole site follows — and the mobile app reads the same file.

**Estimated sizes.** A weight in F16 takes 16 bits. Q4_K_M stores about 4.9 bits per weight on
average, so the file is roughly 4.9 / 16 ≈ 31 % of F16. Small models keep some parts at higher
precision, so real files are a little bigger — that's why the site writes "≈" until a job measures
the real size.

## 6c. Pinned revisions and the catalog (WP-05)

A Hugging Face model is a Git repository. Its owner can push new weights at any time, so
"download `Qwen/Qwen2.5-0.5B-Instruct`" might give different files next month — and different
benchmark numbers. A **revision** is one exact commit, e.g.
`7ae557604adf67be50417f59c2c2f167def9a775`. Downloading at that revision always gives the same
bytes, so results can be repeated (REQ-2).

We found each hash with the public API: `https://huggingface.co/api/models/<repo>` → the `sha`
field, plus `safetensors.total` for the parameter count.

**F16 size** = parameters × 2 bytes, because F16 stores each weight in 16 bits = 2 bytes.
135 M parameters × 2 = 270 MB ≈ 257 MiB (what the site shows as MB).

**Why only ≤ 4 B parameters?** A 4 B model is ~8 GB in F16; converting needs about 1.2 × that in
RAM and ~3 × on disk. Bigger models would not fit a normal student laptop (REQ-3).

**Upsert** = "update if it exists, insert if not". `npm run seed` uses it so running the seed twice
never creates duplicates.

**Own data only.** The profile queries always filter by `user: req.user._id`. If you ask for
someone else's profile id, the query finds nothing and the API answers 404, so it doesn't even
reveal that the profile exists.

## 7. Preflight checks (WP-08)

**Preflight** is a checklist that runs _before_ a job, like a pilot's checklist before take-off.
Downloading and converting a model takes minutes and gigabytes; if the disk is too small we want
to say so in one second, not after ten minutes of work.

The server runs 9 checks and shows **all** of them at once (not only the first failure):

| Check          | Rule                                         | Error if it fails |
| -------------- | -------------------------------------------- | ----------------- |
| Model          | active in the catalog                        | `E-CAT-01`        |
| Levels         | at least one of Q5_K_M, Q4_K_M, Q8_0         | `E-LVL-01`        |
| Device profile | exists and is yours                          | `E-NOTFOUND-01`   |
| Disk           | free ≥ 3 × F16 + all quantized files + 2 GB  | `E-DISK-01`       |
| RAM            | free ≥ 1.2 × F16                             | `E-RAM-01`        |
| Licence        | the box is ticked                            | `E-LIC-01`        |
| Hugging Face   | gated model → `HF_TOKEN` is set              | `E-HF-01`         |
| llama.cpp      | the pinned build (b12376) is installed       | `E-TOOL-01`       |
| Jobs           | fewer than 2 of your jobs waiting or running | `E-LIMIT-01`      |

**Why 3 × F16 on disk?** During a job three big things exist at once: the downloaded weights
(about the F16 size), the F16 GGUF file, and room for the converter to work. Example for
SmolLM2-135M (F16 ≈ 259 MB) with Q5_K_M + Q4_K_M: 3 × 259 + 92 + 79 + 2048 ≈ 2.9 GB.

**Why 1.2 × F16 RAM?** The converter holds the whole model in memory, plus a bit extra.

**Disk and RAM are measured on the server**, because the server (the model machine) does the
compression — not on the device in the profile. The device profile is used later, by the
recommender, to pick the file that fits _that_ device.

**Fake pipeline:** with `FAKE_PIPELINE=true` (the web machine has no llama.cpp), the llama.cpp
check is shown as _skipped_ instead of failing.

### 7b. Jobs, queues and 202 Accepted (WP-10)

- A **job** is a to-do note in the database: "compress this model to these levels". Creating it
  takes milliseconds; doing it takes minutes. So the API answers right away with **`202
Accepted`** — "got it, the work happens later" — instead of `200`/`201`.
- The **queue** is simply all jobs with status `QUEUED`, oldest first. Queue position = 1 + the
  number of queued jobs created before yours.
- The website then **asks again every few seconds** (`GET /api/jobs/:id`) to show progress — this
  is called _polling_ and arrives with the Progress page (WP-12).
- **Preflight runs twice**: once when you click "Run preflight" (to show you the list) and again
  when the job is created (so a script calling the API directly can't skip the checks).

## 8. Background workers, heartbeats and cancelling (WP-11)

**Why a separate program?** Compressing a model takes minutes. A web request must answer in
milliseconds, so the API only _saves_ the job (`QUEUED`, answer `202`), and a second Node program —
the **worker** (`npm run dev:worker`) — does the slow work in the background. Both talk only
through MongoDB: the API writes jobs, the worker reads and updates them, the website reads them.

```text
Website ──POST /api/jobs──▶ API ──saves QUEUED job──▶ MongoDB ◀──picks + updates── Worker ──▶ llama.cpp
   ▲                                                    │
   └───────────── GET /api/jobs/:id every 2 s ──────────┘   (status, stage, %, log lines)
```

**Polling.** The idle worker asks the database "any queued job?" every 3 s. Simple, and with one
job at a time we need nothing fancier (no Redis, no message queue).

**Atomic pick-up.** "Find the oldest queued job" and "mark it DOWNLOADING" happen in **one**
database command (`findOneAndUpdate`). If two workers ask at the same moment, MongoDB gives the job
to only one of them; the other gets nothing. (A separate find, then update, could give both the
same job.) There is a test for exactly this.

**Heartbeat and recovery.** While a job runs, the worker writes `heartbeatAt = now` every 10 s —
"I'm still alive". If the worker crashes or the laptop sleeps, the heartbeat stops. Before each
pick, the worker looks for jobs that say "running" but whose heartbeat is older than **60 s** and
marks them `FAILED` with **E-WORKER-01** ("the worker restarted") so the user can retry. Ctrl+C
marks the running job failed at once.

**Cancelling between stages.** The website (later) only sets `cancelRequested: true` on the job.
Before each new stage the worker re-reads that flag; if it is set, the pipeline stops there and the
job becomes `CANCELLED`. Stopping a tool in the _middle_ of a stage comes in WP-22.

**Every ending is saved.** `COMPLETED` (with the variants), `FAILED` (with the error code, message
and the "how to fix" hint in the log) or `CANCELLED`. An unexpected crash becomes `E-SERVER-01`
instead of stopping the worker — it just takes the next job.

**What we learned testing it for real.** Stopping a background terminal does not always stop the
Node program inside it: an old worker kept running, took the next job and failed it. Check
running processes (`Get-Process node`) and never run two workers with different code. Running two
_identical_ workers is safe — that is what the atomic pick-up is for.

### 8b. Polling: how the progress page stays live (WP-12)

The worker writes progress into the database; the website can't be "told" about it. So the page
**asks again every 2 seconds** — "how is job X doing?" — and redraws with the answer. This is
called **polling**.

- **Stop when done:** once the job is `COMPLETED`, `FAILED` or `CANCELLED`, the page stops asking.
- **Pause when hidden:** if the browser tab isn't visible, it skips its turns (no wasted requests).
- **Cost:** one small request every 2 s per open page — fine for a few users. Big sites use
  _WebSockets_ (the server pushes updates), but polling is much simpler to build and explain.

```js
// usePolling(fetcher, intervalMs, stopWhen)
const { data: job } = usePolling(
  () => getJob(id),
  2000,
  (j) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)
);
```
