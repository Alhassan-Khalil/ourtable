import { batch, signal } from '@preact/signals';
import { newRoomCode } from '../core/ids';
import type { RoomMeta, ToGuest, ToHost } from '../core/protocol';
import { getClientId, KEYS, load, remove, save } from '../core/storage';
import { GameError, type Player } from '../core/types';
import { GAMES } from '../games';
import { GuestLink, HostLink, type LinkStatus } from './link';

/**
 * A session is "me in a room". The UI only talks to this interface, never to the link.
 *
 * Host (player 0) owns the game state, applies both players' moves, saves to localStorage,
 * and pushes the guest their view. Guest (player 1) just sends moves and renders what it gets.
 */
abstract class BaseSession {
  abstract readonly role: 'host' | 'guest';
  abstract readonly me: Player;
  readonly status = signal<LinkStatus>('starting');
  readonly detail = signal('');
  readonly room = signal<RoomMeta>({ screen: 'lobby', gameId: null, gameKey: 0, names: ['', ''] });
  readonly view = signal<any>(null);
  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

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

interface HostSave {
  code: string;
  hostName: string;
  guestClientId: string | null;
  guestName: string | null;
  screen: RoomMeta['screen'];
  gameId: string | null;
  gameKey: number;
  state: unknown;
  opts: unknown;
}

const cleanName = (name: string) => name.trim().slice(0, 24);

export class HostSession extends BaseSession {
  readonly role = 'host';
  readonly me = 0;
  private readonly s: HostSave;
  private readonly link: HostLink;
  private lastSent: { gameKey: number; view: Record<string, unknown> } | null = null;
  private warnedSave = false;

  static create(name: string) {
    return new HostSession({
      code: newRoomCode(),
      hostName: cleanName(name) || 'Host',
      guestClientId: null,
      guestName: null,
      screen: 'lobby',
      gameId: null,
      gameKey: 0,
      state: null,
      opts: null,
    });
  }

  static saved(): HostSave | null {
    return load<HostSave>(KEYS.host);
  }

  static restore(save: HostSave) {
    return new HostSession(save);
  }

  private constructor(save: HostSave) {
    super(save.code);
    this.s = save;
    this.link = new HostLink(
      save.code,
      {
        onStatus: (st, d) => this.setLink(st, d),
        onConnected: () => {
          this.lastSent = null; // (re)connected guest gets everything
          this.publish();
        },
        onMessage: (m) => this.fromGuest(m as ToHost),
      },
      (hello) => {
        if (this.s.guestClientId && this.s.guestClientId !== hello.clientId) return false;
        this.s.guestClientId = hello.clientId;
        this.s.guestName = cleanName(hello.name) || 'Partner';
        return true;
      },
    );
    this.publish();
    this.link.start();
  }

  get guestName() {
    return this.s.guestName;
  }

  private def() {
    return this.s.gameId ? GAMES[this.s.gameId] : undefined;
  }

  /** Recompute my view, persist, and push the guest their view (only changed top-level keys). */
  private publish() {
    const def = this.def();
    const room: RoomMeta = {
      screen: this.s.screen,
      gameId: this.s.gameId,
      gameKey: this.s.gameKey,
      names: [this.s.hostName, this.s.guestName ?? '…'],
    };
    const inGame = this.s.screen === 'game' && def && this.s.state != null;
    batch(() => {
      this.room.value = room;
      this.view.value = inGame ? def.view(this.s.state, 0) : null;
    });

    if (!save(KEYS.host, this.s) && !this.warnedSave) {
      this.warnedSave = true;
      this.showToast('toast.saveFailed');
    }

    if (!this.link.connected) return;
    const view: Record<string, unknown> | null = inGame ? def.view(this.s.state, 1) : null;
    const full = !view || !this.lastSent || this.lastSent.gameKey !== this.s.gameKey;
    let payload = view;
    if (view && !full) {
      payload = {};
      const prev = this.lastSent!.view;
      for (const k of Object.keys(view)) if (prev[k] !== view[k]) payload[k] = view[k];
    }
    this.link.send({ t: 'sync', room, view: payload, full } satisfies ToGuest);
    this.lastSent = view ? { gameKey: this.s.gameKey, view } : null;
  }

  private fromGuest(m: ToHost) {
    if (m.t === 'move') this.apply(m.move, 1);
    else if (m.t === 'rematch') this.rematch();
    else if (m.t === 'lobby') this.toLobby();
  }

  private apply(move: unknown, by: Player) {
    const def = this.def();
    if (this.s.screen !== 'game' || !def) return;
    try {
      this.s.state = def.apply(this.s.state, move, by);
      this.publish();
    } catch (e) {
      const message = e instanceof GameError ? e.message : 'err.generic';
      if (!(e instanceof GameError)) console.error(e);
      if (by === 0) this.showToast(message);
      else this.link.send({ t: 'error', message });
    }
  }

  move(move: unknown) {
    this.apply(move, 0);
  }

  openGame(gameId: string) {
    const def = GAMES[gameId];
    if (!def) return;
    if (def.Setup) {
      this.s.screen = 'setup';
      this.s.gameId = gameId;
      this.s.state = null;
      this.publish();
    } else {
      this.startGame(gameId, null);
    }
  }

  startGame(gameId: string, opts: unknown) {
    const def = GAMES[gameId];
    if (!def) return;
    this.s.gameId = gameId;
    this.s.opts = def.rematchOpts ? null : opts; // don't persist a photo deck twice
    this.s.state = def.init(opts);
    this.s.gameKey += 1;
    this.s.screen = 'game';
    this.publish();
  }

  rematch() {
    const def = this.def();
    if (!def || this.s.screen !== 'game' || this.s.state == null) return;
    this.startGame(def.id, def.rematchOpts ? def.rematchOpts(this.s.state) : this.s.opts);
  }

  /**
   * The seat is locked to the first device that joined. If the partner switches phone/browser,
   * the host frees the seat so the new device can take it (still only one guest at a time).
   */
  resetSeat() {
    if (this.link.connected) return;
    this.s.guestClientId = null;
    this.publish();
  }

  toLobby() {
    this.s.screen = 'lobby';
    this.s.state = null;
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
  readonly me = 1;
  private readonly link: GuestLink;

  static saved(): GuestSave | null {
    return load<GuestSave>(KEYS.guest);
  }

  constructor(code: string, name: string) {
    super(code);
    const clean = cleanName(name) || 'Partner';
    save(KEYS.guest, { code, name: clean } satisfies GuestSave);
    this.room.value = { screen: 'lobby', gameId: null, gameKey: 0, names: ['…', clean] };
    this.link = new GuestLink(
      code,
      {
        onStatus: (st, d) => this.setLink(st, d),
        onConnected: () => {},
        onMessage: (m) => this.fromHost(m as ToGuest),
      },
      getClientId(),
      clean,
    );
    this.link.start();
  }

  private fromHost(m: ToGuest) {
    if (m.t === 'sync') {
      batch(() => {
        this.room.value = m.room;
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
