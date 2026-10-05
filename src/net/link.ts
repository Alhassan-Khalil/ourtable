import { Peer, type DataConnection } from 'peerjs';
import { peerIdFor } from '../core/ids';
import type { ToGuest, ToHost, Wire } from '../core/protocol';

/**
 * The "phone lines" between the browsers.
 *
 * PeerJS's free public server only introduces the browsers (signalling). After that, all
 * messages go directly browser-to-browser over encrypted WebRTC data channels.
 *
 * The host registers the peer id `ourtable-<CODE>` and waits; each guest dials that id. The host
 * keeps one line per guest seat (a star: guests never talk to each other). Which seat a guest
 * gets is decided by the session (same device → same seat; the room has at most MAX_SEATS).
 */

export type LinkStatus =
  | 'starting' // registering with the introduction server
  | 'waiting' // host: room is open, no partner connected
  | 'connecting' // guest: trying to reach the host
  | 'connected' // host: at least one partner connected; guest: connected to the host
  | 'failed'; // gave up for good (room full, browser unsupported)

/** `detail` is always an i18n key ('link.*'), empty when there is nothing to explain. */
type StatusFn = (status: LinkStatus, detail: string) => void;

export interface HostHandlers {
  onStatus: StatusFn;
  /** A guest finished the handshake on `seat` (first time or reconnecting). */
  onJoin(seat: number): void;
  /** The guest on `seat` went away (closed, or silent too long). */
  onLeave(seat: number): void;
  onMessage(seat: number, msg: ToHost): void;
}

export interface GuestHandlers {
  onStatus: StatusFn;
  /** Handshake done; `seat` is my seat in the room (older hosts don't say: then it's 1). */
  onConnected(seat: number): void;
  onMessage(msg: ToGuest): void;
}

const HEARTBEAT_MS = 4_000;
const DEAD_AFTER_MS = 13_000;
const RETRY_MS = 3_000;
const DIAL_TIMEOUT_MS = 15_000;

function peerOptions() {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  const turn = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turn) {
    iceServers.push({
      urls: turn.split(',').map((s) => s.trim()),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  return { config: { iceServers }, debug: 1 as const };
}

/** One data channel and when we last heard from the other side. */
interface Line {
  c: DataConnection;
  lastSeen: number;
}

abstract class BaseLink {
  protected peer: Peer | null = null;
  protected closed = false;
  protected retryTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly code: string,
    private readonly status: StatusFn,
  ) {
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible' && !this.closed) this.onVisible();
  };

  /**
   * Phone unlocked / tab back in front. Timers were frozen while hidden, so check the lines now
   * instead of waiting up to DEAD_AFTER_MS for the heartbeat to notice.
   */
  protected onVisible() {
    const peer = this.peer;
    if (peer && peer.disconnected && !peer.destroyed) peer.reconnect();
    this.checkLines();
  }

  abstract start(): void;
  /** Ping every line; drop the ones that went silent. */
  protected abstract checkLines(ping?: boolean): void;

  close() {
    this.closed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    clearInterval(this.heartbeat);
    clearTimeout(this.retryTimer);
    this.peer?.destroy();
    this.peer = null;
  }

  protected setStatus(status: LinkStatus, detail = '') {
    if (!this.closed) this.status(status, detail);
  }

  protected startHeartbeat() {
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => this.checkLines(true), HEARTBEAT_MS);
  }

  protected static silent(line: Line) {
    return Date.now() - line.lastSeen > DEAD_AFTER_MS;
  }

  /** Shared recovery rule: PeerJS destroys the peer on fatal errors, merely disconnects on signalling loss. */
  protected recoverPeer(peer: Peer, restart: () => void) {
    if (this.closed || peer !== this.peer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      if (this.closed || peer !== this.peer) return;
      if (peer.destroyed) restart();
      else if (peer.disconnected) peer.reconnect();
    }, RETRY_MS);
  }
}

export class HostLink extends BaseLink {
  /** seat → line */
  private readonly lines = new Map<number, Line>();

