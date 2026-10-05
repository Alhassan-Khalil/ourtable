import { ArtFrame, fill } from '../../ui/art';

function Bubble({ x, c, mark }: { x: number; c: string; mark: string }) {
  return (
    <g>
      <rect x={x} y={8} width={30} height={22} rx={8} style={fill(c)} />
      <path d={`M${x + 8} 29 l-3 7 l9 -7z`} style={fill(c)} />
      <text x={x + 15} y={24} text-anchor="middle" style={{ fill: '#fff', fontSize: '13px', fontWeight: 700 }}>
        {mark}
      </text>
    </g>
  );
}

export function Art() {
  return (
    <ArtFrame>
      <Bubble x={10} c="var(--good)" mark="✓" />
      <Bubble x={45} c="var(--bad)" mark="✕" />
      <Bubble x={80} c="var(--good)" mark="✓" />
      {[14, 49, 84].map((x) => (
        <g key={x}>
          <rect x={x} y={44} width={22} height={3} rx={1.5} style={fill('var(--muted)')} />
          <rect x={x} y={50} width={14} height={3} rx={1.5} style={fill('var(--border)')} />
        </g>
      ))}
    </ArtFrame>
  );
}
