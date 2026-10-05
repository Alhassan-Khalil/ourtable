import { ArtFrame, fill, stroke } from '../../ui/art';

/** An open book; the lines alternate between the two players' colours. */
export function Art() {
  return (
    <ArtFrame>
      <path d="M60 10 C48 4, 30 4, 18 8 L18 56 C30 52, 48 52, 60 58 Z" style={fill('var(--surface-2)')} />
      <path d="M60 10 C72 4, 90 4, 102 8 L102 56 C90 52, 72 52, 60 58 Z" style={fill('var(--surface-2)')} />
      <path d="M60 10 L60 58" style={stroke('var(--border)', 1.5)} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={26} y={16 + i * 9} width={i === 3 ? 18 : 26} height={3.2} rx={1.6} style={fill(i % 2 ? 'var(--p1)' : 'var(--p0)')} />
          <rect x={68} y={16 + i * 9} width={i === 3 ? 14 : 26} height={3.2} rx={1.6} style={fill(i % 2 ? 'var(--p0)' : 'var(--p1)')} />
        </g>
      ))}
    </ArtFrame>
  );
}
