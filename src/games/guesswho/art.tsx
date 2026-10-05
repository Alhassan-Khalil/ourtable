import { ArtFrame, fill } from '../../ui/art';
import { classicDeck } from './faces';

/** Three cards from the classic deck; the middle one is the secret person. */
export function Art() {
  const deck = classicDeck();
  const card = (x: number, face: number | null) => (
    <g>
      <rect x={x} y={6} width={30} height={52} rx={6} style={fill('var(--surface-2)')} />
      {face === null ? (
        <text x={x + 15} y={39} text-anchor="middle" style={{ fill: 'var(--accent)', fontSize: '22px', fontWeight: 700 }}>
          ?
        </text>
      ) : (
        <>
          <image href={deck[face].img} x={x + 2} y={8} width={26} height={26} />
          <rect x={x + 6} y={42} width={18} height={3} rx={1.5} style={fill('var(--muted)')} />
        </>
      )}
    </g>
  );
  return (
    <ArtFrame>
      {card(12, 2)}
      {card(45, null)}
      {card(78, 9)}
    </ArtFrame>
  );
}
