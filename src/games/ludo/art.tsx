import { ArtFrame, fill, stroke } from '../../ui/art';
import { HOME_COLUMN, TRACK, triangle, YARD_ORIGIN } from './board';

const C = 4; // one board cell
const X0 = 18;
const Y0 = 2;
const COLOURS = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'color-mix(in srgb, var(--muted) 45%, var(--surface))'];
const PIPS = [
  [6, 6],
  [6, 13],
  [6, 20],
  [20, 6],
  [20, 13],
  [20, 20],
];

/** A small cross board with a 6 on the die. */
export function Art() {
  return (
    <ArtFrame>
      <rect x={X0} y={Y0} width={15 * C} height={15 * C} rx={2} style={{ ...fill('var(--surface)'), stroke: 'var(--border)', strokeWidth: 0.8 }} />
      {YARD_ORIGIN.map(([c, r], k) => (
        <g key={k}>
          <rect x={X0 + c * C} y={Y0 + r * C} width={6 * C} height={6 * C} rx={2} style={fill(COLOURS[k])} />
          <rect x={X0 + (c + 1) * C} y={Y0 + (r + 1) * C} width={4 * C} height={4 * C} rx={2} style={fill('var(--surface)')} />
        </g>
      ))}
      {TRACK.map(([c, r], i) => (
        <rect
          key={i}
          x={X0 + c * C}
          y={Y0 + r * C}
          width={C}
          height={C}
          style={{ fill: i % 13 === 0 ? COLOURS[i / 13] : 'var(--surface)', stroke: 'var(--border)', strokeWidth: 0.4 }}
        />
      ))}
      {HOME_COLUMN.map((cells, k) =>
        cells.map(([c, r]) => <rect key={`${k}.${c}.${r}`} x={X0 + c * C} y={Y0 + r * C} width={C} height={C} style={fill(COLOURS[k])} />),
      )}
      {[0, 1, 2, 3].map((k) => (
        <polygon key={k} points={triangle(k).map((p) => `${X0 + p.x * C},${Y0 + p.y * C}`).join(' ')} style={fill(COLOURS[k])} />
      ))}
      {/* waiting tokens, and two out on the track */}
      <circle cx={X0 + 2 * C} cy={Y0 + 2 * C} r={2.6} style={fill('var(--p0)')} />
      <circle cx={X0 + 4 * C} cy={Y0 + 4 * C} r={2.6} style={fill('var(--p0)')} />
      <circle cx={X0 + 13 * C} cy={Y0 + 13 * C} r={2.6} style={fill('var(--p2)')} />
      <circle cx={X0 + 6.5 * C} cy={Y0 + 3.5 * C} r={2.3} style={{ ...fill('var(--p0)'), stroke: 'var(--surface)', strokeWidth: 0.8 }} />
      <circle cx={X0 + 11.5 * C} cy={Y0 + 6.5 * C} r={2.3} style={{ ...fill('var(--p1)'), stroke: 'var(--surface)', strokeWidth: 0.8 }} />
      {/* the die */}
      <g transform="translate(86 20) rotate(12 13 13)">
        <rect width={26} height={26} rx={5} style={{ ...stroke('var(--text)', 1.4), fill: 'var(--surface)' }} />
        {PIPS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.3} style={fill('var(--text)')} />
        ))}
      </g>
    </ArtFrame>
  );
}
