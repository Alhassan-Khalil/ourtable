import { describe, expect, it } from 'vitest';
import type { Seat } from '../../core/types';
import { apply, captureFor, fullDeck, init, scoreRound, view, type BasraState } from './logic';

/** A seeded random source, so deals are repeatable. */
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

/** A 2-player round in progress, with the given hands and floor. */
function at(hands: string[][], floor: string[], extra: Partial<BasraState> = {}): BasraState {
  const n = hands.length;
  return {
    players: n,
    length: 'one',
    deck: [],
    hands,
    floor,
    taken: Array.from({ length: n }, () => []),
    basras: Array(n).fill(0),
    scores: Array(n).fill(0),
    carry: 0,
    lastTaker: null,
    dealer: (n - 1) as Seat,
    turn: 0,
    round: 1,
    phase: 'play',
    winner: null,
    last: null,
    result: null,
    seq: 0,
    ...extra,
  };
}

const sorted = (a: string[]) => [...a].sort();

describe('basra: what a card takes', () => {
  it('a numeral takes the same value', () => {
    expect(captureFor(['5H', 'KS', '5C'], '5D')).toEqual({ take: ['5H', '5C'], basra: false });
  });

  it('a numeral takes groups adding up to it, and the same value at once', () => {
    // 9 takes 5+4 and 7+2: the whole floor
    expect(captureFor(['5S', '4H', '2D', '7C'], '9S')).toEqual({ take: ['5S', '4H', '2D', '7C'], basra: true });
    // an ace counts 1
    expect(captureFor(['2S', 'AH'], '3D')).toEqual({ take: ['2S', 'AH'], basra: true });
  });

  it('picks the split that takes the most cards', () => {
    // the 6 itself, plus 3+2+A (3 cards) rather than 4+2 (2 cards): they share the 2
    const c = captureFor(['3S', '2H', 'AD', '4C', '6H'], '6S');
    expect(sorted(c.take)).toEqual(sorted(['3S', '2H', 'AD', '6H']));
    expect(c.basra).toBe(false);
  });

  it('a numeral never sums with picture cards and takes nothing it cannot', () => {
    expect(captureFor(['QS', 'KH', '9D'], '8C')).toEqual({ take: [], basra: false });
  });

  it('queens and kings only take their own rank', () => {
    expect(captureFor(['QS', 'QH', '2D'], 'QC')).toEqual({ take: ['QS', 'QH'], basra: false });
    expect(captureFor(['KS'], 'KD')).toEqual({ take: ['KS'], basra: true });
    expect(captureFor(['QS', '5H'], 'KD').take).toEqual([]);
  });

  it('a jack sweeps the floor but is never a basra', () => {
    expect(captureFor(['QS', '5H', '9C'], 'JD')).toEqual({ take: ['QS', '5H', '9C'], basra: false });
    expect(captureFor(['JS'], 'JD')).toEqual({ take: ['JS'], basra: false });
    expect(captureFor([], 'JD')).toEqual({ take: [], basra: false });
  });

  it('the 7♦ sweeps; a basra only on small numerals or what a 7 would clear', () => {
    expect(captureFor(['3S', '5H'], '7D')).toEqual({ take: ['3S', '5H'], basra: true }); // 8 ≤ 10
    expect(captureFor(['9S', '8H'], '7D')).toEqual({ take: ['9S', '8H'], basra: false }); // 17
    expect(captureFor(['5S', '2H', '4C', '3D'], '7D').basra).toBe(true); // 5+2, 4+3: a 7 clears it
    expect(captureFor(['QS', 'AH'], '7D')).toEqual({ take: ['QS', 'AH'], basra: false }); // a queen there
  });
});

