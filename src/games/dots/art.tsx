import { ArtFrame, fill, stroke } from '../../ui/art';

const X = (c: number) => 24 + c * 18;
const Y = (r: number) => 10 + r * 18;

// [x1, y1, x2, y2, colour] in dot coordinates
const LINES: [number, number, number, number, string][] = [
  [1, 0, 2, 0, 'var(--p0)'],
  [1, 1, 2, 1, 'var(--p1)'],
  [1, 0, 1, 1, 'var(--p0)'],
  [2, 0, 2, 1, 'var(--p0)'],
  [3, 1, 4, 1, 'var(--p1)'],
  [3, 2, 4, 2, 'var(--p0)'],
  [3, 1, 3, 2, 'var(--p1)'],
  [4, 1, 4, 2, 'var(--p1)'],
  [0, 2, 1, 2, 'var(--p0)'],
  [2, 2, 2, 3, 'var(--p1)'],
];

export function Art() {
  return (
    <ArtFrame>
      <rect x={X(1) + 1.5} y={Y(0) + 1.5} width={15} height={15} rx={2} style={fill('color-mix(in srgb, var(--p0) 35%, transparent)')} />
      <rect x={X(3) + 1.5} y={Y(1) + 1.5} width={15} height={15} rx={2} style={fill('color-mix(in srgb, var(--p1) 35%, transparent)')} />
      {LINES.map(([c1, r1, c2, r2, c], i) => (
        <line key={i} x1={X(c1)} y1={Y(r1)} x2={X(c2)} y2={Y(r2)} style={stroke(c, 3)} />
      ))}
      {Array.from({ length: 20 }, (_, k) => (
        <circle key={k} cx={X(k % 5)} cy={Y(Math.floor(k / 5))} r={2.4} style={fill('var(--text)')} />
      ))}
    </ArtFrame>
  );
}
