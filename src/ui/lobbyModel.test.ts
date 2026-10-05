import { describe, expect, it } from 'vitest';
import { byTag, known, pickRandom, pushRecent, toggleFavorite } from './lobbyModel';

const games = [
  { id: 'a', tags: ['us' as const] },
  { id: 'b', tags: ['board' as const, 'quick' as const] },
  { id: 'c', tags: ['words' as const, 'quick' as const] },
];

describe('lobby model', () => {
  it('keeps the recently played list short, newest first, without duplicates', () => {
    expect(pushRecent([], 'a')).toEqual(['a']);
    expect(pushRecent(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b', 'c'], 'd')).toEqual(['d', 'a', 'b']);
  });

  it('toggles favourites', () => {
    expect(toggleFavorite([], 'a')).toEqual(['a']);
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('filters by category', () => {
    expect(byTag(games, 'all').map((g) => g.id)).toEqual(['a', 'b', 'c']);
    expect(byTag(games, 'quick').map((g) => g.id)).toEqual(['b', 'c']);
    expect(byTag(games, 'us').map((g) => g.id)).toEqual(['a']);
  });

  it('surprise picks a game, avoiding the last one played when it can', () => {
    for (let i = 0; i < 100; i++) expect(pickRandom(games, 'a')?.id).not.toBe('a');
    expect(pickRandom([games[0]], 'a')?.id).toBe('a'); // the only choice
    expect(pickRandom([], null)).toBeNull();
    expect(pickRandom(games, null, () => 0.999)?.id).toBe('c');
    expect(pickRandom(games, null, () => 0)?.id).toBe('a');
  });

  it('ignores stored ids of games that no longer exist, and junk', () => {
    const valid = new Set(['a', 'b']);
    expect(known(['a', 'zzz', 2, null, 'b'], valid)).toEqual(['a', 'b']);
    expect(known('nope', valid)).toEqual([]);
    expect(known(null, valid)).toEqual([]);
  });
});