  constructor(
    code: string,
    private readonly h: HostHandlers,
    /** Which seat this guest may take, or null if the room is full. */
    private readonly accept: (hello: Extract<ToHost, { t: 'hello' }>) => number | null,
  ) {
    super(code, h.onStatus);
  }

  /** Seats with an open line right now. */
  get connectedSeats(): number[] {
    return [...this.lines.entries()].filter(([, l]) => l.c.open).map(([seat]) => seat);
  }

  isConnected(seat: number) {
    return !!this.lines.get(seat)?.c.open;
  }

  send(seat: number, msg: Wire): boolean {
    const line = this.lines.get(seat);
    if (!line?.c.open) return false;
    line.c.send(msg);
    return true;
  }

  override close() {
    for (const { c } of this.lines.values()) c.close();
    this.lines.clear();
    super.close();
  }

  start() {
    this.setStatus('starting', 'link.opening');
    const peer = new Peer(peerIdFor(this.code), peerOptions());
    this.peer = peer;
    this.startHeartbeat();

    peer.on('open', () => this.report());
    peer.on('connection', (c) => this.incoming(c));
    peer.on('disconnected', () => this.recoverPeer(peer, () => this.start()));
    peer.on('error', (e) => {
      if (this.closed) return;
      console.warn('[host] peer error', e.type, e.message);
      if (e.type === 'browser-incompatible') {
        this.setStatus('failed', 'link.noWebrtc');
        return;
      }
      if (e.type === 'unavailable-id') {
        // Usually our own previous tab: the server frees the id a few seconds after it closes.
        this.setStatus('starting', 'link.idTaken');
      } else if (peer.destroyed || peer.disconnected) {
        this.setStatus('starting', 'link.retrying');
      }
      this.recoverPeer(peer, () => this.start());
    });
  }

  /** Status from the number of partners on the line. */
  private report(detail = 'link.roomOpen') {
    if (this.connectedSeats.length > 0) this.setStatus('connected');
    else this.setStatus('waiting', detail);
  }

  private incoming(c: DataConnection) {
    let seat: number | null = null;
    c.on('data', (raw) => {
      const msg = raw as ToHost;
      if (seat === null) {
        if (msg?.t !== 'hello') return;
        seat = this.accept(msg);
        if (seat === null) {
          c.send({ t: 'full' } satisfies ToGuest);
          setTimeout(() => c.close(), 500);
          return;
        }
        const old = this.lines.get(seat);
        this.lines.set(seat, { c, lastSeen: Date.now() });
        if (old && old.c !== c) old.c.close(); // the same device reconnected
        c.send({ t: 'welcome', seat } satisfies ToGuest);
        this.report();
        this.h.onJoin(seat);
        return;
      }
      const line = this.lines.get(seat);
      if (line?.c !== c) return;
      line.lastSeen = Date.now();
      if (msg.t !== 'ping') this.h.onMessage(seat, msg);
    });
    c.on('close', () => {
      if (seat !== null && this.lines.get(seat)?.c === c) this.drop(seat, 'link.partnerLeft');
    });
    c.on('error', (e) => console.warn('[host] connection error', e));
  }

  private drop(seat: number, detail: string) {
    const line = this.lines.get(seat);
    this.lines.delete(seat);
    line?.c.close();
    this.report(detail);
    this.h.onLeave(seat);
  }

  protected checkLines(ping = false) {
    for (const [seat, line] of [...this.lines]) {
      if (BaseLink.silent(line)) this.drop(seat, 'link.partnerLost');
      else if (ping && line.c.open) line.c.send({ t: 'ping' } satisfies ToGuest);
    }
  }
}

