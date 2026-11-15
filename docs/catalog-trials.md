# Catalog trials

Manual results of compressing each catalog model on the model machine. Filled by Sibghatullah in
WP-02 (SmolLM2-135M by hand) and WP-09 (the rest of the catalog).

Model machine: Intel Core i7-14700HX (20 cores / 28 threads), 16 GB RAM, Windows 11 Home (build 26200)
· llama.cpp tag: **b12376** (official Windows CPU build) · sizes in MiB (1 MiB = 1 048 576 bytes)

| Model                                              | Revision (commit) | Params  | F16 size | Q5_K_M size | Q4_K_M size | Smoke test | Works?      | Notes                                                                                                                               |
| -------------------------------------------------- | ----------------- | ------- | -------- | ----------- | ----------- | ---------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| HuggingFaceTB/SmolLM2-135M-Instruct                | `12fd25f7` ✔ seed | 0.135 B | 258.3    | 106.9       | 100.6       | 3/3 pass   | Yes         | WP-02 by hand, 14 Nov 2026. Download 49 s, convert 11 s, quantize < 1 s per level. PPL F16 18.92 · Q5 19.57 · Q4 19.87              |
| HuggingFaceTB/SmolLM2-360M-Instruct                | `a10cc151` ✔ seed | 0.362 B | 691.9    | 276.5       | 258.1       | 3/3 pass   | Yes         | Demo. CLI run 15 Nov 2026, total 142 s (incl. download)                                                                             |
| Qwen/Qwen2.5-0.5B-Instruct                         | `7ae55760` ✔ seed | 0.494 B | 948.1    | 400.6       | 379.4       | 3/3 pass   | Yes         | Demo. Total 190 s. Q4_K_M only 5 % smaller than Q5_K_M (llama.cpp keeps some tensors of this small model at higher precision)       |
| TinyLlama/TinyLlama-1.1B-Chat-v1.0                 | `fe8a4ea1` ✔ seed | 1.1 B   | 2099.1   | 745.8       | 636.9       | 3/3 pass   | Yes         | Total 439 s                                                                                                                         |
| Qwen/Qwen2.5-1.5B-Instruct                         | `989aa798` ✔ seed | 1.544 B | 2950.4   | 1072.9      | 940.4       | 3/3 pass   | Yes         | Total 597 s                                                                                                                         |
| HuggingFaceTB/SmolLM2-1.7B-Instruct                | `31b70e2e` ✔ seed | 1.711 B | 3266.1   | 1168.7      | 1006.7      | 3/3 pass   | Yes         | Total 721 s. Q4_K_M smoke text drifts into code after "Paris." — still valid                                                        |
| meta-llama/Llama-3.2-1B-Instruct (gated, optional) | `92131767` ✔ seed | 1.236 B | —        | —           | —           | —          | Needs token | Stopped at download with E-HF-01 (no HF_TOKEN), as designed. Works once the licence is accepted on Hugging Face and HF_TOKEN is set |
| microsoft/Phi-3.5-mini-instruct (stretch)          | `2fe19245` ✔ seed | 3.821 B | 7289.2   | 2627.5      | 2285.7      | 3/3 pass   | Yes         | Stretch. Total 1566 s (~26 min); needs ~10 GB free disk during the job. Smoke 12 tok/s                                              |

**Summary (WP-09, 15 Nov 2026):** 7 of 8 catalog models compress, quantize and pass the smoke test on the
model machine; the gated Llama-3.2 needs a Hugging Face token. All 8 pinned revisions, the safetensors
check, the real parameter counts (≤ 4 B) and the gated flags were confirmed with `npm run validate:catalog`.

How these were made: `npm run pipeline -- --model <repo> --levels Q5_K_M,Q4_K_M` (the WP-06 CLI), one
model after the other. "Total" is the whole run: download + F16 convert + 2 quantizations + 3 smoke tests.
Smoke test = fixed prompt "The capital of France is", 32 tokens, seed 42, temp 0, CPU only. Speed,
RAM and perplexity are measured later by the evaluator (WP-14 / WP-16), not here.
