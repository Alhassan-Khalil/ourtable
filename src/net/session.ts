import { batch, computed, signal } from '@preact/signals';
import { newRoomCode } from '../core/ids';
import type { RoomMeta, SeatInfo, ToGuest, ToHost } from '../core/protocol';
import { getClientId, KEYS, load, remove, save } from '../core/storage';
import { GameError, MAX_SEATS } from '../core/types';
import { GAMES } from '../games';
import { GuestLink, HostLink, type LinkStatus } from './link';
import { assignSeat, fitsPlayers, migrateSave, normalizeRoom, type HostSave } from './seats';

/**
 * A session is "me in a room". The UI only talks to this interface, never to the link.
 *
 * The host (seat 0) owns the game state, applies everyone's moves, saves to localStorage, and
 * pushes each guest (seats 1, 2) their own view. A game is played by the seats in `room.players`;
 * inside the game they are players 0..n-1 in that order. Anyone else in the room watches a
 * "game in progress" note until the next game.
 */
abstract class BaseSession {
  abstract readonly role: 'host' | 'guest';
  readonly status = signal<LinkStatus>('starting');
  readonly detail = signal('');
  readonly room = signal<RoomMeta>({ screen: 'lobby', gameId: null, gameKey: 0, names: [], seats: [], players: null });
  /** My seat in the room (null until a guest is welcomed). */
  readonly seat = signal<number | null>(null);
  readonly view = signal<any>(null);
  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** My index among the current game's players, or -1 if I'm not in it. */
  readonly me = computed(() => {
    const players = this.room.value.players;
    const seat = this.seat.value;
    return players && seat !== null ? players.indexOf(seat) : -1;
  });

  constructor(readonly code: string) {}

  /** `message` is an i18n key; the UI translates it at render time. */
  showToast(message: string) {
    this.toast.value = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast.value = null), 4000);
  }

  protected setLink(status: LinkStatus, detail: string) {
    batch(() => {
      this.status.value = status;
      this.detail.value = detail;
    });
  }

  abstract move(move: unknown): void;
  abstract rematch(): void;
  abstract toLobby(): void;
  /** Hang up but keep the saved room (e.g. navigating away). */
  abstract close(): void;
  /** Hang up and forget this room on this device. */
  abstract leave(): void;
}

const cleanName = (name: string) => name.trim().slice(0, 24);

export class HostSession extends BaseSession {
  readonly role = 'host';
  private readonly s: HostSave;
  private readonly link: HostLink;
  /** What each guest seat was last sent, to send only the changed top-level keys. */
  private readonly lastSent = new Map<number, { gameKey: number; view: Record<string, unknown> }>();
  private warnedSave = false;

  static create(name: string) {
    return new HostSession({
      code: newRoomCode(),
      hostName: cleanName(name) || 'Host',
      guests: Array.from({ length: MAX_SEATS - 1 }, () => null),
      screen: 'lobby',
      gameId: null,
      gameKey: 0,
      state: null,
      opts: null,
      players: null,
    });
  }

  /** The saved room on this device, upgraded to the current format. */
  static saved(): HostSave | null {
    return migrateSave(load(KEYS.host));
  }

  static restore(save: HostSave) {
    return new HostSession(migrateSave(save) ?? save);
  }

  private constructor(save: HostSave) {
    super(save.code);
    this.s = save;
    this.seat.value = 0;
    this.link = new HostLink(
      save.code,
      {
        onStatus: (st, d) => this.setLink(st, d),
        onJoin: (seat) => {
          this.lastSent.delete(seat); // a (re)connected guest gets everything
          this.publish();
        },
        onLeave: () => this.publish(),
        onMessage: (seat, m) => this.fromGuest(seat, m),
      },
      (hello) => {
        const r = assignSeat(this.s.guests, hello.clientId, cleanName(hello.name) || 'Partner');
        if (!r) return null;
        this.s.guests = r.guests;
        return r.seat;
      },
    );
    this.publish();
    this.link.start();
  }

  /** Has anyone ever joined (used for "your partner can rejoin with the same link"). */
  get hasGuests() {
    return this.s.guests.some(Boolean);
  }

  /** Seats with a player right now (the host + connected guests). */
  private onlineSeats(): number[] {
    return [0, ...this.link.connectedSeats].sort((a, b) => a - b);
  }

  private def() {
    return this.s.gameId ? GAMES[this.s.gameId] : undefined;
  }

  private roomMeta(): RoomMeta {
    const online = new Set(this.onlineSeats());
    const seats: (SeatInfo | null)[] = [
      { name: this.s.hostName, online: true },
      ...this.s.guests.map((g, i) => (g ? { name: g.name, online: online.has(i + 1) } : null)),
    ];
    return {
      screen: this.s.screen,
      gameId: this.s.gameId,
      gameKey: this.s.gameKey,
      names: seats.map((x) => x?.name ?? ''),
      seats,
      players: this.s.screen === 'game' ? this.s.players : null,
    };
  }

  /** The view for one seat, or null when that seat isn't playing the current game. */
  private viewFor(seat: number): Record<string, unknown> | null {
    const def = this.def();
    const players = this.s.players;
    if (this.s.screen !== 'game' || !def || this.s.state == null || !players) return null;
    const i = players.indexOf(seat);
    return i < 0 ? null : def.view(this.s.state, i);
  }

