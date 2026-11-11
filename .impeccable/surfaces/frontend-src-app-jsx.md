---
version: 1
slug: "frontend-src-app-jsx"
primary_target: "frontend/src/App.jsx"
related_targets: ["frontend/src/pages"]
---

# Surface brief: PocketPrune web app shell (Catalog, Profiles, Job Setup)

Scope: the website's app shell and its first three working screens (WP-07). Mode: Operate.
Audience and task: developers choosing a small LLM and a device, then setting up a compression
job; also read on a projector during FYP demos. Content: the curated catalog (pinned HF models),
device profiles, levels Q5_K_M / Q4_K_M (Q8_0 optional). Constraints: tokens only from
frontend/src/theme/theme.js; components portable to React Native; no hover-only info; stacked
cards collapse to one column on phones.

## Direction contract

THESIS: The job is the journey. A persistent five-step rail (Model, Device, Preflight, Run,
Results) frames every working screen so the visitor always knows where in the compression
pipeline they stand; it refuses the generic sidebar dashboard.

OWN-WORLD: Cool off-white ground #F7F8FA, white cards with 1px #E3E6EB borders and 16px radius,
one blue #2F5DE1 for the active step, selection and primary action, green only for success,
Inter at 13/15/18/24 with 600 for headings, lucide icons at 18px.

STORY: The visitor sees the step they are on, picks a model by comparing compression ladders,
picks or creates a device profile, then reviews levels and submits; a summary panel keeps their
choices visible.

FIRST VIEWPORT: 60px white top bar (brand left; History, Downloads, Help right). Below, a full-width
step rail card with five numbered steps joined by lines, active step filled blue. Main area two
columns: left the step's content (Catalog: 2-column model card grid, each with ladder and Select);
right a 340px "Your job" summary card with model, device, levels and the primary Next button.

FORM: Pipeline rail, dealt structure 3 of 7 on the ordered list. seed:c671119bf0196838

SIGNATURE: the compression ladder, F16 then Q5_K_M then Q4_K_M sizes drawn as proportional bars
with values, on every model card and in the summary.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
