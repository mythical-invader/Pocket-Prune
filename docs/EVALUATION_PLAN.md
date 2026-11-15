# Evaluation plan — what makes PocketPrune an FYP, not a wrapper

Agreed 15 Nov 2026 (Huzaifah). These additions are **not new work packages** and change **no
weights**: each one is an extra "done when" item inside a Phase 3 WP that already exists. Together
they become the **Evaluation chapter** of the final report and one slide in the viva.

Rule: nothing here starts before the mid-term (7 Dec). Phase 2 comes first.

| #   | Addition                                     | Goes into                                | Owner                        | Priority |
| --- | -------------------------------------------- | ---------------------------------------- | ---------------------------- | -------- |
| E1  | Size estimates checked against real files    | WP-20 (report) + WP-15 (site)            | S + H                        | Must     |
| E2  | Task accuracy (HellaSwag) next to perplexity | WP-16                                    | S (+ H shows it in WP-15/17) | Must     |
| E3  | Recommender compared with simple baselines   | WP-18 (tests) + WP-20 (report)           | S                            | Must     |
| E4  | Same benchmark on both laptops               | WP-20                                    | S + H                        | Should   |
| E5  | Q4_K_M with vs without an importance matrix  | WP-16 (option) + WP-20 (report)          | S                            | Could    |
| E6  | "Compare outputs" box (F16 vs Q4 answer)     | after M4 (could-have in CLAUDE.md §12.0) | H                            | Could    |

---

## E1 — Are our size estimates right?

**Why:** before a job, the website estimates each file size from bits per weight
(`frontend/src/utils/format.js`, `backend/services/preflightService.js`). Preflight uses those
estimates for the disk check, so their accuracy matters. Showing how wrong they are — and fixing
them — is a small, honest experiment.

**First finding (already in [catalog-trials.md](catalog-trials.md)):**

| Model        | Q4_K_M estimate | Q4_K_M measured | Error                      |
| ------------ | --------------- | --------------- | -------------------------- |
| SmolLM2-135M | ≈ 79 MiB        | 100.6 MiB       | −21 % (estimate too small) |
| SmolLM2-1.7B | ≈ 1000 MiB      | 1006.7 MiB      | −1 %                       |

Small models keep some tensors (embeddings, output layer) at higher precision, so bits per weight
alone under-estimates them.

**How (WP-20):** for every catalog model and level, write a table: estimate, measured, error %.
Report the average and worst error, split by model size.
**Then (WP-15, Huzaifah):** if the error is large for small models, add a correction (e.g. a fixed
extra MB per model, fitted from the table) and show the measured size once a job has run.
**Done when:** the table and the average error are in `docs/benchmark-report.md`.

## E2 — Task accuracy, not only perplexity

**Why:** perplexity ("how surprised is the model by real text") is hard to explain to examiners.
"Q4_K_M keeps 97 % of the original's accuracy on a common-sense test" is easy to understand.

**How (WP-16):** llama.cpp's `llama-perplexity` can score multiple-choice tests with the same
model file. Use **HellaSwag** (pick the most sensible ending for a sentence):

```bash
llama-perplexity -m <file> -f data/hellaswag/hellaswag_val_full.txt --hellaswag --hellaswag-tasks 400 -t <threads> -ngl 0
```

- Fixed task count (400; 100 in demo mode) and a fixed local file with its SHA-256 saved, like
  WikiText-2 (`scripts/fetch-wikitext.js` can fetch it too).
- Save `metrics.taskAccuracy` (percent) and `metrics.taskName` per variant; show "accuracy vs F16"
  in the Results table (WP-15/17).
- Check the flag names with `llama-perplexity --help` on b12376 first.

**Done when:** every variant has an accuracy number, and the report shows "% of F16 accuracy kept"
per level.

## E3 — Is the recommender better than a simple rule?

**Why:** the recommender (CLAUDE.md §7.3) is our own logic. We must show it beats naive choices.

**How:**

- **WP-18 (tests):** for 4–6 device profiles (e.g. 4 GB phone, 8 GB laptop, 16 GB laptop; each
  with quality / speed / balanced), compare the recommender's choice with two baselines:
  **B-always-Q4** (always pick Q4_K_M) and **B-largest-fits** (biggest file that fits).
- **WP-20 (report):** using the measured numbers, show per profile: what each method picked, its
  speed, its quality loss vs F16, and whether it even fits. Count how often the recommender is
  better, equal or worse — and explain the "worse" cases honestly.

**Done when:** one table + one short paragraph per case in `docs/benchmark-report.md`.

## E4 — The same benchmark on two laptops

**Why:** the whole point of PocketPrune is "the best file depends on _your_ device". Two real
machines prove it.

**How (WP-20):** run the benchmark for the 3 demo models on Sibghatullah's laptop (i7-14700HX,
16 GB) and on Huzaifah's (i5-1145G7, 16 GB). Compare tok/s per level, and show whether the
recommendation changes. Huzaifah needs llama.cpp only for this run (`npm run setup:llamacpp`).

**Done when:** a two-machine table and one chart in the report.

## E5 — Importance matrix (could-have)

**Why:** llama.cpp can quantize using an **importance matrix** — it first measures which weights
matter most on sample text, then keeps those more precise. It usually improves Q4 quality at the
same size. Comparing "Q4_K_M plain vs Q4_K_M + imatrix" is a small experiment of our own, still
inside llama.cpp (no new tool, no GPU).

**How (WP-16, optional level):**

```bash
llama-imatrix -m <name>-F16.gguf -f data/wikitext/wiki.train.raw -o <name>.imatrix --chunks 100 -t <threads>
llama-quantize --imatrix <name>.imatrix <name>-F16.gguf <name>-Q4_K_M-imat.gguf Q4_K_M
```

Use **training** text for the matrix and the **test** text for perplexity, so the result is fair.
**Done when:** perplexity and accuracy of both Q4 variants for the 3 demo models are in the report.

## E6 — Compare outputs (could-have, after M4)

Type one prompt, see the F16 answer and the Q4_K_M answer side by side (same seed, temperature 0).
A strong live-demo moment; reuses `llama-completion` from the smoke test.

---

## How it appears in the final report

**Evaluation chapter**

1. Setup — machines, llama.cpp b12376, datasets with SHA-256, settings.
2. Size: estimate vs measured (E1).
3. Speed and memory per level and per machine (WP-14, E4).
4. Quality: perplexity + task accuracy, % kept vs F16 (WP-16, E2, E5).
5. Recommender vs baselines (E3).
6. Usability: SUS score (WP-29).
7. Limitations — honest list (CPU only, small models, one test set).
