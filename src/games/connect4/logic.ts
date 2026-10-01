import { GameError, other, type Player } from '../../core/types';

export const ROWS = 6;
export const COLS = 7;

export type Cell = Player | null;

export interface C4State {
  /** Row-major, row 0 is the top. */
  cells: Cell[];
  turn: Player;
  winner: Player | 'draw' | null;
  /** Winning cells, for highlighting. */
  line: number[] | null;
  /** Index of the last dropped piece, for the drop animation. */
  last: number | null;
}

export interface C4Move {
  col: number;
}

export function init(starter: Player = Math.random() < 0.5 ? 0 : 1): C4State {
  return { cells: Array<Cell>(ROWS * COLS).fill(null), turn: starter, winner: null, line: null, last: null };
}

export function apply(s: C4State, move: C4Move, by: Player): C4State {
  if (s.winner !== null) throw new GameError('err.over');
  if (by !== s.turn) throw new GameError('err.notYourTurn');
  const col = move?.col;
  if (!Number.isInteger(col) || col < 0 || col >= COLS) throw new GameError('err.pickColumn');

  let row = ROWS - 1;
  while (row >= 0 && s.cells[row * COLS + col] !== null) row--;
  if (row < 0) throw new GameError('err.columnFull');

  const cells = s.cells.slice();
  const idx = row * COLS + col;
  cells[idx] = by;
  const line = findLine(cells, row, col, by);
  const winner = line ? by : cells.every((c) => c !== null) ? 'draw' : null;
  return { cells, turn: other(by), winner, line, last: idx };
}

function findLine(cells: Cell[], row: number, col: number, p: Player): number[] | null {
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    const line = [row * COLS + col];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && cells[r * COLS + c] === p) {
        line.push(r * COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}
