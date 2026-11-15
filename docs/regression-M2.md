# Regression check — M2

Made by `npm run regression` (scripts/regression.js) on **2026-11-15**. Result: **PASS**.

Machine: Intel(R) Core(TM) i7-14700HX (28 threads), 16 GB RAM, Windows_NT 10.0.26200 · llama.cpp **b12376** · levels Q5_K_M, Q4_K_M

Sizes in MiB; "exp." = size measured before (docs/catalog-trials.md), allowed difference 1 %;
✔ = smoke test passed. Time includes conversion, quantization and smoke tests (downloads reused).

| Model                               | F16                  | Q5_K_M               | Q4_K_M               | Time | Result |
| ----------------------------------- | -------------------- | -------------------- | -------------------- | ---- | ------ |
| HuggingFaceTB/SmolLM2-135M-Instruct | 258.3 (exp. 258.3) ✔ | 106.9 (exp. 106.9) ✔ | 100.6 (exp. 100.6) ✔ | 11 s | ✔ pass |
| HuggingFaceTB/SmolLM2-360M-Instruct | 691.9 (exp. 691.9) ✔ | 276.5 (exp. 276.5) ✔ | 258.1 (exp. 258.1) ✔ | 15 s | ✔ pass |
| Qwen/Qwen2.5-0.5B-Instruct          | 948.1 (exp. 948.1) ✔ | 400.6 (exp. 400.6) ✔ | 379.4 (exp. 379.4) ✔ | 19 s | ✔ pass |

## A stopped job leaves no junk

SmolLM2-135M with a **1-second** conversion time limit: stopped with **E-TIME-01**, files left behind: **none ✔**.

Logs of each run: `data/regression/*.log` (not committed).