  /** Recompute my view, persist, and push each guest their view (only changed top-level keys). */
  private publish() {
    const room = this.roomMeta();
    batch(() => {
      this.room.value = room;
      this.view.value = this.viewFor(0);
    });

    if (!save(KEYS.host, this.s) && !this.warnedSave) {
      this.warnedSave = true;
      this.showToast('toast.saveFailed');
    }

    for (const seat of this.link.connectedSeats) {
      const view = this.viewFor(seat);
      const last = this.lastSent.get(seat);
      const full = !view || !last || last.gameKey !== this.s.gameKey;
      let payload = view;
      if (view && !full) {
        payload = {};
        for (const k of Object.keys(view)) if (last!.view[k] !== view[k]) payload[k] = view[k];
      }
      this.link.send(seat, { t: 'sync', room, view: payload, full } satisfies ToGuest);
      if (view) this.lastSent.set(seat, { gameKey: this.s.gameKey, view });
      else this.lastSent.delete(seat);
    }
  }

  private fromGuest(seat: number, m: ToHost) {
    if (m.t === 'move') this.apply(m.move, seat);
    else if (m.t === 'rematch') this.rematch(seat);
    else if (m.t === 'lobby') this.toLobby();
  }

  private tell(seat: number, message: string) {
    if (seat === 0) this.showToast(message);
    else this.link.send(seat, { t: 'error', message });
  }

  private apply(move: unknown, seat: number) {
    const def = this.def();
    if (this.s.screen !== 'game' || !def || !this.s.players) return;
    const by = this.s.players.indexOf(seat);
    if (by < 0) return this.tell(seat, 'err.notInGame');
    try {
      this.s.state = def.apply(this.s.state, move, by);
      this.publish();
    } catch (e) {
      if (!(e instanceof GameError)) console.error(e);
      this.tell(seat, e instanceof GameError ? e.message : 'err.generic');
    }
  }

  move(move: unknown) {
    this.apply(move, 0);
  }

  /** Can this game be started with the people here right now? */
  canPlay(gameId: string) {
    const def = GAMES[gameId];
    return !!def && fitsPlayers(def.players, this.onlineSeats().length);
  }

  openGame(gameId: string) {
    const def = GAMES[gameId];
    if (!def) return;
    if (!this.canPlay(gameId)) return this.showToast('err.playerCount');
    if (def.Setup) {
      this.s.screen = 'setup';
      this.s.gameId = gameId;
      this.s.state = null;
      this.publish();
    } else {
      this.startGame(gameId, null);
    }
  }

  /** Start with everyone who is here now (or, for "Play again", the same players as before). */
  startGame(gameId: string, opts: unknown, players: number[] = this.onlineSeats()) {
    const def = GAMES[gameId];
    if (!def) return;
    if (!fitsPlayers(def.players, players.length)) return this.showToast('err.playerCount');
    this.s.gameId = gameId;
    this.s.opts = def.rematchOpts ? null : opts; // don't persist a photo deck twice
    this.s.players = players;
    this.s.state = def.init(opts, players.length);
    this.s.gameKey += 1;
    this.s.screen = 'game';
    this.publish();
  }

  rematch(seat = 0) {
    const def = this.def();
    const players = this.s.players;
    if (!def || this.s.screen !== 'game' || this.s.state == null || !players) return;
    if (!players.includes(seat)) return this.tell(seat, 'err.notInGame');
    this.startGame(def.id, def.rematchOpts ? def.rematchOpts(this.s.state) : this.s.opts, players);
  }

  /**
   * Free the seats of players who aren't connected right now, so a new device can take them
   * (e.g. the partner switched phone or browser). Connected players keep their seats.
   */
  resetSeat() {
    const online = new Set(this.link.connectedSeats);
    this.s.guests = this.s.guests.map((g, i) => (online.has(i + 1) ? g : null));
    this.publish();
  }

  /** Remove one player who isn't connected (frees their seat). */
  removeSeat(seat: number) {
    if (seat < 1 || this.link.isConnected(seat)) return;
    this.s.guests = this.s.guests.map((g, i) => (i + 1 === seat ? null : g));
    this.publish();
  }

  toLobby() {
    this.s.screen = 'lobby';
    this.s.state = null;
    this.s.players = null;
    this.publish();
  }

  close() {
    this.link.close();
  }

  leave() {
    this.link.close();
    remove(KEYS.host);
  }
}

export interface GuestSave {
  code: string;
  name: string;
}

export class GuestSession extends BaseSession {
  readonly role = 'guest';
  private readonly link: GuestLink;

  static saved(): GuestSave | null {
    return load<GuestSave>(KEYS.guest);
  }

  constructor(code: string, name: string) {
    super(code);
    const clean = cleanName(name) || 'Partner';
    save(KEYS.guest, { code, name: clean } satisfies GuestSave);
    this.room.value = { screen: 'lobby', gameId: null, gameKey: 0, names: ['…', clean], seats: [], players: null };
    this.link = new GuestLink(
      code,
      {
        onStatus: (st, d) => this.setLink(st, d),
        onConnected: (seat) => (this.seat.value = seat),
        onMessage: (m) => this.fromHost(m),
      },
      getClientId(),
      clean,
    );
    this.link.start();
  }

  private fromHost(m: ToGuest) {
    if (m.t === 'sync') {
      batch(() => {
        this.room.value = normalizeRoom(m.room);
        this.view.value = m.full || !this.view.value ? m.view : { ...this.view.value, ...m.view };
      });
    } else if (m.t === 'error') {
      this.showToast(m.message);
    }
  }

  private sendOrWarn(msg: ToHost) {
    if (!this.link.send(msg)) this.showToast('toast.notConnected');
  }

  move(move: unknown) {
    this.sendOrWarn({ t: 'move', move });
  }

  rematch() {
    this.sendOrWarn({ t: 'rematch' });
  }

  toLobby() {
    this.sendOrWarn({ t: 'lobby' });
  }

  close() {
    this.link.close();
  }

  leave() {
    this.link.close();
    remove(KEYS.guest);
  }
}

export type Session = HostSession | GuestSession;
