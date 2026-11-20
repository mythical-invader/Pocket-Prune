// exportService.js — turns a job's results into a file people can open elsewhere:
// CSV (one line per file, opens in Excel / Google Sheets) or JSON (everything, for scripts).
// Both carry the settings the numbers belong to (model revision, llama.cpp version, machine,
// demo mode, fake data), so a number never travels without its context (REQ-32).
// Plain functions, no database. SRS: REQ-31, REQ-32. Owner: Huzaifah (WP-19).

// The CSV columns, in order: [header, how to read it from one results row].
const COLUMNS = [
  ['level', (r) => r.level],
  ['file_size_mb', (r) => r.values.fileSizeMb],
  ['size_vs_f16_pct', (r) => r.vsF16.fileSizeMb],
  ['prompt_tok_s', (r) => r.values.tpsPrompt],
  ['generation_tok_s', (r) => r.values.tpsGen],
  ['generation_vs_f16_pct', (r) => r.vsF16.tpsGen],
  ['peak_ram_mb', (r) => r.values.peakRamMb],
  ['peak_ram_vs_f16_pct', (r) => r.vsF16.peakRamMb],
  ['perplexity', (r) => r.values.perplexity],
  ['perplexity_plus_minus', (r) => r.ranges?.perplexity],
  ['perplexity_vs_f16_pct', (r) => r.vsF16.perplexity],
  ['task_accuracy_pct', (r) => r.values.taskAccuracy],
  ['task_accuracy_plus_minus', (r) => r.ranges?.taskAccuracy],
  ['task_accuracy_vs_f16_points', (r) => r.vsF16.taskAccuracy],
  ['speed_unstable', (r) => r.unstable],
  ['smoke_passed', (r) => r.smokePassed],
  ['estimated_size_mb', (r) => r.estimatedSizeMb],
  ['sha256', (r) => r.sha256],
];

// One CSV cell: empty for a missing number; quotes around text with a comma, quote or new line.
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// The same settings on every line, so each line still makes sense when copied on its own.
function contextOf(results) {
  return {
    model: results.model?.hfRepoId,
    revision: results.model?.revision,
    llama_cpp: results.llamaCppRef,
    machine: results.machine?.cpu,
    threads: results.machine?.threads,
    demo_mode: results.demoMode,
    fake_data: results.fake,
    recommended: results.recommendation?.chosenLevel,
  };
}

export function toCsv(results) {
  const context = contextOf(results);
  const header = [...COLUMNS.map(([name]) => name), ...Object.keys(context)];
  const lines = results.rows.map((row) => [
    ...COLUMNS.map(([, read]) => read(row)),
    ...Object.values(context),
  ]);
  return [header, ...lines].map((cells) => cells.map(csvCell).join(',')).join('\n') + '\n';
}

export function toJson(results) {
  return { exportedAt: new Date().toISOString(), ...results };
}

// "SmolLM2-135M-Instruct-results.csv" — the model name without the "HuggingFaceTB/" part.
export function exportFileName(results, format) {
  const name = (results.model?.hfRepoId ?? 'job').split('/').pop();
  return `${name}-results.${format}`;
}
