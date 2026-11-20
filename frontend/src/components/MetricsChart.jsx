// MetricsChart.jsx — one bar chart of a measured number per file (size, speed or RAM).
// F16 (the baseline) is grey, the compressed levels blue, so the shrink is visible at a glance.
// The same numbers are always in the MetricsTable too, so nothing is only on hover.
// Uses Recharts (CLAUDE.md §3); colours come from theme.js, never hard-coded.
// The mobile app draws simple bars with plain Views and the same props. Owner: Huzaifah (WP-17).
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { theme } from '../theme/theme.js';

const { colors, font } = theme;
const axisText = { fill: colors.textMuted, fontSize: font.size.sm };

// data: [{ level: 'F16', value: 258.3 }, …]   format: value → label shown on each bar
export default function MetricsChart({ title, description, data, format }) {
  const rows = data.filter((d) => d.value !== null && d.value !== undefined);
  if (rows.length === 0) return null;

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        <span className="chart__title">{title}</span>
        {description && <span className="chart__description">{description}</span>}
      </figcaption>
      <div
        className="chart__plot"
        role="img"
        aria-label={`${title}: ${rows.map((r) => `${r.level} ${format(r.value)}`).join(', ')}`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.border} />
            <XAxis
              dataKey="level"
              tick={axisText}
              tickLine={false}
              axisLine={{ stroke: colors.border }}
            />
            <YAxis tick={axisText} tickLine={false} axisLine={false} width={44} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell
                  key={r.level}
                  fill={r.level === 'F16' ? colors.ladderBaseline : colors.primary}
                />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={format}
                style={{ ...axisText, fill: colors.text }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
