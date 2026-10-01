import { GameError, other, type Player } from '../../core/types';

/**
 * Ultimate Tic-Tac-Toe: nine small 3×3 boards arranged in a big 3×3 grid.
 *
 * Cell index `i = board * 9 + cell`, board 0..8 and cell 0..8, both row-major.
 * The cell you play decides where your opponent plays next: cell c sends them to board c.
 * Player 0 is ✕, player 1 is ◯ (by seat).
 */
export const BOARDS = 9;
export const CELLS = 81;

export type Owner = Player | null;
/** A small board: won by a player, drawn (full without a line), or still open (null). */
export type Small = Player | 'draw' | null;

export interface UtttState {
  cells: Owner[];
  small: Small[];
  /** The board the current player must play in, or null for "anywhere that is still open". */
  next: number | null;
  turn: Player;
  winner: Player | 'draw' | null;
  /** The three small boards that won the game, for highlighting. */
  line: number[] | null;
  /** Index of the last cell played. */
  last: number | null;
}

export interface UtttMove {
  i: number;
}

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** The first line of three equal player marks in a 3×3 grid. Drawn boards never count. */
function findLine(at: (k: number) => Small | Owner): { who: Player; line: number[] } | null {
  for (const [a, b, c] of LINES) {
    const v = at(a);
    if ((v === 0 || v === 1) && v === at(b) && v === at(c)) return { who: v, line: [a, b, c] };
  }
  return null;
}

export function init(starter: Player = Math.random() < 0.5 ? 0 : 1): UtttState {
  return {
    cells: Array<Owner>(CELLS).fill(null),
    small: Array<Small>(BOARDS).fill(null),
    next: null,
    turn: starter,
    winner: null,
    line: null,
    last: null,
  };
}

export function apply(s: UtttState, move: UtttMove, by: Player): UtttState {
  if (s.winner !== null) throw new GameError('err.over');
  if (by !== s.turn) throw new GameError('err.notYourTurn');
  const i = move?.i;
  if (!Number.isInteger(i) || i < 0 || i >= CELLS) throw new GameError('uttt.err.badCell');

  const board = Math.floor(i / 9);
  const cell = i % 9;
  if (s.next !== null && s.next !== board) throw new GameError('uttt.err.wrongBoard');
  if (s.small[board] !== null) throw new GameError('uttt.err.boardDone');
  if (s.cells[i] !== null) throw new GameError('uttt.err.taken');

  const cells = s.cells.slice();
  cells[i] = by;

  // Did this move settle the small board?
  const small = s.small.slice();
  const base = board * 9;
  if (findLine((k) => cells[base + k])) small[board] = by;
  else if (cells.slice(base, base + 9).every((c) => c !== null)) small[board] = 'draw';

  // Did it settle the whole game? Only the board that just changed can have made a new line.
  const big = findLine((k) => small[k]);
  const winner: Player | 'draw' | null = big ? big.who : small.every((x) => x !== null) ? 'draw' : null;

  return {
    cells,
    small,
    // The cell played names the next board; if that board is finished, the opponent may play anywhere.
    next: winner === null && small[cell] === null ? cell : null,
    turn: other(by),
    winner,
    line: big ? big.line : null,
    last: i,
  };
}
