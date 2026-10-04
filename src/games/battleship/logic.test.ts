import { describe, expect, it } from 'vitest';
import { GameError } from '../../core/types';
import { apply, fits, FLEET, init, randomFleet, shipCells, SIZE, validFleet, view, type BattleState, type Ship } from './logic';

/** A fixed legal fleet: rows 0, 2, 4, 6 (two ships on row 6). */
const FLEET_A: Ship[] = [
  { r: 0, c: 0, len: 4, dir: 'h' },
  { r: 2, c: 0, len: 3, dir: 'h' },
  { r: 4, c: 0, len: 3, dir: 'h' },
  { r: 6, c: 0, len: 2, dir: 'h' },
  { r: 6, c: 4, len: 2, dir: 'h' },
];
/** Another fleet, vertical ships in columns 7, 5, 3, 1. */
const FLEET_B: Ship[] = [
  { r: 0, c: 7, len: 4, dir: 'v' },
  { r: 0, c: 5, len: 3, dir: 'v' },
  { r: 4, c: 5, len: 3, dir: 'v' },
  { r: 0, c: 3, len: 2, dir: 'v' },
  { r: 0, c: 1, len: 2, dir: 'v' },
];

/** Both placed, player 0 to fire. Player 0 has FLEET_A, player 1 has FLEET_B. */
function started(): BattleState {
  let s = init(0);
  s = apply(s, { type: 'place', ships: FLEET_A }, 0);
  s = apply(s, { type: 'place', ships: FLEET_B }, 1);
  return s;
}

const allCells = (ships: Ship[]) => ships.flatMap(shipCells);
/** Squares with no FLEET_A ship (rows 1, 3, 5, 7): player 1's guaranteed misses. */
const MISSES = [1, 3, 5, 7].flatMap((r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c));
const waste = (k: number) => MISSES[k];

describe('battleship geometry', () => {
  it('lists ship squares in both directions', () => {
    expect(shipCells({ r: 1, c: 2, len: 3, dir: 'h' })).toEqual([10, 11, 12]);
    expect(shipCells({ r: 1, c: 2, len: 3, dir: 'v' })).toEqual([10, 18, 26]);
  });

  it('checks bounds and overlaps', () => {
    expect(fits({ r: 0, c: 5, len: 3, dir: 'h' }, [])).toBe(true);
    expect(fits({ r: 0, c: 6, len: 3, dir: 'h' }, [])).toBe(false);
    expect(fits({ r: 6, c: 0, len: 3, dir: 'v' }, [])).toBe(false);
    expect(fits({ r: -1, c: 0, len: 2, dir: 'v' }, [])).toBe(false);
    expect(fits({ r: 0, c: 2, len: 2, dir: 'v' }, [FLEET_A[0]])).toBe(false);
  });

  it('validates a complete fleet', () => {
    expect(validFleet(FLEET_A)).toBe(true);
    expect(validFleet(FLEET_B)).toBe(true);
    expect(validFleet(FLEET_A.slice(1))).toBe(false); // a ship missing
    expect(validFleet([...FLEET_A.slice(0, 4), { r: 6, c: 4, len: 3, dir: 'h' }])).toBe(false); // wrong lengths
    expect(validFleet([...FLEET_A.slice(0, 4), { r: 6, c: 1, len: 2, dir: 'h' }])).toBe(false); // overlap
    expect(validFleet([...FLEET_A.slice(0, 4), { r: 6, c: 4, len: 2, dir: 'x' }])).toBe(false);
    expect(validFleet('nope')).toBe(false);
    expect(validFleet([null, 1, 2, 3, 4])).toBe(false);
  });

  it('random fleets are always valid and their ships never touch', () => {
    for (let i = 0; i < 300; i++) {
      const f = randomFleet();
      expect(validFleet(f)).toBe(true);
      expect(f.map((s) => s.len).sort()).toEqual([...FLEET].sort());
      for (const [a, b] of f.flatMap((x, i) => f.slice(i + 1).map((y) => [x, y] as const))) {
        for (const p of shipCells(a))
          for (const q of shipCells(b)) {
            const dr = Math.abs(Math.floor(p / SIZE) - Math.floor(q / SIZE));
            const dc = Math.abs((p % SIZE) - (q % SIZE));
            expect(Math.max(dr, dc)).toBeGreaterThan(1);
          }
      }
    }
  });
});