describe('basra: playing a round', () => {
  it('deals 4 each and 4 to the floor, never a jack or the 7♦ on the floor', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = init({ length: 'one' }, seed % 2 ? 2 : 3, seeded(seed));
      expect(s.hands.every((h) => h.length === 4)).toBe(true);
      expect(s.floor).toHaveLength(4);
      expect(s.floor.some((c) => c.startsWith('J') || c === '7D')).toBe(false);
      const all = [...s.deck, ...s.floor, ...s.hands.flat()];
      expect(sorted(all)).toEqual(sorted(fullDeck()));
      expect(s.turn).toBe((s.dealer + 1) % s.players);
    }
  });

  it('a card that takes nothing stays on the floor', () => {
    const s = apply(at([['8C', '2S'], ['3H', '4D']], ['QS', '9D']), { type: 'play', card: '8C' }, 0);
    expect(s.floor).toEqual(['QS', '9D', '8C']);
    expect(s.hands[0]).toEqual(['2S']);
    expect(s.turn).toBe(1);
    expect(s.last).toEqual({ by: 0, card: '8C', take: [], basra: false, dealt: false });
    expect(s.seq).toBe(1);
  });

  it('a capture goes to the pile with the card that took it, and counts the basra', () => {
    const s = apply(at([['5C', '2S'], ['3H', '4D']], ['2H', '3S']), { type: 'play', card: '5C' }, 0);
    expect(s.floor).toEqual([]);
    expect(sorted(s.taken[0])).toEqual(sorted(['2H', '3S', '5C']));
    expect(s.basras).toEqual([1, 0]);
    expect(s.lastTaker).toBe(0);
  });

  it('rejects bad moves', () => {
    const s = at([['5C', '2S'], ['3H', '4D']], ['2H']);
    expect(() => apply(s, { type: 'play', card: '3H' }, 1)).toThrow('err.notYourTurn');
    expect(() => apply(s, { type: 'play', card: '3H' }, 0)).toThrow('basra.err.notInHand');
    expect(() => apply(s, { type: 'play', card: 5 as unknown as string }, 0)).toThrow('basra.err.notInHand');
    expect(() => apply(s, { type: 'next' }, 0)).toThrow('basra.err.notYet');
    expect(() => apply(s, { type: 'nope' } as never, 0)).toThrow('err.unknownMove');
    expect(() => apply({ ...s, phase: 'scored' }, { type: 'play', card: '5C' }, 0)).toThrow('basra.err.roundOver');
    expect(() => apply({ ...s, phase: 'over' }, { type: 'play', card: '5C' }, 0)).toThrow('err.over');
  });

  it('deals 4 more each when every hand is empty', () => {
    const deck = ['AS', '2S', '3S', '4S', 'AH', '2H', '3H', '4H', '9C'];
    let s = at([['8C'], ['KD']], ['QS'], { deck });
    s = apply(s, { type: 'play', card: '8C' }, 0);
    s = apply(s, { type: 'play', card: 'KD' }, 1);
    expect(s.hands).toEqual([
      ['AS', '2S', '3S', '4S'],
      ['AH', '2H', '3H', '4H'],
    ]);
    expect(s.deck).toEqual(['9C']);
    expect(s.floor).toEqual(['QS', '8C', 'KD']);
    expect(s.last?.dealt).toBe(true);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe('play');
  });

  it('ends the round: the floor goes to the last taker, then scores', () => {
    // player 0 takes the 5 with a 5; player 1 drops a 9 that nobody takes
    let s = at([['5C'], ['9D']], ['5H', 'AS']);
    s = apply(s, { type: 'play', card: '5C' }, 0);
    s = apply(s, { type: 'play', card: '9D' }, 1);
    expect(s.floor).toEqual([]);
    expect(sorted(s.taken[0])).toEqual(sorted(['5H', '5C', 'AS', '9D']));
    expect(s.result).toMatchObject({ round: 1, leftover: 2, leftoverTo: 0, carried: 0 });
    // 4 cards vs 0: 30 for most cards, plus the ace
    expect(s.result?.lines[0]).toMatchObject({ cards: 4, most: 30, aces: 1, total: 31 });
    expect(s.scores).toEqual([31, 0]);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
  });

  it('a full game goes on to the next round until someone has 101', () => {
    let s = at([['5C'], ['9D']], ['5H'], { length: 'full', scores: [10, 20] });
    s = apply(s, { type: 'play', card: '5C' }, 0);
    s = apply(s, { type: 'play', card: '9D' }, 1);
    expect(s.phase).toBe('scored');
    expect(s.scores).toEqual([10 + 30 + 10, 20]); // most cards + a basra
    expect(() => apply(s, { type: 'play', card: '5C' }, 0)).toThrow('basra.err.roundOver');

    const dealer = s.dealer;
    const n = apply(s, { type: 'next' }, 1, seeded(7));
    expect(n.round).toBe(2);
    expect(n.phase).toBe('play');
    expect(n.dealer).toBe((dealer + 1) % 2);
    expect(n.scores).toEqual(s.scores);
    expect(n.taken).toEqual([[], []]);
    expect(n.basras).toEqual([0, 0]);
    expect(n.last).toBeNull();
    expect(n.hands.flat()).toHaveLength(8);
  });

  it('a tie at the top past 101 plays another round', () => {
    // 2 cards each (no 30); the jack's point brings both to 105
    let s = at([['KC'], ['JD']], ['KH', '5S'], { length: 'full', scores: [105, 104] });
    s = apply(s, { type: 'play', card: 'KC' }, 0);
    s = apply(s, { type: 'play', card: 'JD' }, 1);
    expect(s.basras).toEqual([0, 0]);
    expect(s.scores).toEqual([105, 105]);
    expect(s.phase).toBe('scored');
    expect(s.carry).toBe(30);
  });

  it('one round ending level is a draw', () => {
    let s = at([['KC'], ['JD']], ['KH', '5S'], { scores: [1, 0] });
    s = apply(s, { type: 'play', card: 'KC' }, 0);
    s = apply(s, { type: 'play', card: 'JD' }, 1);
    expect(s.scores).toEqual([1, 1]);
    expect(s.phase).toBe('over');
    expect(s.winner).toBeNull();
  });

  it('works for three players', () => {
    let s = at([['5C'], ['9D'], ['KS']], ['5H']);
    s = apply(s, { type: 'play', card: '5C' }, 0);
    expect(s.turn).toBe(1);
    s = apply(s, { type: 'play', card: '9D' }, 1);
    expect(s.turn).toBe(2);
    s = apply(s, { type: 'play', card: 'KS' }, 2);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
  });

  it('does not mutate the previous state', () => {
    const s = init({ length: 'one' }, 2, seeded(3));
    const before = JSON.stringify(s);
    apply(s, { type: 'play', card: s.hands[s.turn][0] }, s.turn);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('plays whole random games to the end with all 52 cards accounted for', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seeded(seed);
      const players = seed % 2 ? 2 : 3;
      let s = init({ length: 'full' }, players, rng);
      let guard = 0;
      while (s.phase !== 'over' && guard++ < 2000) {
        if (s.phase === 'scored') {
          s = apply(s, { type: 'next' }, 0, rng);
          continue;
        }
        const hand = s.hands[s.turn];
        s = apply(s, { type: 'play', card: hand[Math.floor(rng() * hand.length)] }, s.turn, rng);
        if (s.phase === 'play') {
          const all = [...s.deck, ...s.floor, ...s.hands.flat(), ...s.taken.flat()];
          expect(sorted(all)).toEqual(sorted(fullDeck()));
        }
      }
      expect(s.phase).toBe('over');
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(101);
      expect(s.winner).not.toBeNull();
    }
  });
});