export class GuestLink extends BaseLink {
  private line: Line | null = null;
  private pending: DataConnection | null = null;
  private dialTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    code: string,
    private readonly h: GuestHandlers,
    private readonly clientId: string,
    private readonly name: string,
  ) {
    super(code, h.onStatus);
  }

  get connected() {
    return !!this.line?.c.open;
  }

  send(msg: ToHost): boolean {
    if (!this.line?.c.open) return false;
    this.line.c.send(msg);
    return true;
  }

  override close() {
    // closed=true FIRST: closing `pending` fires its 'close' handler synchronously, which would
    // otherwise report "connection lost" over a final status like "room is full".
    this.closed = true;
    clearTimeout(this.dialTimer);
    const p = this.pending;
    this.pending = null;
    p?.close();
    this.line?.c.close();
    this.line = null;
    super.close();
  }

  start() {
    this.setStatus('connecting', 'link.reaching');
    const peer = new Peer(peerOptions());
    this.peer = peer;
    this.startHeartbeat();

    peer.on('open', () => this.dial());
    peer.on('disconnected', () => this.recoverPeer(peer, () => this.start()));
    peer.on('error', (e) => {
      if (this.closed) return;
      if (e.type === 'peer-unavailable') {
        this.setStatus('connecting', 'link.hostOffline');
        this.redial();
        return;
      }
      console.warn('[guest] peer error', e.type, e.message);
      if (e.type === 'browser-incompatible') {
        this.setStatus('failed', 'link.noWebrtc');
        return;
      }
      if (peer.destroyed || peer.disconnected) this.setStatus('connecting', 'link.retrying');
      this.recoverPeer(peer, () => this.start());
    });
  }

  private redial() {
    if (this.closed) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.dial(), RETRY_MS);
  }

  protected override onVisible() {
    super.onVisible();
    if (!this.line) {
      clearTimeout(this.retryTimer);
      this.dial(); // back on screen: try right away
    }
  }

  protected checkLines(ping = false) {
    const line = this.line;
    if (!line) return;
    if (BaseLink.silent(line)) {
      this.line = null;
      line.c.close();
      this.setStatus('connecting', 'link.connLost');
      this.redial();
    } else if (ping && line.c.open) {
      line.c.send({ t: 'ping' } satisfies ToHost);
    }
  }

  private dial() {
    const peer = this.peer;
    if (this.closed || !peer || peer.destroyed) return;
    if (peer.disconnected) {
      peer.reconnect(); // 'open' fires again and calls dial()
      return;
    }
    const stale = this.pending;
    this.pending = null; // null first so its close handler doesn't trigger another redial
    stale?.close();
    const c = peer.connect(peerIdFor(this.code), { reliable: true });
    this.pending = c;

    clearTimeout(this.dialTimer);
    this.dialTimer = setTimeout(() => {
      // ICE sometimes fails silently; don't wait forever.
      if (this.pending !== c) return;
      this.pending = null;
      c.close();
      this.setStatus('connecting', 'link.cantReach');
      this.redial();
    }, DIAL_TIMEOUT_MS);

    c.on('open', () => {
      if (this.pending === c) c.send({ t: 'hello', clientId: this.clientId, name: this.name } satisfies ToHost);
    });
    c.on('data', (raw) => {
      const msg = raw as ToGuest;
      if (this.line?.c === c) this.line.lastSeen = Date.now();
      if (msg.t === 'full') {
        this.setStatus('failed', 'link.roomFull');
        this.close();
        return;
      }
      if (msg.t === 'welcome' && this.pending === c) {
        clearTimeout(this.dialTimer);
        this.pending = null;
        this.line = { c, lastSeen: Date.now() };
        this.setStatus('connected');
        this.h.onConnected(typeof msg.seat === 'number' ? msg.seat : 1);
        return;
      }
      if (this.line?.c === c && msg.t !== 'ping') this.h.onMessage(msg);
    });
    c.on('close', () => {
      if (this.line?.c !== c && this.pending !== c) return;
      if (this.line?.c === c) this.line = null;
      if (this.pending === c) this.pending = null;
      this.setStatus('connecting', 'link.connLost');
      this.redial();
    });
    c.on('error', (e) => console.warn('[guest] connection error', e));
  }
}
