// seedData.js — the models PocketPrune is allowed to compress (CLAUDE.md §7.5).
//
// revision   = the exact Hugging Face commit, so every job downloads identical files (REQ-2).
//              Looked up on 11 Nov 2026 from https://huggingface.co/api/models/<repo>;
//              Sibghatullah confirms or updates them after the hand trials (WP-02 / WP-09).
// paramsBillion = parameter count from the model's safetensors metadata.
// f16SizeMb  = parameters × 2 bytes (F16 stores each weight in 16 bits).
// isDemo     = tiny models that finish a full job in a few minutes, for live demos.
// SRS: REQ-1, REQ-2, REQ-3. Owner: Huzaifah.

export const CATALOG_SEED = [
  // ---- Demo models ----
  {
    hfRepoId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    revision: '12fd25f77366fa6b3b4b768ec3050bf629380bac',
    displayName: 'SmolLM2 135M Instruct',
    paramsBillion: 0.135,
    license: 'Apache-2.0',
    f16SizeMb: 257,
    isDemo: true,
  },
  {
    hfRepoId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    revision: 'a10cc1512eabd3dde888204e902eca88bddb4951',
    displayName: 'SmolLM2 360M Instruct',
    paramsBillion: 0.362,
    license: 'Apache-2.0',
    f16SizeMb: 690,
    isDemo: true,
  },
  {
    hfRepoId: 'Qwen/Qwen2.5-0.5B-Instruct',
    revision: '7ae557604adf67be50417f59c2c2f167def9a775',
    displayName: 'Qwen2.5 0.5B Instruct',
    paramsBillion: 0.494,
    license: 'Apache-2.0',
    f16SizeMb: 942,
    isDemo: true,
  },

  // ---- Standard models ----
  {
    hfRepoId: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
    revision: 'fe8a4ea1ffedaf415f4da2f062534de366a451e6',
    displayName: 'TinyLlama 1.1B Chat',
    paramsBillion: 1.1,
    license: 'Apache-2.0',
    f16SizeMb: 2098,
  },
  {
    hfRepoId: 'Qwen/Qwen2.5-1.5B-Instruct',
    revision: '989aa7980e4cf806f80c7fef2b1adb7bc71aa306',
    displayName: 'Qwen2.5 1.5B Instruct',
    paramsBillion: 1.544,
    license: 'Apache-2.0',
    f16SizeMb: 2944,
  },
  {
    hfRepoId: 'HuggingFaceTB/SmolLM2-1.7B-Instruct',
    revision: '31b70e2e869a7173562077fd711b654946d38674',
    displayName: 'SmolLM2 1.7B Instruct',
    paramsBillion: 1.711,
    license: 'Apache-2.0',
    f16SizeMb: 3264,
  },
  {
    // Gated: the user must accept Meta's licence on Hugging Face and set HF_TOKEN.
    hfRepoId: 'meta-llama/Llama-3.2-1B-Instruct',
    revision: '9213176726f574b556790deb65791e0c5aa438b6',
    displayName: 'Llama 3.2 1B Instruct',
    paramsBillion: 1.236,
    license: 'Llama 3.2 Community',
    f16SizeMb: 2357,
    gated: true,
  },

  // ---- Stretch (largest allowed) ----
  {
    hfRepoId: 'microsoft/Phi-3.5-mini-instruct',
    revision: '2fe192450127e6a83f7441aef6e3ca586c338b77',
    displayName: 'Phi-3.5 mini Instruct',
    paramsBillion: 3.821,
    license: 'MIT',
    f16SizeMb: 7288,
  },
];
