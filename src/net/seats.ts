import type { RoomMeta } from '../core/protocol';
import { MAX_SEATS } from '../core/types';

/** A guest who has a seat in this room (seat = index in HostSave.guests + 1). */
export interface Guest {
  clientId: string;
  name: string;
}

export interface HostSave {
  code: string;
  hostName: string;
  /** Seats 1..MAX_SEATS-1. A seat stays taken while its player is offline, so they can come back. */
  guests: (Guest | null)[];
  screen: RoomMeta['screen'];
  gameId: string | null;
  gameKey: number;
  state: unknown;
  opts: unknown;
  /** The seats playing the current game, in game-player order. */
  players: number[] | null;
}

const emptyGuests = (): (Guest | null)[] => Array.from({ length: MAX_SEATS - 1 }, () => null);

/**
 * Bring a saved room up to date. Rooms saved before rooms of three had one `guestClientId` /
 * `guestName` and an implicit 2-player game ([0, 1]); this keeps those rooms (and their game) working.
 */
export function migrateSave(raw: unknown): HostSave | null {
  if (typeof raw !== 'object' || raw === null || typeof (raw as HostSave).code !== 'string') return null;
  const old = raw as HostSave & { guestClientId?: string | null; guestName?: string | null };
  const guests = Array.isArray(old.guests) ? old.guests.slice(0, MAX_SEATS - 1) : emptyGuests();
  while (guests.length < MAX_SEATS - 1) guests.push(null);
  if (!Array.isArray(old.guests) && old.guestClientId) guests[0] = { clientId: old.guestClientId, name: old.guestName || 'Partner' };
  const inGame = old.screen === 'game' && old.gameId !== null && old.state != null;
  const players = Array.isArray(old.players) ? old.players : inGame ? [0, 1] : null;
  return {
    code: old.code,
    hostName: old.hostName,
    guests,
    screen: old.screen ?? 'lobby',
    gameId: old.gameId ?? null,
    gameKey: old.gameKey ?? 0,
    state: old.state ?? null,
    opts: old.opts ?? null,
    players,
  };
}

/**
 * Who sits where when a device says hello: the same device gets its old seat back; a new device
 * gets the first free seat; null when the room is full.
 */
export function assignSeat(guests: (Guest | null)[], clientId: string, name: string): { guests: (Guest | null)[]; seat: number } | null {
  let i = guests.findIndex((g) => g?.clientId === clientId);
  if (i < 0) i = guests.findIndex((g) => g === null);
  if (i < 0) return null;
  const next = guests.slice();
  next[i] = { clientId, name };
  return { guests: next, seat: i + 1 };
}

/** Make a RoomMeta from an older host (no seats / players) usable. */
export function normalizeRoom(r: RoomMeta): RoomMeta {
  const seats = Array.isArray(r.seats) ? r.seats : r.names.map((name) => (name ? { name, online: true } : null));
  const players = r.players !== undefined ? r.players : r.screen === 'game' ? [0, 1] : null;
  return { ...r, seats, players };
}

/** Is a game with this [min, max] playable by `count` people? */
export const fitsPlayers = (range: [number, number], count: number) => count >= range[0] && count <= range[1];
