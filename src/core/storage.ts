import { randomId } from './ids';

// localStorage can throw (private mode, quota). Everything here degrades to "not saved".

export function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Stable per-browser identity. The host uses it to recognise "the same guest, reconnecting". */
export function getClientId(): string {
  const key = 'ourtable.clientId';
  let id = load<string>(key);
  if (!id) {
    id = randomId();
    save(key, id);
  }
  return id;
}

export const KEYS = {
  name: 'ourtable.name',
  lang: 'ourtable.lang',
  host: 'ourtable.host.v1',
  guest: 'ourtable.guest.v1',
  lastDeck: 'ourtable.guesswho.lastDeck.v1',
  favorites: 'ourtable.favorites',
  recent: 'ourtable.recent',
  lobbyTag: 'ourtable.lobbyTag',
} as const;
