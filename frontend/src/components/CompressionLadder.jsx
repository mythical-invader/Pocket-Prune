// CompressionLadder.jsx — PocketPrune's signature picture: one bar per file level, its length
// proportional to the file size, so you SEE how much each level shrinks the model.
// Before a job runs the sizes are estimates from the F16 size (see utils/format.js);
// after a job, pass `sizes` with the measured MB per level.
// `scaleMaxMb` puts several ladders on ONE scale (the catalog passes its biggest model's F16
// size), so a 3 GB model's bars are visibly longer than a 270 MB model's. Owner: Huzaifah.
import { estimateSizeMb, formatMb, LEVEL_HINTS } from '../utils/format.js';

export default function CompressionLadder({
  f16SizeMb,
  levels = ['F16', 'Q5_K_M', 'Q4_K_M'],
  sizes,
  scaleMaxMb,
  showHints = false,
}) {
  const rows = levels.map((level) => ({
    level,
    mb: sizes?.[level] ?? estimateSizeMb(f16SizeMb, level),
  }));
  const largest = scaleMaxMb || Math.max(...rows.map((row) => row.mb || 0)) || 1;
  const prefix = sizes ? '' : '≈ ';

  return (
    <dl className="ladder" aria-label={sizes ? 'File sizes' : 'Estimated file sizes'}>
      {rows.map(({ level, mb }) => (
        <div className="ladder__row" key={level}>
          <dt className="ladder__level">
            {level}
            {showHints && <span className="ladder__hint">{LEVEL_HINTS[level]}</span>}
          </dt>
          <dd className="ladder__bar-cell">
            <span
              className={`ladder__bar ${level === 'F16' ? 'ladder__bar--baseline' : ''}`}
              style={{ width: `${((mb || 0) / largest) * 100}%` }}
            />
          </dd>
          <dd className="ladder__value num">
            {prefix}
            {formatMb(mb)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
