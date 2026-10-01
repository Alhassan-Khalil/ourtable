import { GameError, other, type Player } from '../../core/types';

/**
 * Snakes and Ladders on a 10 × 10 board, squares 1..100.
 *
 * Squares are numbered boustrophedon from the bottom-left: the bottom row runs 1 → 10 left to right,
 * the next one 11 → 20 right to left, and so on up to 100 in the top-left corner.
 * Position 0 means "not on the board yet".
 */
export const COLS = 10;
export const ROWS = 10;
export const LAST = COLS * ROWS;

/** Classic map: foot → top. */
export const LADDERS: Readonly<Record<number, number>> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

/** Classic map: head → tail. */
export const SNAKES: Readonly<Record<number, number>> = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

export interface Roll {
  by: Player;
  die: number;
  /** Where the token stood before the roll. */
  from: number;
  /** The square the die took it to (before any ladder or snake). Equals `from` when it stayed. */
  landed: number;
  /** Where it ended up after the ladder or snake. */
  to: number;
  via: 'ladder' | 'snake' | null;
  /** The roll would have passed 100, so the token did not move. */
  stayed: boolean;
}

export interface SnakesState {
  pos: [number, number];
  turn: Player;
  winner: Player | null;
  last: Roll | null;
  /** Counts every roll, so the screen can replay the die animation even if the same number comes up twice. */
  rolls: number;
}

export interface SnakesMove {
  type: 'roll';
}

/** The row and column of a square. `row` counts from the TOP (0..9) and `col` from the left (0..9). */
export function squareToCell(n: number): { row: number; col: number } {
  const i = n - 1;
  const fromBottom = Math.floor(i / COLS);
  const k = i % COLS;
  return { row: ROWS - 1 - fromBottom, col: fromBottom % 2 === 0 ? k : COLS - 1 - k };
}

export function init(starter: Player = Math.random() < 0.5 ? 0 : 1): SnakesState {
  return { pos: [0, 0], turn: starter, winner: null, last: null, rolls: 0 };
}

/** 1..6 from a random source returning [0, 1). */
export function rollDie(rng: () => number): number {
  return Math.min(5, Math.floor(rng() * 6)) + 1;
}

/** The die is rolled here, so only the host (which runs `apply`) ever decides the number. */
export function apply(s: SnakesState, move: SnakesMove, by: Player, rng: () => number = Math.random): SnakesState {
  if (s.winner !== null) throw new GameError('err.over');
  if (by !== s.turn) throw new GameError('err.notYourTurn');
  if (move?.type !== 'roll') throw new GameError('err.unknownMove');

  const from = s.pos[by];
  const die = rollDie(rng);
  // Must land exactly on 100: a roll that would pass it leaves the token where it is.
  const stayed = from + die > LAST;
  const landed = stayed ? from : from + die;
  const ladder = stayed ? undefined : LADDERS[landed];
  const snake = stayed ? undefined : SNAKES[landed];
  const via = ladder !== undefined ? 'ladder' : snake !== undefined ? 'snake' : null;
  const to = ladder ?? snake ?? landed;

  const pos: [number, number] = [s.pos[0], s.pos[1]];
  pos[by] = to;

  return {
    pos,
    turn: other(by),
    winner: to === LAST ? by : null,
    last: { by, die, from, landed, to, via, stayed },
    rolls: s.rolls + 1,
  };
}
