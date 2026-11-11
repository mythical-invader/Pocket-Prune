// ProgressBar.jsx — a horizontal bar from 0 to 100 %, with the number written beside it.
// Owner: Huzaifah.
export default function ProgressBar({ value = 0, label = 'Progress' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress">
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress__value num">{pct} %</span>
    </div>
  );
}
