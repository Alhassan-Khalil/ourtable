import { ArtFrame, fill, stroke } from '../../ui/art';

export function Art() {
  return (
    <ArtFrame>
      <rect x={10} y={4} width={100} height={56} rx={8} style={fill('color-mix(in srgb, #378ADD 25%, transparent)')} />
      {[0, 1, 2, 3].map((k) => (
        <path key={k} d={`M${18 + k * 24} ${52 - (k % 2) * 30} q4 -3 8 0 t8 0`} style={stroke('color-mix(in srgb, #378ADD 60%, transparent)', 1.5)} />
      ))}
      <rect x={22} y={16} width={46} height={11} rx={5.5} style={fill('#888780')} />
      <rect x={84} y={14} width={11} height={36} rx={5.5} style={fill('#888780')} />
      {/* a hit */}
      <rect x={45} y={16} width={11} height={11} rx={2} style={fill('var(--bad)')} />
      <path d="M47.5 18.5l6 6m0 -6l-6 6" style={stroke('#fff', 1.8)} />
      {/* misses */}
      <circle cx={60} cy={44} r={2.6} style={fill('var(--text)')} />
      <circle cx={34} cy={44} r={2.6} style={fill('var(--text)')} />
    </ArtFrame>
  );
}
