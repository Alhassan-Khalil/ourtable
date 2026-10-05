import { ArtFrame, fill } from '../../ui/art';

// «سلام» in separate tiles, read right to left (so the first letter is the rightmost tile)
const TILES: [string, string][] = [
  ['م', 'var(--muted)'],
  ['ا', 'var(--good)'],
  ['ل', '#d4a017'],
  ['س', 'var(--good)'],
];

export function Art() {
  return (
    <ArtFrame>
      {TILES.map(([ch, c], i) => (
        <g key={i}>
          <rect x={14 + i * 24} y={8} width={20} height={20} rx={4} style={fill(c)} />
          <text x={24 + i * 24} y={23} text-anchor="middle" style={{ fill: '#fff', fontSize: '13px', fontWeight: 700 }}>
            {ch}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={14 + i * 24} y={34} width={20} height={20} rx={4} style={{ fill: 'none', stroke: 'var(--border)', strokeWidth: 1.5 }} />
      ))}
    </ArtFrame>
  );
}
