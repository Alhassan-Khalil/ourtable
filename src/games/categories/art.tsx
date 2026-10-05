import { ArtFrame, fill, stroke } from '../../ui/art';

// five answer rows: [width of the written answer, owner colour, scored?]
const ROWS: [number, string, boolean][] = [
  [30, 'var(--p0)', true],
  [22, 'var(--p1)', true],
  [34, 'var(--p0)', false],
  [26, 'var(--p2)', true],
  [18, 'var(--p1)', true],
];

export function Art() {
  return (
    <ArtFrame>
      {/* the round's letter */}
      <rect x={8} y={8} width={36} height={48} rx={8} style={fill('var(--accent)')} />
      <text x={26} y={44} text-anchor="middle" style={{ fill: '#fff', fontSize: '30px', fontWeight: 700 }}>
        أ
      </text>

      {/* five answers, written in the players' colours */}
      {ROWS.map(([w, c, ok], i) => {
        const y = 12 + i * 10;
        return (
          <g key={i}>
            <circle cx={55} cy={y} r={2.6} style={fill(c)} />
            <rect x={63} y={y - 1.8} width={w} height={3.6} rx={1.8} style={fill('var(--muted)')} />
            {ok ? (
              <path d={`M${101} ${y} l2.6 2.8 l5.4 -6`} style={stroke('var(--good)', 2)} />
            ) : (
              <path d={`M${102} ${y - 3} l6 6 m0 -6 l-6 6`} style={stroke('var(--bad)', 2)} />
            )}
          </g>
        );
      })}
    </ArtFrame>
  );
}
