import { ArtFrame, fill, stroke } from '../../ui/art';

const RUNGS = [50, 40, 30, 20, 10];
const slope = (y: number) => (60 - y) * 0.321; // the ladder leans right as it climbs

export function Art() {
  return (
    <ArtFrame>
      {Array.from({ length: 12 * 6 }, (_, k) => {
        const r = Math.floor(k / 12);
        const c = k % 12;
        return (r + c) % 2 === 0 ? <rect key={k} x={c * 10} y={r * 10.7} width={10} height={10.7} style={fill('var(--surface-2)')} /> : null;
      })}
      <g style={stroke('#BA7517', 2.4)}>
        <line x1={74} y1={60} x2={92} y2={4} />
        <line x1={84} y1={60} x2={102} y2={4} />
        {RUNGS.map((y) => (
          <line key={y} x1={74 + slope(y)} y1={y} x2={84 + slope(y)} y2={y} />
        ))}
      </g>
      <path d="M22 58 C40 50, 12 36, 32 28 S 30 12, 46 8" style={stroke('#639922', 6)} />
      <circle cx={46} cy={8} r={5} style={fill('#639922')} />
      <circle cx={47.5} cy={6.5} r={1.2} style={fill('#fff')} />
      <circle cx={58} cy={46} r={4.5} style={fill('var(--p0)')} />
      <circle cx={66} cy={52} r={4.5} style={fill('var(--p1)')} />
    </ArtFrame>
  );
}
