import { describe, expect, it } from 'vitest';
import { GameError, type Player } from '../../core/types';
import {
  apply,
  init,
  MAX_LEN,
  view,
  type Idx,
  type Items,
  type Rng,
  type TruthsMove,
  type TruthsState,
} from './logic';

/** Fixed random sources. IDENTITY keeps the written order; REVERSED gives the order [1, 2, 0]. */
const IDENTITY: Rng = () => 0.999;
const REVERSED: Rng = () => 0;

// Player 0 writes A (lie = A[2]), player 1 writes B (lie = B[1]). With IDENTITY the order is kept.
const A: Items = ['alpha-one', 'alpha-two', 'alpha-LIE'];
const B: Items = ['bravo-one', 'bravo-LIE', 'bravo-three'];
const A_LIE: Idx = 2;
const B_LIE: Idx = 1;

// The right answers: player 0 must pick B's lie, player 1 must pick A's lie.
const HIT: [Idx, Idx] = [B_LIE, A_LIE];
const MISS: [Idx, Idx] = [0, 0];

const write = (s: TruthsState, by: Player, items: Items, lie: Idx, rng: Rng = IDENTITY) =>
  apply(s, { type: 'write', items, lie }, by, rng);
const guess = (s: TruthsState, by: Player, index: Idx) => apply(s, { type: 'guess', index }, by);
const next = (s: TruthsState, by: Player = 0) => apply(s, { type: 'next' }, by);

const bothWrote = (s = init()) => write(write(s, 0, A, A_LIE), 1, B, B_LIE);
const bothGuessed = (g0: Idx, g1: Idx, s = bothWrote()) => guess(guess(s, 0, g0), 1, g1);

/** One whole round, then "next" if the game is not over. */
const playRound = (s: TruthsState, found: [boolean, boolean]) => {
  const done = bothGuessed(found[0] ? HIT[0] : MISS[0], found[1] ? HIT[1] : MISS[1], bothWrote(s));
  return done.phase === 'over' ? done : next(done);
};
/** Play all rounds; `plan[r]` = [did player 0 find the lie, did player 1 find the lie]. */
const playGame = (plan: [boolean, boolean][]) => plan.reduce(playRound, init());

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    return (e as GameError).message;
  }
  return null;
};

