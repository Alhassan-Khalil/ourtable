import { ArtFrame, fill, stroke } from '../../ui/art';

const S = 18; // one small board
const X0 = 33;
const Y0 = 5;

const centre = (b: number) => ({ x: X0 + (b % 3) * S + S / 2, y: Y0 + Math.floor(b / 3) * S + S / 2 });

function Cross({ x, y, s }: { x: number; y: number; s: number }) {
  return <path d={`M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`} style={stroke('var(--p0)', s > 4 ? 3.2 : 1.8)} />;
}

function Ring({ x, y, s }: { x: number; y: number; s: number }) {
  return <circle cx={x} cy={y} r={s} style={stroke('var(--p1)', s > 4 ? 3 : 1.8)} />;
}

export function Art() {
  const b4 = centre(4);
  return (
    <ArtFrame>
      {/* the board the next player must use */}
      <rect x={X0 + S + 1.5} y={Y0 + 1.5} width={S - 3} height={S - 3} rx={3} style={fill('var(--accent-soft)')} />
      {[1, 2].map((k) => (
        <g key={k}>
          <line x1={X0 + k * S} y1={Y0} x2={X0 + k * S} y2={Y0 + 3 * S} style={stroke('var(--muted)', 1.6)} />
          <line x1={X0} y1={Y0 + k * S} x2={X0 + 3 * S} y2={Y0 + k * S} style={stroke('var(--muted)', 1.6)} />
        </g>
      ))}
      <Cross {...centre(0)} s={6.5} />
      <Ring {...centre(8)} s={6.5} />
      <Cross x={b4.x - 4} y={b4.y + 4} s={2.4} />
      <Ring x={b4.x + 4} y={b4.y - 4} s={2.6} />
      <Cross x={centre(5).x} y={centre(5).y + 3} s={2.4} />
      <Ring x={centre(6).x + 3} y={centre(6).y - 3} s={2.6} />
    </ArtFrame>
  );
}
