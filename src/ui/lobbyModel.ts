import type { GameTag } from '../core/types';

/** The category chips in the lobby: everything, or one GameTag. */
export type LobbyTag = 'all' | GameTag;
export const LOBBY_TAGS: LobbyTag[] = ['all', 'us', 'words', 'board', 'quick'];

export const MAX_RECENT = 3;

/** Move `id` to the front of the recently-played list (no duplicates, at most `max`). */
export function pushRecent(list: string[], id: string, max = MAX_RECENT): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

export function toggleFavorite(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function byTag<G extends { tags: GameTag[] }>(games: G[], tag: LobbyTag): G[] {
  return tag === 'all' ? games : games.filter((g) => g.tags.includes(tag));
}

/**
 * A random game for "Surprise me". Avoids `avoid` (the game played last) when there is
 * another choice, so the surprise is actually a change.
 */
export function pickRandom<G extends { id: string }>(games: G[], avoid: string | null, rng: () => number = Math.random): G | null {
  const pool = avoid && games.length > 1 ? games.filter((g) => g.id !== avoid) : games;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** Ids from storage, keeping only games that still exist (a removed game must not break the lists). */
export function known(ids: unknown, valid: Set<string>): string[] {
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && valid.has(x)) : [];
}