describe('two truths and a lie: rules', () => {
  it('starts in round 1, writing, with nothing locked in', () => {
    const s = init();
    expect(s.round).toBe(1);
    expect(s.rounds).toBe(3);
    expect(s.phase).toBe('write');
    expect(s.entries).toEqual([null, null]);
    expect(s.guesses).toEqual([null, null]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.winner).toBeNull();
  });

  it('trims statements and collapses inner whitespace; accepts exactly 140 characters', () => {
    const long = 'x'.repeat(MAX_LEN);
    const s = write(init(), 0, ['  one \n  two ', '\tthree  ', long], 1);
    expect(s.entries[0]?.items).toEqual(['one two', 'three', long]);
  });

  it('rejects empty, blank, too long and malformed statements', () => {
    const s = init();
    const bad = (items: unknown) => errorOf(() => apply(s, { type: 'write', items, lie: 0 } as TruthsMove, 0, IDENTITY));
    expect(bad(['a', 'b', ''])).toBe('truths.err.badStatements');
    expect(bad(['a', '   ', 'c'])).toBe('truths.err.badStatements');
    expect(bad(['a', 'b', 'x'.repeat(MAX_LEN + 1)])).toBe('truths.err.badStatements');
    expect(bad(['a', 'b'])).toBe('truths.err.badStatements');
    expect(bad(['a', 'b', 'c', 'd'])).toBe('truths.err.badStatements');
    expect(bad(['a', 'b', 7])).toBe('truths.err.badStatements');
    expect(bad('abc')).toBe('truths.err.badStatements');
    expect(bad(undefined)).toBe('truths.err.badStatements');
    expect(s.entries).toEqual([null, null]);
  });

  it('rejects a lie index that is not 0, 1 or 2', () => {
    const s = init();
    for (const lie of [3, -1, 1.5, '1', null, undefined, NaN]) {
      const msg = errorOf(() => apply(s, { type: 'write', items: A, lie } as unknown as TruthsMove, 0, IDENTITY));
      expect(msg, String(lie)).toBe('truths.err.badLie');
    }
  });

  it('rejects writing twice, and writing after the writing phase', () => {
    const s = write(init(), 0, A, A_LIE);
    expect(errorOf(() => write(s, 0, A, A_LIE))).toBe('truths.err.alreadyWrote');
    // the partner can still write
    expect(write(s, 1, B, B_LIE).phase).toBe('guess');
    // once both wrote, nobody can write again
    const g = bothWrote();
    expect(errorOf(() => write(g, 0, A, A_LIE))).toBe('truths.err.notWriting');
    expect(errorOf(() => write(g, 1, B, B_LIE))).toBe('truths.err.notWriting');
  });

  it('rejects guessing before the guess phase, twice, and with a bad index', () => {
    const w = write(init(), 0, A, A_LIE);
    expect(errorOf(() => guess(w, 0, 0))).toBe('truths.err.notGuessing');
    expect(errorOf(() => guess(w, 1, 0))).toBe('truths.err.notGuessing');

    const g = bothWrote();
    for (const index of [3, -1, 0.5, '0', null, undefined]) {
      const msg = errorOf(() => apply(g, { type: 'guess', index } as unknown as TruthsMove, 0));
      expect(msg, String(index)).toBe('truths.err.badGuess');
    }

    const once = guess(g, 0, 1);
    expect(errorOf(() => guess(once, 0, 2))).toBe('truths.err.alreadyGuessed');
    expect(once.guesses).toEqual([1, null]); // the first guess stands
    expect(guess(once, 1, 0).phase).toBe('reveal'); // the partner can still guess

    // after the reveal there is nothing left to guess
    const r = bothGuessed(...HIT);
    expect(errorOf(() => guess(r, 0, 0))).toBe('truths.err.notGuessing');
  });

  it('rejects "next" before the reveal', () => {
    expect(errorOf(() => next(init()))).toBe('truths.err.notReveal');
    expect(errorOf(() => next(write(init(), 0, A, A_LIE)))).toBe('truths.err.notReveal');
    expect(errorOf(() => next(bothWrote()))).toBe('truths.err.notReveal');
    expect(errorOf(() => next(guess(bothWrote(), 0, 0)))).toBe('truths.err.notReveal');
  });

  it('rejects unknown moves', () => {
    for (const m of [undefined, null, {}, { type: 'peek' }]) {
      expect(errorOf(() => apply(init(), m as unknown as TruthsMove, 0))).toBe('err.unknownMove');
    }
  });

  it('moves through write → guess → reveal, and "next" starts a fresh round that keeps the score', () => {
    let s = init();
    s = write(s, 0, A, A_LIE);
    expect(s.phase).toBe('write'); // still waiting for player 1
    s = write(s, 1, B, B_LIE);
    expect(s.phase).toBe('guess');
    s = guess(s, 0, HIT[0]);
    expect(s.phase).toBe('guess'); // still waiting for player 1
    expect(s.scores).toEqual([0, 0]); // nothing scored until both are in
    s = guess(s, 1, HIT[1]);
    expect(s.phase).toBe('reveal');
    expect(s.round).toBe(1);
    expect(s.scores).toEqual([1, 1]);

    // either player can press next; the second press is too late
    const n = next(s, 1);
    expect(n.phase).toBe('write');
    expect(n.round).toBe(2);
    expect(n.entries).toEqual([null, null]);
    expect(n.guesses).toEqual([null, null]);
    expect(n.scores).toEqual([1, 1]);
    expect(errorOf(() => next(n, 0))).toBe('truths.err.notReveal');
  });

  it('both players can write in either order', () => {
    const s = write(write(init(), 1, B, B_LIE), 0, A, A_LIE);
    expect(s.phase).toBe('guess');
    expect(s.entries[0]?.items).toEqual(A);
    expect(s.entries[1]?.items).toEqual(B);
  });
});

