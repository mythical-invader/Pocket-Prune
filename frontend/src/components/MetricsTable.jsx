// MetricsTable.jsx — the comparison table: one row per file (F16 first), one column per measured
// number, each with its change versus F16 coloured green (better) or red (worse). Under the size
// it also shows the estimate made before the job (evaluation E1); quality numbers show their ± range
// and task accuracy changes in percentage points.
// Props come straight from GET /api/jobs/:id/results: { metrics, measured, rows }.
// The mobile app has a compact MetricsTable with the same props. Owner: Huzaifah (WP-15, WP-17).
import { CheckCircle2, XCircle } from 'lucide-react';
import { formatMb, formatPct } from '../utils/format.js';

// Show a number with its unit (and its ± range when the tool reports one), the way users read it.
function formatValue(metric, value, range) {
  if (value === null || value === undefined) return '—';
  const pm =
    range !== null && range !== undefined ? ` ± ${range.toFixed(metric.unit === '%' ? 1 : 2)}` : '';
  if (metric.unit === 'MB') return formatMb(value);
  if (metric.unit === 'tok/s') return `${value.toFixed(1)} tok/s`;
  if (metric.unit === '%') return `${value.toFixed(1)}${pm} %`; // task accuracy
  return `${value.toFixed(2)}${pm}`; // perplexity has no unit
}

// A change vs F16: relative % for most numbers, percentage points ("pp") for accuracy,
// which is already a percentage (42.0 % → 40.8 % is −1.2 pp, not −2.9 %).
function formatChange(metric, change) {
  if (metric.change !== 'points') return formatPct(change);
  return `${change > 0 ? '+' : ''}${change.toFixed(1)} pp`;
}

// Is this change good news? Lower is better for size/RAM/perplexity, higher for speed.
function tone(metric, change) {
  if (change === null || change === 0) return 'same';
  const goodWhenLower = metric.better === 'lower';
  return change < 0 === goodWhenLower ? 'better' : 'worse';
}

export default function MetricsTable({ metrics, measured, rows }) {
  const columns = metrics.filter((m) => measured.includes(m.key));

  return (
    <div className="metrics-table__wrap">
      <table className="metrics-table">
        <thead>
          <tr>
            <th scope="col">Level</th>
            {columns.map((m) => (
              <th scope="col" key={m.key} className="num-col">
                {m.label}
              </th>
            ))}
            <th scope="col">Smoke test</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.level} className={row.level === 'F16' ? 'is-baseline' : undefined}>
              <th scope="row">
                {row.level}
                {row.level === 'F16' && <span className="metrics-table__sub">baseline</span>}
              </th>
              {columns.map((m) => {
                const change = row.vsF16[m.key];
                return (
                  <td key={m.key} className="num-col num">
                    {formatValue(m, row.values[m.key], row.ranges?.[m.key])}
                    {change !== null && (
                      <span className={`metrics-table__change is-${tone(m, change)}`}>
                        {formatChange(m, change)}
                      </span>
                    )}
                    {m.key === 'fileSizeMb' &&
                      row.estimatedSizeMb !== null &&
                      row.level !== 'F16' && (
                        <span className="metrics-table__sub">
                          est. {formatMb(row.estimatedSizeMb)}
                          {row.estimateErrorPct !== null && ` (${formatPct(row.estimateErrorPct)})`}
                        </span>
                      )}
                  </td>
                );
              })}
              <td>
                {row.smokePassed ? (
                  <span className="is-ok">
                    <CheckCircle2 size={16} aria-hidden /> Passed
                  </span>
                ) : (
                  <span className="is-bad">
                    <XCircle size={16} aria-hidden /> Failed
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
