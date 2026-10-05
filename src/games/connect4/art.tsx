import { ArtFrame, fill } from '../../ui/art';

const COLOURS = ['var(--p0)', 'var(--p1)', 'var(--bg)'];
// 4 rows × 6 columns, bottom row last; 0 / 1 = pieces, 2 = empty
const GRID = [
  [2, 2, 2, 2, 2, 2],
  [2, 2, 1, 2, 2, 2],
  [2, 0, 1, 0, 2, 2],
  [1, 0, 0, 1, 0, 2],
];

export function Art() {
  return (
    <ArtFrame>
      <circle cx={90} cy={6} r={5} style={fill('var(--p0)')} />
      <rect x={20} y={12} width={80} height={50} rx={7} style={fill('var(--board)')} />
      {GRID.map((row, r) =>
        row.map((v, c) => <circle key={`${r}-${c}`} cx={30 + c * 12} cy={21 + r * 11.5} r={4.6} style={fill(COLOURS[v])} />),
      )}
    </ArtFrame>
  );
}