describe('battleship game', () => {
  it('starts playing only after both fleets are placed', () => {
    let s = init(0);
    expect(() => apply(s, { type: 'fire', cell: 0 }, 0)).toThrow('err.notStarted');
    s = apply(s, { type: 'place', ships: FLEET_A }, 0);
    expect(s.phase).toBe('place');
    expect(() => apply(s, { type: 'place', ships: FLEET_A }, 0)).toThrow('battleship.err.placed');
    expect(() => apply(s, { type: 'place', ships: FLEET_A.slice(1) }, 1)).toThrow('battleship.err.badFleet');
    s = apply(s, { type: 'place', ships: FLEET_B }, 1);
    expect(s.phase).toBe('play');
    expect(() => apply(s, { type: 'place', ships: FLEET_B }, 1)).toThrow('battleship.err.notPlacing');
  });

  it('records hits and misses and alternates turns', () => {
    let s = started();
    s = apply(s, { type: 'fire', cell: 7 }, 0); // (0,7) is FLEET_B's 4-ship
    expect(s.last).toEqual({ by: 0, cell: 7, hit: true, sunk: null });
    expect(s.turn).toBe(1);
    s = apply(s, { type: 'fire', cell: waste(0) }, 1);
    expect(s.last).toEqual({ by: 1, cell: waste(0), hit: false, sunk: null });
    expect(s.turn).toBe(0);
  });

  it('rejects illegal shots', () => {
    let s = started();
    expect(() => apply(s, { type: 'fire', cell: 0 }, 1)).toThrow('err.notYourTurn');
    expect(() => apply(s, { type: 'fire', cell: 64 }, 0)).toThrow('battleship.err.badCell');
    expect(() => apply(s, { type: 'fire', cell: 1.5 }, 0)).toThrow(GameError);
    expect(() => apply(s, { type: 'nope' } as never, 0)).toThrow('err.unknownMove');
    s = apply(s, { type: 'fire', cell: 0 }, 0);
    s = apply(s, { type: 'fire', cell: waste(0) }, 1);
    expect(() => apply(s, { type: 'fire', cell: 0 }, 0)).toThrow('battleship.err.alreadyShot');
  });

  it('reports a sunk ship and reveals it to the shooter', () => {
    let s = started();
    // sink FLEET_B's 2-ship at column 1 (squares 1 and 9)
    s = apply(s, { type: 'fire', cell: 1 }, 0);
    s = apply(s, { type: 'fire', cell: waste(0) }, 1);
    s = apply(s, { type: 'fire', cell: 9 }, 0);
    expect(s.last?.sunk).toBe(2);
    expect(view(s, 0).oppSunk).toEqual([FLEET_B[4]]);
    expect(view(s, 1).oppSunk).toEqual([]);
  });

  it('sinking the whole fleet wins', () => {
    let s = started();
    const targets = allCells(FLEET_B);
    targets.forEach((cell, i) => {
      s = apply(s, { type: 'fire', cell }, 0);
      if (i < targets.length - 1) s = apply(s, { type: 'fire', cell: waste(i) }, 1);
    });
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
    expect(view(s, 1).oppShips).toEqual(FLEET_A);
    expect(() => apply(s, { type: 'fire', cell: 63 }, 1)).toThrow('err.over');
  });

  it('never shows the partner fleet before it is sunk or the game ends', () => {
    let s = started();
    s = apply(s, { type: 'fire', cell: 7 }, 0); // one hit only
    for (const me of [0, 1] as const) {
      const v = view(s, me);
      expect(v.oppShips).toBeNull();
      expect(v.oppSunk).toEqual([]);
      const theirs = me === 0 ? FLEET_B : FLEET_A;
      // none of the partner's ship objects appear anywhere in my view
      const { myShips: _mine, ...rest } = v;
      for (const ship of theirs) expect(JSON.stringify(rest)).not.toContain(JSON.stringify(ship));
    }
    expect(view(s, 0).myHits).toEqual([7]);
    expect(view(s, 1).oppShots).toEqual([7]);
  });

  it('keeps only known ship fields and does not mutate the previous state', () => {
    let s = init(0);
    const sneaky = FLEET_A.map((x) => ({ ...x, secret: 'x' }));
    s = apply(s, { type: 'place', ships: sneaky }, 0);
    expect(JSON.stringify(s)).not.toContain('secret');
    const before = JSON.stringify(s);
    apply(s, { type: 'place', ships: FLEET_B }, 1);
    expect(JSON.stringify(s)).toBe(before);
  });
});
