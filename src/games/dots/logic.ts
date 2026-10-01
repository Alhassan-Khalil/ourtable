import { GameError, other, type Player } from '../../core/types';

/**
 * Dots and Boxes. A grid of SIZE × SIZE boxes, (SIZE+1) × (SIZE+1) dots.
 *
 * Line indexing:
 *   horizontal line at dot-row r (0..SIZE), box-column c (0..SIZE-1): h[r * SIZE + c]
 *   vertical   line at box-row r (0..SIZE-1), dot-column c (0..SIZE): v[r * (SIZE + 1) + c]
 * Box (r, c) is closed by h(r, c), h(r+1, c), v(r, c), v(r, c+1).
 */
export const SIZE = 5;

export type Owner = Player | null;

export interface DotsState {
  size: number;
  /** Who drew each line (null = not drawn yet). */
  h: Owner[];
  v: Owner[];
  /** Who closed each box, row-major. */
  boxes: Owner[];
  turn: Player;
  scores: [number, number];
  winner: Player | 'draw' | null;
  /** The last line drawn, for highlighting and for "closed a box, go again". */
  last: { o: 'h' | 'v'; i: number; by: Player; closed: number } | null;
}

export interface DotsMove {
  o: 'h' | 'v';
  i: number;
}

export function init(starter: Player = Math.random() < 0.5 ? 0 : 1, size = SIZE): DotsState {
  return {
    size,
    h: Array<Owner>((size + 1) * size).fill(null),
    v: Array<Owner>(size * (size + 1)).fill(null),
    boxes: Array<Owner>(size * size).fill(null),
    turn: starter,
    scores: [0, 0],
    winner: null,
    last: null,
  };
}

export function apply(s: DotsState, move: DotsMove, by: Player): DotsState {
  if (s.winner !== null) throw new GameError('err.over');
  if (by !== s.turn) throw new GameError('err.notYourTurn');
  const { o, i } = move ?? ({} as DotsMove);
  const lines = o === 'h' ? s.h : o === 'v' ? s.v : null;
  if (!lines || !Number.isInteger(i) || i < 0 || i >= lines.length) throw new GameError('dots.err.badLine');
  if (lines[i] !== null) throw new GameError('dots.err.taken');

  const n = s.size;
  const h = o === 'h' ? s.h.slice() : s.h;
  const v = o === 'v' ? s.v.slice() : s.v;
  (o === 'h' ? h : v)[i] = by;

  // The (at most two) boxes this line borders.
  const touched: [number, number][] = [];
  if (o === 'h') {
    const r = Math.floor(i / n);
    const c = i % n;
    if (r > 0) touched.push([r - 1, c]);
    if (r < n) touched.push([r, c]);
  } else {
    const r = Math.floor(i / (n + 1));
    const c = i % (n + 1);
    if (c > 0) touched.push([r, c - 1]);
    if (c < n) touched.push([r, c]);
  }

  let boxes = s.boxes;
  let closed = 0;
  for (const [r, c] of touched) {
    const done =
      h[r * n + c] !== null &&
      h[(r + 1) * n + c] !== null &&
      v[r * (n + 1) + c] !== null &&
      v[r * (n + 1) + c + 1] !== null;
    if (done && boxes[r * n + c] === null) {
      if (boxes === s.boxes) boxes = boxes.slice();
      boxes[r * n + c] = by;
      closed++;
    }
  }

  const scores: [number, number] = [...s.scores];
  scores[by] += closed;
  const finished = boxes.every((b) => b !== null);
  const winner = !finished ? null : scores[0] === scores[1] ? 'draw' : scores[0] > scores[1] ? 0 : 1;

  return {
    ...s,
    h,
    v,
    boxes,
    scores,
    winner,
    // Closing a box earns another turn.
    turn: closed > 0 ? by : other(by),
    last: { o, i, by, closed },
  };
}
