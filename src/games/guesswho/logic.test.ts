import { describe, expect, it } from 'vitest';
import { GameError } from '../../core/types';
import { classicDeck } from './faces';
import { apply, init, view, type GWState } from './logic';

const deck = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `P${i}`, img: '' }));

/** Both players picked, player 0 to ask. P0 has c1, P1 has c2. */
function started(): GWState {
  let s = init({ deck, deckName: 'test' }, 0);
  s = apply(s, { type: 'pick', cardId: 'c1' }, 0);
  s = apply(s, { type: 'pick', cardId: 'c2' }, 1);
  return s;
}

describe('guess who', () => {
  it('needs a big enough deck', () => {
    expect(() => init({ deck: deck.slice(0, 3), deckName: 'x' })).toThrow(GameError);
  });

  it('starts play only after both players picked, and allows changing your pick until then', () => {
    let s = init({ deck, deckName: 'test' }, 0);
    s = apply(s, { type: 'pick', cardId: 'c1' }, 0);
    expect(s.phase).toBe('pick');
    s = apply(s, { type: 'pick', cardId: 'c3' }, 0);
    expect(s.secrets[0]).toBe('c3');
    s = apply(s, { type: 'pick', cardId: 'c2' }, 1);
    expect(s.phase).toBe('play');
    expect(() => apply(s, { type: 'pick', cardId: 'c4' }, 0)).toThrow(GameError);
    expect(() => apply(init({ deck, deckName: 't' }), { type: 'pick', cardId: 'nope' }, 0)).toThrow('err.unknownCard');
  });

  it('never shows the opponent secret before the game is over', () => {
    const s = started();
    expect(view(s, 0).mySecret).toBe('c1');
    expect(view(s, 0).oppSecret).toBeNull();
    expect(view(s, 1).mySecret).toBe('c2');
    expect(view(s, 1).oppSecret).toBeNull();
    const { deck: _deck, ...rest } = view(s, 0);
    expect(JSON.stringify(rest)).not.toContain('"c2"'); // the secret id leaks nowhere outside the deck
  });

  it('runs ask → answer → turn passes', () => {
    let s = started();
    expect(() => apply(s, { type: 'ask', text: 'Glasses?' }, 1)).toThrow(GameError); // not P1's turn
    expect(() => apply(s, { type: 'ask', text: '   ' }, 0)).toThrow(GameError);
    s = apply(s, { type: 'ask', text: '  Glasses? ' }, 0);
    expect(s.step).toBe('answer');
    expect(s.log.at(-1)).toEqual({ by: 0, q: 'Glasses?', a: null });
    expect(() => apply(s, { type: 'answer', yes: true }, 0)).toThrow(GameError); // can't answer yourself
    expect(() => apply(s, { type: 'ask', text: 'again' }, 0)).toThrow(GameError);
    s = apply(s, { type: 'answer', yes: false }, 1);
    expect(s.log.at(-1)?.a).toBe(false);
    expect(s.turn).toBe(1);
    expect(s.step).toBe('ask');
  });

  it('keeps flips per player and toggles them', () => {
    let s = started();
    s = apply(s, { type: 'flip', cardId: 'c5' }, 1);
    s = apply(s, { type: 'flip', cardId: 'c6' }, 1);
    expect(view(s, 1).myFlips).toEqual(['c5', 'c6']);
    expect(view(s, 0).myFlips).toEqual([]);
    s = apply(s, { type: 'flip', cardId: 'c5' }, 1);
    expect(view(s, 1).myFlips).toEqual(['c6']);
  });

  it('a correct guess wins, a wrong guess loses, and the secret is revealed', () => {
    const right = apply(started(), { type: 'guess', cardId: 'c2' }, 0);
    expect(right.phase).toBe('over');
    expect(right.winner).toBe(0);
    expect(view(right, 0).oppSecret).toBe('c2');

    const wrong = apply(started(), { type: 'guess', cardId: 'c4' }, 0);
    expect(wrong.winner).toBe(1);
    expect(wrong.guess).toEqual({ by: 0, cardId: 'c4', correct: false });
    expect(() => apply(wrong, { type: 'flip', cardId: 'c1' }, 0)).toThrow('err.over');
  });

  it('only allows guessing on your own turn, instead of asking', () => {
    let s = started();
    expect(() => apply(s, { type: 'guess', cardId: 'c1' }, 1)).toThrow(GameError);
    s = apply(s, { type: 'ask', text: 'q' }, 0);
    expect(() => apply(s, { type: 'guess', cardId: 'c2' }, 0)).toThrow(GameError);
  });

  it('keeps the deck reference stable across moves, so photos are synced only once', () => {
    let s = started();
    const d = view(s, 1).deck;
    const p1Flips = view(s, 1).myFlips;
    s = apply(s, { type: 'ask', text: 'q' }, 0);
    s = apply(s, { type: 'flip', cardId: 'c3' }, 0);
    expect(view(s, 1).deck).toBe(d);
    // player 0 flipping must not re-send player 1's flips either
    expect(view(s, 1).myFlips).toBe(p1Flips);
  });
});

describe('classic deck', () => {
  it('has 24 unique people, and every quick-question tag splits the deck', () => {
    const cards = classicDeck();
    expect(cards).toHaveLength(24);
    expect(new Set(cards.map((c) => c.id)).size).toBe(24);
    expect(new Set(cards.map((c) => c.name)).size).toBe(24);
    const tags = new Set(cards.flatMap((c) => c.tags ?? []));
    for (const tag of tags) {
      const n = cards.filter((c) => c.tags?.includes(tag)).length;
      expect(n, tag).toBeGreaterThan(0);
      expect(n, tag).toBeLessThan(24);
    }
    expect(cards[0].img.startsWith('data:image/svg+xml')).toBe(true);
  });
});