describe('two truths and a lie: shuffling', () => {
  it('the lie keeps pointing at the same text, whatever the order', () => {
    const randoms = [0, 0.2, 0.34, 0.5, 0.67, 0.8, 0.999];
    for (const r1 of randoms)
      for (const r2 of randoms)
        for (const lie of [0, 1, 2] as const) {
          const seq = [r1, r2];
          const rng: Rng = () => seq.shift() ?? 0;
          const entry = write(init(), 0, A, lie, rng).entries[0]!;
          expect(entry.items[entry.lie], `${r1}/${r2}/${lie}`).toBe(A[lie]);
          // a permutation: nothing lost, nothing duplicated
          expect([...entry.items].sort()).toEqual([...A].sort());
        }
  });

  it('IDENTITY keeps the written order, REVERSED really reorders', () => {
    expect(write(init(), 0, A, A_LIE, IDENTITY).entries[0]).toEqual({ items: A, lie: 2 });
    // order [1, 2, 0]: shown = [A[1], A[2], A[0]], so the lie A[2] is now shown second
    expect(write(init(), 0, A, A_LIE, REVERSED).entries[0]).toEqual({
      items: ['alpha-two', 'alpha-LIE', 'alpha-one'],
      lie: 1,
    });
  });

  it('the partner sees the shuffled order and the lie, once revealed, points at the lie text', () => {
    let s = write(write(init(), 0, A, A_LIE, REVERSED), 1, B, B_LIE, REVERSED);
    expect(view(s, 1).theirs).toEqual(['alpha-two', 'alpha-LIE', 'alpha-one']);
    s = guess(guess(s, 0, 0), 1, 0);
    const v1 = view(s, 1);
    expect(v1.theirs![v1.theirLie!]).toBe('alpha-LIE');
    const v0 = view(s, 0);
    expect(v0.theirs![v0.theirLie!]).toBe('bravo-LIE');
  });

  it('works with the real Math.random (default argument)', () => {
    const s = apply(init(), { type: 'write', items: A, lie: A_LIE }, 0);
    const e = s.entries[0]!;
    expect([...e.items].sort()).toEqual([...A].sort());
    expect(e.items[e.lie]).toBe('alpha-LIE');
  });
});

describe('two truths and a lie: scoring', () => {
  it('finding the lie scores for the finder; missing it scores for the writer', () => {
    // both found: 1 point each
    expect(bothGuessed(HIT[0], HIT[1]).scores).toEqual([1, 1]);
    // neither found: each fooled the other, 1 point each
    expect(bothGuessed(MISS[0], MISS[1]).scores).toEqual([1, 1]);
    // only player 0 found: 1 for finding + 1 for fooling player 1
    expect(bothGuessed(HIT[0], MISS[1]).scores).toEqual([2, 0]);
    // only player 1 found
    expect(bothGuessed(MISS[0], HIT[1]).scores).toEqual([0, 2]);
  });

  it('a truth is not the lie: every wrong pick counts as a miss', () => {
    for (const g0 of [0, 1, 2] as const)
      for (const g1 of [0, 1, 2] as const) {
        const s = bothGuessed(g0, g1);
        const expected: [number, number] = [0, 0];
        if (g0 === B_LIE) expected[0]++;
        else expected[1]++;
        if (g1 === A_LIE) expected[1]++;
        else expected[0]++;
        expect(s.scores, `${g0}/${g1}`).toEqual(expected);
      }
  });

  it('scores add up across rounds', () => {
    const s = playGame([
      [true, false],
      [false, false],
    ]);
    // round 1: [2, 0]; round 2: [1, 1]
    expect(s.scores).toEqual([3, 1]);
    expect(s.round).toBe(3);
    expect(s.phase).toBe('write');
  });
});

describe('two truths and a lie: the whole game', () => {
  it('goes to "over" straight after round 3 (no reveal pause), with the winner', () => {
    const afterTwo = playGame([
      [true, true],
      [true, true],
    ]);
    expect(afterTwo.round).toBe(3);
    const last = bothGuessed(HIT[0], MISS[1], bothWrote(afterTwo));
    expect(last.phase).toBe('over');
    expect(last.round).toBe(3);
    expect(last.scores).toEqual([4, 2]);
    expect(last.winner).toBe(0);
  });

  it('player 1 can win', () => {
    const s = playGame([
      [false, true],
      [true, true],
      [false, true],
    ]);
    // [0,2] + [1,1] + [0,2]
    expect(s.scores).toEqual([1, 5]);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(1);
  });

  it('can end in a draw', () => {
    const s = playGame([
      [true, true],
      [false, false],
      [true, true],
    ]);
    expect(s.scores).toEqual([3, 3]);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('draw');
  });

  it('nothing works once the game is over', () => {
    const s = playGame([
      [true, true],
      [true, true],
      [true, true],
    ]);
    expect(s.phase).toBe('over');
    for (const m of [
      { type: 'write', items: A, lie: 0 },
      { type: 'guess', index: 0 },
      { type: 'next' },
    ] as TruthsMove[]) {
      expect(errorOf(() => apply(s, m, 0, IDENTITY))).toBe('err.over');
    }
  });
});