describe('basra: scoring and views', () => {
  it('scores most cards, aces, jacks, 2♣, 10♦ and basras', () => {
    const { lines, carried } = scoreRound(
      [
        ['AS', 'AH', 'JD', '2C', '10D', '5S', '6S'],
        ['AC', 'JS', '9H'],
      ],
      [2, 0],
      0,
    );
    expect(lines[0]).toEqual({ cards: 7, most: 30, aces: 2, jacks: 1, twoClubs: 2, tenDiamonds: 3, basras: 2, total: 58 });
    expect(lines[1]).toEqual({ cards: 3, most: 0, aces: 1, jacks: 1, twoClubs: 0, tenDiamonds: 0, basras: 0, total: 2 });
    expect(carried).toBe(0);
  });

  it('a tie for most cards carries the 30 to the next round', () => {
    const tie = scoreRound([['5S'], ['6S'], []], [0, 0, 0], 0);
    expect(tie.lines.map((l) => l.most)).toEqual([0, 0, 0]);
    expect(tie.carried).toBe(30);
    const after = scoreRound([['5S', '6S'], ['7S']], [0, 0], 30);
    expect(after.lines[0].most).toBe(60);
    expect(after.carried).toBe(0);
  });

  it('a view shows my hand and only counts for the others', () => {
    const s = init({ length: 'one' }, 3, seeded(11));
    const v = view(s, 1);
    expect(v.hand).toEqual(s.hands[1]);
    expect(v.handCounts).toEqual([4, 4, 4]);
    expect(v.deckCount).toBe(52 - 16);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(s.hands[0]));
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(s.deck.slice(0, 4)).slice(1, -1));
    expect(Object.values(v).every((x) => x !== undefined)).toBe(true);
  });
});
