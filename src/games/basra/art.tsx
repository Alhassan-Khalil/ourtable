import { ArtFrame, fill } from '../../ui/art';

const FELT = 'color-mix(in srgb, #1f7a52 85%, var(--text))';
const FACE = '#fffdf8';
const INK = '#1f2430';
const RED = '#d6293e';

/** One small card: a corner rank and a big suit (or letter), turned `rot` degrees around its centre. */
function Card({ x, y, rank, suit, red, rot = 0, big }: { x: number; y: number; rank: string; suit: string; red?: boolean; rot?: number; big?: string }) {
  const c = red ? RED : INK;
  return (
    <g transform={`rotate(${rot} ${x + 9} ${y + 12.5})`}>
      <rect x={x} y={y} width={18} height={25} rx={2.2} style={{ fill: FACE, stroke: 'rgb(0 0 0 / 0.18)', strokeWidth: 0.5 }} />
      <text x={x + 2.2} y={y + 6.4} style={{ ...fill(c), fontSize: '5.6px', fontWeight: 800, direction: 'ltr' }}>
        {rank}
      </text>
      <text x={x + 9} y={y + 18} text-anchor="middle" style={{ ...fill(c), fontSize: big ? '9px' : '11px', fontWeight: 800, direction: 'ltr' }}>
        {big ?? suit}
      </text>
    </g>
  );
}

/** A green table: four cards on the floor, a hand of three, and the 7♦ about to sweep. */
export function Art() {
  return (
    <ArtFrame>
      <rect x={6} y={3} width={108} height={58} rx={10} style={fill(FELT)} />
      {/* the pack */}
      <rect x={13} y={10} width={14} height={20} rx={2} style={{ ...fill('var(--board)'), stroke: FACE, strokeWidth: 1 }} />
      <rect x={15} y={8} width={14} height={20} rx={2} style={{ ...fill('var(--board)'), stroke: FACE, strokeWidth: 1 }} />
      {/* the floor */}
      <Card x={36} y={8} rank="5" suit="♠" />
      <Card x={57} y={8} rank="2" suit="♥" red />
      <Card x={78} y={8} rank="K" suit="♣" big="K" />
      {/* the hand, fanned */}
      <Card x={40} y={34} rank="A" suit="♣" rot={-14} />
      <Card x={53} y={32} rank="J" suit="♠" rot={0} big="J" />
      <Card x={66} y={34} rank="7" suit="♦" red rot={14} />
      <text x={100} y={52} text-anchor="middle" style={{ ...fill('#ffd54a'), fontSize: '12px' }}>
        ★
      </text>
    </ArtFrame>
  );
}
