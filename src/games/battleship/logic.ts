import { GameError, other, type Player } from '../../core/types';

/**
 * Battleship on an 8 × 8 sea. Each player secretly places a fleet, then they take turns firing at
 * the other's sea. A ship sinks when all its squares are hit; sinking the whole fleet wins.
 *
 * Square index = r * SIZE + c (row-major, row 0 at the top).
 */
export const SIZE = 8;
export const FLEET = [4, 3, 3, 2, 2] as const;

export type Dir = 'h' | 'v';

/** A ship by its bow (top-left end) square, length and direction. */
export interface Ship {
  r: number;
  c: number;
  len: number;
  dir: Dir;
}

export interface Shot {
  by: Player;
  cell: number;
  hit: boolean;
  /** Length of the ship this shot sank, or null. */
  sunk: number | null;
}

export interface BattleState {
  phase: 'place' | 'play' | 'over';
  /** ships[p] = player p's own fleet (null until placed). */
  ships: [Ship[] | null, Ship[] | null];
  /** shots[p] = squares player p fired at in the OTHER player's sea, in order. */
  shots: [number[], number[]];
  turn: Player;
  winner: Player | null;
  last: Shot | null;
}

export type BattleMove = { type: 'place'; ships: Ship[] } | { type: 'fire'; cell: number };

/** What one player may see: their own fleet, and only what their shots revealed of the partner's. */
export interface BattleView {
  phase: BattleState['phase'];
  turn: Player;
  winner: Player | null;
  last: Shot | null;
  myShips: Ship[] | null;
  oppReady: boolean;
  /** My shots at the partner's sea and which of them hit. */
  myShots: number[];
  myHits: number[];
  /** Partner ships I have sunk (their position is revealed once sunk). */
  oppSunk: Ship[];
  /** Partner shots at my sea. */
  oppShots: number[];
  /** The partner's whole fleet, only once the game is over. */
  oppShips: Ship[] | null;
}

// ---------- geometry ----------

export function shipCells(s: Ship): number[] {
  return Array.from({ length: s.len }, (_, k) => (s.dir === 'h' ? s.r * SIZE + s.c + k : (s.r + k) * SIZE + s.c));
}

const inside = (s: Ship) =>
  Number.isInteger(s.r) &&
  Number.isInteger(s.c) &&
  s.r >= 0 &&
  s.c >= 0 &&
  (s.dir === 'h' ? s.c + s.len <= SIZE && s.r < SIZE : s.r + s.len <= SIZE && s.c < SIZE);

/** Can `ship` go here without leaving the sea or overlapping `others`? */
export function fits(ship: Ship, others: Ship[]): boolean {
  if (!inside(ship)) return false;
  const taken = new Set(others.flatMap(shipCells));
  return shipCells(ship).every((k) => !taken.has(k));
}

/** A complete, valid fleet: exactly the FLEET lengths, inside the sea, no overlaps. */
export function validFleet(raw: unknown): raw is Ship[] {
  if (!Array.isArray(raw) || raw.length !== FLEET.length) return false;
  const ships: Ship[] = [];
  for (const x of raw) {
    if (typeof x !== 'object' || x === null) return false;
    const { r, c, len, dir } = x as Ship;
    const s = { r, c, len, dir };
    if ((dir !== 'h' && dir !== 'v') || !Number.isInteger(len) || !fits(s, ships)) return false;
    ships.push(s);
  }
  const want = [...FLEET].sort().join();
  return ships.map((s) => s.len).sort().join() === want;
}

/** A random fleet. Ships don't touch (not even corners) when possible, which looks nicer. */
export function randomFleet(rng: () => number = Math.random): Ship[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const ships: Ship[] = [];
    const blocked = new Set<number>();
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 100 && !placed; tries++) {
        const dir: Dir = rng() < 0.5 ? 'h' : 'v';
        const s: Ship = { r: Math.floor(rng() * SIZE), c: Math.floor(rng() * SIZE), len, dir };
        if (!inside(s) || shipCells(s).some((k) => blocked.has(k))) continue;
        ships.push(s);
        // block the ship and its 8 neighbours
        for (const k of shipCells(s)) {
          const r = Math.floor(k / SIZE);
          const c = k % SIZE;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const rr = r + dr;
              const cc = c + dc;
              if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) blocked.add(rr * SIZE + cc);
            }
        }
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return ships;
  }
  // Practically unreachable on an 8 × 8 sea; fall back to a fixed layout.
  return [
    { r: 0, c: 0, len: 4, dir: 'h' },
    { r: 2, c: 0, len: 3, dir: 'h' },
    { r: 4, c: 0, len: 3, dir: 'h' },
    { r: 6, c: 0, len: 2, dir: 'h' },
    { r: 6, c: 4, len: 2, dir: 'h' },
  ];
}

// ---------- game ----------

export function init(starter: Player = Math.random() < 0.5 ? 0 : 1): BattleState {
  return { phase: 'place', ships: [null, null], shots: [[], []], turn: starter, winner: null, last: null };
}

const sunkBy = (ship: Ship, shots: number[]) => shipCells(ship).every((k) => shots.includes(k));

export function apply(s: BattleState, move: BattleMove, by: Player): BattleState {
  if (s.phase === 'over') throw new GameError('err.over');

  switch (move?.type) {
    case 'place': {
      if (s.phase !== 'place') throw new GameError('battleship.err.notPlacing');
      if (s.ships[by] !== null) throw new GameError('battleship.err.placed');
      if (!validFleet(move.ships)) throw new GameError('battleship.err.badFleet');
      const ships: BattleState['ships'] = [...s.ships];
      // keep only the known fields (a modified client can't smuggle extra data into the state)
      ships[by] = move.ships.map(({ r, c, len, dir }) => ({ r, c, len, dir }));
      const ready = ships[0] !== null && ships[1] !== null;
      return { ...s, ships, phase: ready ? 'play' : 'place' };
    }

    case 'fire': {
      if (s.phase !== 'play') throw new GameError('err.notStarted');
      if (by !== s.turn) throw new GameError('err.notYourTurn');
      const cell = move.cell;
      if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) throw new GameError('battleship.err.badCell');
      if (s.shots[by].includes(cell)) throw new GameError('battleship.err.alreadyShot');

      const mine = [...s.shots[by], cell];
      const shots: BattleState['shots'] = [...s.shots];
      shots[by] = mine;

      const target = s.ships[other(by)] as Ship[];
      const ship = target.find((x) => shipCells(x).includes(cell)) ?? null;
      const hit = ship !== null;
      const sunk = ship !== null && sunkBy(ship, mine) ? ship.len : null;
      const won = target.every((x) => sunkBy(x, mine));

      return {
        ...s,
        shots,
        phase: won ? 'over' : 'play',
        winner: won ? by : null,
        turn: won ? s.turn : other(by),
        last: { by, cell, hit, sunk },
      };
    }

    default:
      throw new GameError('err.unknownMove');
  }
}

export function view(s: BattleState, me: Player): BattleView {
  const opp = other(me);
  const theirs = s.ships[opp];
  const myShots = s.shots[me];
  const hitCells = theirs ? new Set(theirs.flatMap(shipCells)) : new Set<number>();
  return {
    phase: s.phase,
    turn: s.turn,
    winner: s.winner,
    last: s.last,
    myShips: s.ships[me],
    oppReady: theirs !== null,
    myShots,
    myHits: myShots.filter((k) => hitCells.has(k)),
    oppSunk: theirs ? theirs.filter((x) => sunkBy(x, myShots)) : [],
    oppShots: s.shots[opp],
    oppShips: s.phase === 'over' ? theirs : null,
  };
}
