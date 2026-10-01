import { Peer, type DataConnection } from 'peerjs';
import { peerIdFor } from '../core/ids';
import type { ToGuest, ToHost, Wire } from '../core/protocol';

/**
 * The "phone line" between the two browsers.
 *
 * PeerJS's free public server only introduces the two browsers (signalling). After that, all
 * messages go directly browser-to-browser over an encrypted WebRTC data channel.
 *
 * The host registers the peer id `ourtable-<CODE>` and waits. The guest dials that id.
 * One guest per room: the host remembers the first guest's clientId and rejects anyone else.
 */

export type LinkStatus =
  | 'starting' // registering with the introduction server
  | 'waiting' // host: room is open, partner not connected
  | 'connecting' // guest: trying to reach the host
  | 'connected'
  | 'failed'; // gave up for good (room full, browser unsupported)

export interface LinkHandlers {
  /** `detail` is an i18n key ('link.*'), empty when there is nothing to explain. */
  onStatus(status: LinkStatus, detail: string): void;
  onMessage(msg: Wire): void;
  /** Fired once the handshake is complete (host: guest accepted; guest: host said welcome). */
  onConnected(): void;
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

abstract class BaseLink {
  protected peer: Peer | null = null;
  protected conn: DataConnection | null = null;
  protected closed = false;
  protected retryTimer: ReturnType<typeof setTimeout> | undefined;
  private lastSeen = 0;
  private heartbeat: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly code: string,
    protected readonly h: LinkHandlers,
  ) {
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible' && !this.closed) this.onVisible();
  };

  /**
   * Phone unlocked / tab back in front. Timers were frozen while hidden, so check the line now
   * instead of waiting up to DEAD_AFTER_MS for the heartbeat to notice.
   */
  protected onVisible() {
    const peer = this.peer;
    if (peer && peer.disconnected && !peer.destroyed) peer.reconnect();
    if (this.conn && Date.now() - this.lastSeen > DEAD_AFTER_MS) this.onDead();
  }

  abstract start(): void;
  /** Called by the heartbeat when the partner went silent. */
  protected abstract onDead(): void;

  get connected() {
    return !!this.conn?.open;
  }

  send(msg: Wire): boolean {
    if (!this.conn?.open) return false;
    this.conn.send(msg);
    return true;
  }

  close() {
    this.closed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    clearInterval(this.heartbeat);
    clearTimeout(this.retryTimer);
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
  }

  protected setStatus(status: LinkStatus, detail = '') {
    if (!this.closed) this.h.onStatus(status, detail);
  }

  protected touch() {
    this.lastSeen = Date.now();
  }

  protected startHeartbeat() {
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (!this.conn) return;
      if (Date.now() - this.lastSeen > DEAD_AFTER_MS) {
        this.onDead();
        return;
      }
      this.send({ t: 'ping' });
    }, HEARTBEAT_MS);
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
  constructor(
    code: string,
    h: LinkHandlers,
    /** Decide whether a guest may take the second seat. */
    private readonly accept: (hello: Extract<ToHost, { t: 'hello' }>) => boolean,
  ) {
    super(code, h);
  }

  start() {
    this.setStatus('starting', 'link.opening');
    const peer = new Peer(peerIdFor(this.code), peerOptions());
    this.peer = peer;
    this.startHeartbeat();

    peer.on('open', () => {
      if (this.connected) this.setStatus('connected');
      else this.setStatus('waiting', 'link.roomOpen');
    });
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

  private incoming(c: DataConnection) {
    let accepted = false;
    c.on('data', (raw) => {
      const msg = raw as ToHost;
      if (!accepted) {
        if (msg?.t !== 'hello') return;
        if (!this.accept(msg)) {
          c.send({ t: 'full' } satisfies ToGuest);
          setTimeout(() => c.close(), 500);
          return;
        }
        accepted = true;
        const old = this.conn;
        this.conn = c;
        if (old && old !== c) old.close();
        this.touch();
        this.send({ t: 'welcome' });
        this.setStatus('connected');
        this.h.onConnected();
        return;
      }
      if (c !== this.conn) return;
      this.touch();
      if (msg.t !== 'ping') this.h.onMessage(msg);
    });
    c.on('close', () => {
      if (c !== this.conn) return;
      this.conn = null;
      this.setStatus('waiting', 'link.partnerLeft');
    });
    c.on('error', (e) => console.warn('[host] connection error', e));
  }

  protected onDead() {
    const c = this.conn;
    this.conn = null;
    c?.close();
    this.setStatus('waiting', 'link.partnerLost');
  }
}

export class GuestLink extends BaseLink {
  private pending: DataConnection | null = null;
  private dialTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    code: string,
    h: LinkHandlers,
    private readonly clientId: string,
    private readonly name: string,
  ) {
    super(code, h);
  }

  override close() {
    // closed=true FIRST: closing `pending` fires its 'close' handler synchronously, which would
    // otherwise report "connection lost" over a final status like "room is full".
    this.closed = true;
    clearTimeout(this.dialTimer);
    const p = this.pending;
    this.pending = null;
    p?.close();
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
    if (!this.conn) {
      clearTimeout(this.retryTimer);
      this.dial(); // back on screen: try right away
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
      this.touch();
      if (msg.t === 'full') {
        this.setStatus('failed', 'link.roomFull');
        this.close();
        return;
      }
      if (msg.t === 'welcome' && this.pending === c) {
        clearTimeout(this.dialTimer);
        this.pending = null;
        this.conn = c;
        this.setStatus('connected');
        this.h.onConnected();
        return;
      }
      if (c === this.conn && msg.t !== 'ping') this.h.onMessage(msg);
    });
    c.on('close', () => {
      if (c !== this.conn && c !== this.pending) return;
      if (c === this.conn) this.conn = null;
      if (c === this.pending) this.pending = null;
      this.setStatus('connecting', 'link.connLost');
      this.redial();
    });
    c.on('error', (e) => console.warn('[guest] connection error', e));
  }

  protected onDead() {
    const c = this.conn;
    this.conn = null;
    c?.close();
    this.setStatus('connecting', 'link.connLost');
    this.redial();
  }
}