describe('two truths and a lie: hidden information', () => {
  it('keeps the partner’s statements out of the view until both have written', () => {
    const s = write(init(), 0, A, A_LIE); // player 0 wrote, player 1 has not

    const v1 = view(s, 1);
    const json1 = JSON.stringify(v1);
    for (const text of A) expect(json1).not.toContain(text);
    expect(v1.theirs).toBeNull();
    expect(v1.mine).toBeNull();
    expect(v1.oppWrote).toBe(true); // it may know THAT they wrote, never WHAT

    // player 0 sees their own statements and lie, and nothing of the partner
    const v0 = view(s, 0);
    expect(v0.mine).toEqual({ items: A, lie: A_LIE });
    expect(v0.oppWrote).toBe(false);
    expect(v0.theirs).toBeNull();
    for (const text of B) expect(JSON.stringify(v0)).not.toContain(text);

    // the same holds when it is player 1 who wrote first
    const s2 = write(init(), 1, B, B_LIE);
    for (const text of B) expect(JSON.stringify(view(s2, 0))).not.toContain(text);
  });

  it('shows the partner’s statements but not the lie or the partner’s guess during the guess phase', () => {
    const g = bothWrote();
    const v0 = view(g, 0);
    expect(v0.theirs).toEqual(B);
    expect(v0.mine).toEqual({ items: A, lie: A_LIE });
    expect(v0.theirLie).toBeNull();
    expect(v0.oppGuess).toBeNull();
    expect(v0.oppGuessed).toBe(false);

    // player 1 guesses: player 0 learns only THAT, not what
    const afterP1 = guess(g, 1, 2);
    const v0b = view(afterP1, 0);
    expect(v0b.oppGuessed).toBe(true);
    expect(v0b.oppGuess).toBeNull();
    expect(v0b.theirLie).toBeNull();
    expect(v0b.myGuess).toBeNull();
    // and player 1 sees their own guess
    expect(view(afterP1, 1).myGuess).toBe(2);
  });

  it('the guess-phase view does not change with the partner’s lie or the partner’s pending guess', () => {
    const g = bothWrote();
    const lies = (l0: Idx, l1: Idx): TruthsState => ({
      ...g,
      entries: [
        { items: A, lie: l0 },
        { items: B, lie: l1 },
      ],
    });
    const json = (s: TruthsState, me: Player) => JSON.stringify(view(s, me));

    // player 0's view is the same whichever statement player 1 chose as the lie
    expect(json(lies(A_LIE, 0), 0)).toBe(json(lies(A_LIE, 1), 0));
    expect(json(lies(A_LIE, 1), 0)).toBe(json(lies(A_LIE, 2), 0));
    // player 1's view is the same whichever statement player 0 chose as the lie
    expect(json(lies(0, B_LIE), 1)).toBe(json(lies(1, B_LIE), 1));
    expect(json(lies(1, B_LIE), 1)).toBe(json(lies(2, B_LIE), 1));

    // ...and whichever statement the partner has already picked
    expect(json({ ...g, guesses: [null, 0] }, 0)).toBe(json({ ...g, guesses: [null, 2] }, 0));
    expect(json({ ...g, guesses: [0, null] }, 1)).toBe(json({ ...g, guesses: [2, null] }, 1));

    // sanity check: once revealed the same difference does show
    const r = (l1: Idx): TruthsState => ({ ...lies(A_LIE, l1), phase: 'reveal', guesses: [0, 0] });
    expect(json(r(0), 0)).not.toBe(json(r(2), 0));
  });

  it('only exposes known keys, never the raw state', () => {
    const keys = [
      'mine',
      'myGuess',
      'oppGuess',
      'oppGuessed',
      'oppWrote',
      'phase',
      'round',
      'rounds',
      'scores',
      'theirLie',
      'theirs',
      'winner',
    ];
    for (const s of [init(), bothWrote(), bothGuessed(...HIT)]) {
      expect(Object.keys(view(s, 0)).sort()).toEqual(keys);
      expect(Object.keys(view(s, 1)).sort()).toEqual(keys);
    }
  });

  it('reveals the lie and the partner’s guess in the reveal', () => {
    const r = bothGuessed(0, 2); // player 0 misses (picks 0, lie is 1), player 1 hits A's lie (2)
    expect(r.phase).toBe('reveal');

    const v0 = view(r, 0);
    expect(v0.theirs).toEqual(B);
    expect(v0.theirLie).toBe(B_LIE);
    expect(v0.myGuess).toBe(0);
    expect(v0.oppGuess).toBe(2); // player 1's pick among player 0's statements
    expect(v0.oppGuessed).toBe(true);
    expect(v0.mine).toEqual({ items: A, lie: A_LIE });

    const v1 = view(r, 1);
    expect(v1.theirs).toEqual(A);
    expect(v1.theirLie).toBe(A_LIE);
    expect(v1.myGuess).toBe(2);
    expect(v1.oppGuess).toBe(0);
  });

  it('keeps showing the reveal data in the final state', () => {
    const s = playGame([
      [true, true],
      [true, true],
      [true, false],
    ]);
    expect(s.phase).toBe('over');
    const v0 = view(s, 0);
    expect(v0.theirLie).toBe(B_LIE);
    expect(v0.oppGuess).toBe(0);
    expect(v0.winner).toBe(0);
    expect(view(s, 1).theirLie).toBe(A_LIE);
  });

  it('hides the previous round’s secrets once the next round has begun', () => {
    const s = next(bothGuessed(...HIT));
    for (const me of [0, 1] as const) {
      const v = view(s, me);
      expect(v.mine).toBeNull();
      expect(v.theirs).toBeNull();
      expect(v.theirLie).toBeNull();
      expect(v.oppGuess).toBeNull();
      expect(v.myGuess).toBeNull();
      expect(v.oppWrote).toBe(false);
      expect(v.oppGuessed).toBe(false);
      const json = JSON.stringify(v);
      for (const text of [...A, ...B]) expect(json).not.toContain(text);
    }
  });
});

