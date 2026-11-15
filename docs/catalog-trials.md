# Catalog trials

Manual results of compressing each catalog model on the model machine. Filled by Sibghatullah in
WP-02 (SmolLM2-135M by hand) and WP-09 (the rest of the catalog).

Model machine: Intel Core i7-14700HX (20 cores / 28 threads), 16 GB RAM, Windows 11 Home (build 26200)
· llama.cpp tag: **b12376** (official Windows CPU build) · sizes in MiB (1 MiB = 1 048 576 bytes)

| Model                                              | Revision (commit) | Params  | F16 size | Q5_K_M size | Q4_K_M size | Smoke test | Works? | Notes                                                                                                                  |
| -------------------------------------------------- | ----------------- | ------- | -------- | ----------- | ----------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| HuggingFaceTB/SmolLM2-135M-Instruct                | `12fd25f7` ✔ seed | 0.135 B | 258.3    | 106.9       | 100.6       | 3/3 pass   | Yes    | WP-02 by hand, 14 Nov 2026. Download 49 s, convert 11 s, quantize < 1 s per level. PPL F16 18.92 · Q5 19.57 · Q4 19.87 |
| HuggingFaceTB/SmolLM2-360M-Instruct                |                   | 0.36 B  |          |             |             |            |        |                                                                                                                        |
| Qwen/Qwen2.5-0.5B-Instruct                         |                   | 0.5 B   |          |             |             |            |        |                                                                                                                        |
| TinyLlama/TinyLlama-1.1B-Chat-v1.0                 |                   | 1.1 B   |          |             |             |            |        |                                                                                                                        |
| Qwen/Qwen2.5-1.5B-Instruct                         |                   | 1.5 B   |          |             |             |            |        |                                                                                                                        |
| HuggingFaceTB/SmolLM2-1.7B-Instruct                |                   | 1.7 B   |          |             |             |            |        |                                                                                                                        |
| meta-llama/Llama-3.2-1B-Instruct (gated, optional) |                   | 1.2 B   |          |             |             |            |        |                                                                                                                        |
| microsoft/Phi-3.5-mini-instruct (stretch)          |                   | 3.8 B   |          |             |             |            |        |                                                                                                                        |
