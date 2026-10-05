import { FINISH, LAST_ON_TRACK, squareOf, YARD } from './logic';

/**
 * Geometry of the 15 × 15 cross board, in cell units (a cell spans [c, c + 1] × [r, r + 1]).
 * Everything is drawn for corner 0 (top-left yard) and turned a quarter clockwise per corner:
 * corner 1 is top-right, 2 bottom-right, 3 bottom-left.
 */
export const N = 15;

export type Cell = [col: number, row: number];
export type Pt = { x: number; y: number };

/** A quarter turn clockwise (screen coordinates, y down), `k` times. */
export function turnCell([c, r]: Cell, k: number): Cell {
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) [c, r] = [N - 1 - r, c];
  return [c, r];
}
export function turnPt({ x, y }: Pt, k: number): Pt {
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) [x, y] = [N - y, x];
  return { x, y };
}

/** The first 13 squares of the track, from corner 0's start square (1, 6) clockwise. */
const QUARTER: Cell[] = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
];

/** The 52 main-track squares, by square number. */
export const TRACK: Cell[] = [0, 1, 2, 3].flatMap((k) => QUARTER.map((c) => turnCell(c, k)));

/** Each corner's home column (progress 51..55). */
export const HOME_COLUMN: Cell[][] = [0, 1, 2, 3].map((k) =>
  ([[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]] as Cell[]).map((c) => turnCell(c, k)),
);

/** Top-left cell of each corner's 6 × 6 yard. */
export const YARD_ORIGIN: Cell[] = [
  [0, 0],
  [9, 0],
  [9, 9],
  [0, 9],
];

/** Waiting spots in the yard, for 2 or 4 tokens. */
const YARD_SPOTS: Record<number, Pt[]> = {
  2: [{ x: 2, y: 2 }, { x: 4, y: 4 }],
  4: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 4 }],
};
/** Finished tokens rest inside the corner's centre triangle. */
const FINISH_SPOTS: Record<number, Pt[]> = {
  2: [{ x: 6.45, y: 7.2 }, { x: 6.45, y: 7.8 }],
  4: [{ x: 6.38, y: 6.95 }, { x: 6.38, y: 7.5 }, { x: 6.38, y: 8.05 }, { x: 6.9, y: 7.5 }],
};

export const yardSpot = (corner: number, token: number, count: number): Pt =>
  turnPt((YARD_SPOTS[count] ?? YARD_SPOTS[4])[token % (count === 2 ? 2 : 4)], corner);

export const finishSpot = (corner: number, token: number, count: number): Pt =>
  turnPt((FINISH_SPOTS[count] ?? FINISH_SPOTS[4])[token % (count === 2 ? 2 : 4)], corner);

/** The centre of the whole yard (a big tap target for "bring a token out"). */
export const yardCentre = (corner: number): Pt => turnPt({ x: 3, y: 3 }, corner);

/** The centre triangle of a corner, as an SVG points list (in cell units). */
export const triangle = (corner: number): Pt[] =>
  [{ x: 6, y: 6 }, { x: 6, y: 9 }, { x: 7.5, y: 7.5 }].map((p) => turnPt(p, corner));

/** The cell a token stands in (null in the yard or once finished). */
export function cellOf(corner: number, p: number): Cell | null {
  if (p === YARD || p >= FINISH) return null;
  if (p <= LAST_ON_TRACK) return TRACK[squareOf(corner, p)];
  return HOME_COLUMN[corner][p - LAST_ON_TRACK - 1];
}

/**
 * Where a token is drawn: its centre, and a key shared by every token in the same spot
 * (yard and finish spots are per token, so they never stack).
 */
export function placeOf(corner: number, p: number, token: number, count: number): { key: string } & Pt {
  if (p === YARD) return { key: `y${corner}.${token}`, ...yardSpot(corner, token, count) };
  if (p >= FINISH) return { key: `f${corner}.${token}`, ...finishSpot(corner, token, count) };
  const [c, r] = cellOf(corner, p)!;
  return { key: `c${c}.${r}`, x: c + 0.5, y: r + 0.5 };
}