describe('two truths and a lie: state hygiene', () => {
  it('views have every key present (null, never undefined) and survive JSON', () => {
    const states = [
      init(),
      write(init(), 0, A, A_LIE),
      bothWrote(),
      guess(bothWrote(), 0, 1),
      bothGuessed(...HIT),
      playGame([[true, true], [true, true], [true, true]]),
    ];
    for (const s of states)
      for (const me of [0, 1] as const) {
        const v = view(s, me);
        for (const [k, val] of Object.entries(v)) expect(val, k).not.toBeUndefined();
        expect(JSON.parse(JSON.stringify(v))).toEqual(v);
        expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      }
  });

  it('never mutates the previous state', () => {
    // deep-frozen states throw on any write (ES modules are strict), so a pass proves no mutation
    let s = deepFreeze(init());
    const step = (to: TruthsState) => (s = deepFreeze(to));
    step(write(s, 0, A, A_LIE, REVERSED));
    step(write(s, 1, B, B_LIE, REVERSED));
    step(guess(s, 1, 0));
    step(guess(s, 0, 2));
    expect(s.phase).toBe('reveal');
    step(next(s));
    for (const me of [0, 1] as const) view(s, me); // building a view does not touch the state either

    // and failed moves leave the state exactly as it was
    const before = JSON.stringify(s);
    errorOf(() => guess(s, 0, 0));
    errorOf(() => next(s));
    expect(JSON.stringify(s)).toBe(before);
  });

  it('keeps unchanged top-level view values reference-stable (the sync layer re-sends only changes)', () => {
    const w0 = write(init(), 0, A, A_LIE);
    const w1 = write(w0, 1, B, B_LIE);
    // my statements and the scores did not change when the partner wrote
    expect(view(w1, 0).mine).toBe(view(w0, 0).mine);
    expect(view(w1, 0).scores).toBe(view(w0, 0).scores);

    // the partner's statements stay the same object while guesses come in
    const g1 = guess(w1, 0, 0);
    const g2 = guess(g1, 1, 0);
    for (const me of [0, 1] as const) {
      expect(view(g1, me).theirs).toBe(view(w1, me).theirs);
      expect(view(g2, me).theirs).toBe(view(g1, me).theirs);
      expect(view(g2, me).mine).toBe(view(w1, me).mine);
    }
    // scores only change at the reveal
    expect(view(g1, 0).scores).toBe(view(w1, 0).scores);
    expect(view(g2, 0).scores).not.toBe(view(g1, 0).scores);
  });
});

describe('next round pressed by both players at once', () => {
  it('advances once and ignores the second press for the same round', () => {
    const rng = () => 0.5;
    let s = init();
    s = apply(s, { type: 'write', items: ['a', 'b', 'c'], lie: 0 }, 0, rng);
    s = apply(s, { type: 'write', items: ['d', 'e', 'f'], lie: 1 }, 1, rng);
    s = apply(s, { type: 'guess', index: 0 }, 0, rng);
    s = apply(s, { type: 'guess', index: 0 }, 1, rng);
    expect(s.phase).toBe('reveal');
    const next = apply(s, { type: 'next', round: 1 }, 0, rng);
    expect(next.round).toBe(2);
    expect(next.phase).toBe('write');
    // the partner's press for round 1 arrives after the round moved on: no error, no change
    expect(apply(next, { type: 'next', round: 1 }, 1, rng)).toBe(next);
  });
});
