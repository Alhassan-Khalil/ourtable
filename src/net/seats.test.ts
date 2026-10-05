import { describe, expect, it } from 'vitest';
import type { RoomMeta } from '../core/protocol';
import { assignSeat, fitsPlayers, migrateSave, normalizeRoom } from './seats';

describe('seats', () => {
  it('gives a new device the first free seat and a known device its old seat', () => {
    let guests = [null, null] as ({ clientId: string; name: string } | null)[];
    const a = assignSeat(guests, 'A', 'Sami')!;
    expect(a.seat).toBe(1);
    guests = a.guests;
    const b = assignSeat(guests, 'B', 'Rana')!;
    expect(b.seat).toBe(2);
    guests = b.guests;
    expect(assignSeat(guests, 'A', 'Sami 2')).toEqual({ guests: [{ clientId: 'A', name: 'Sami 2' }, { clientId: 'B', name: 'Rana' }], seat: 1 });
    expect(assignSeat(guests, 'C', 'Third')).toBeNull(); // full
  });

  it('upgrades a room saved before rooms of three, keeping the partner and the game', () => {
    const old = {
      code: 'ABCDEFGHJK',
      hostName: 'Alhassan',
      guestClientId: 'wife-phone',
      guestName: 'Sara',
      screen: 'game',
      gameId: 'connect4',
      gameKey: 4,
      state: { some: 'state' },
      opts: null,
    };
    const s = migrateSave(old)!;
    expect(s.guests).toEqual([{ clientId: 'wife-phone', name: 'Sara' }, null]);
    expect(s.players).toEqual([0, 1]);
    expect(s.gameId).toBe('connect4');
    expect(s.state).toEqual({ some: 'state' });
    expect('guestClientId' in s).toBe(false);
  });

  it('upgrades an old room with no partner yet, in the lobby', () => {
    const s = migrateSave({ code: 'ABCDEFGHJK', hostName: 'A', guestClientId: null, guestName: null, screen: 'lobby', gameId: null, gameKey: 0, state: null, opts: null })!;
    expect(s.guests).toEqual([null, null]);
    expect(s.players).toBeNull();
  });

  it('keeps new saves as they are and rejects junk', () => {
    const fresh = { code: 'X', hostName: 'A', guests: [null, { clientId: 'B', name: 'Rana' }], screen: 'lobby' as const, gameId: null, gameKey: 1, state: null, opts: null, players: null };
    expect(migrateSave(fresh)).toEqual(fresh);
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('x')).toBeNull();
  });

  it('understands rooms sent by an older host', () => {
    const r = normalizeRoom({ screen: 'game', gameId: 'dots', gameKey: 1, names: ['Alhassan', 'Sara'] } as unknown as RoomMeta);
    expect(r.seats).toEqual([
      { name: 'Alhassan', online: true },
      { name: 'Sara', online: true },
    ]);
    expect(r.players).toEqual([0, 1]);
  });

  it('checks the number of players', () => {
    expect(fitsPlayers([2, 2], 2)).toBe(true);
    expect(fitsPlayers([2, 2], 3)).toBe(false);
    expect(fitsPlayers([2, 3], 3)).toBe(true);
    expect(fitsPlayers([2, 3], 1)).toBe(false);
  });
});
