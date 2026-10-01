import { useEffect, useState } from 'preact/hooks';
import { isValidCode, normalizeCode } from './core/ids';
import { KEYS, load } from './core/storage';
import { GuestSession, HostSession, type Session } from './net/session';
import { Home } from './ui/Home';
import { Room } from './ui/Room';

/**
 * Routes live in the hash so the app works on any static host:
 *   #/join/CODE  invite link (guest)
 *   #/host/CODE  the host's own tab, so a refresh reopens the room
 */
function parseHash(): { kind: 'join' | 'host'; code: string } | null {
  const m = location.hash.match(/^#\/(join|host)\/([A-Za-z0-9-]+)/);
  if (!m) return null;
  const code = normalizeCode(m[2]);
  return isValidCode(code) ? { kind: m[1] as 'join' | 'host', code } : null;
}

function setHash(hash: string) {
  history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
}

/** Resume straight into the room after a refresh, or join directly from an invite if we know the name. */
function autoSession(): Session | null {
  const route = parseHash();
  if (!route) return null;
  if (route.kind === 'host') {
    const saved = HostSession.saved();
    return saved?.code === route.code ? HostSession.restore(saved) : null;
  }
  const name = load<string>(KEYS.name);
  return name ? new GuestSession(route.code, name) : null;
}

export function App() {
  const [session, setSession] = useState<Session | null>(autoSession);
  const [inviteCode, setInviteCode] = useState(() => {
    const r = parseHash();
    return r?.kind === 'join' ? r.code : null;
  });

  useEffect(() => {
    if (session) setHash(`/${session.role === 'host' ? 'host' : 'join'}/${session.code}`);
  }, [session]);

  useEffect(() => () => session?.close(), [session]);

  // An invite link opened in a tab that already shows the app only changes the hash (no reload).
  useEffect(() => {
    if (session) return;
    const onHash = () => {
      const r = parseHash();
      if (r?.kind === 'join') setInviteCode(r.code);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [session]);

  if (session) {
    return (
      <Room
        session={session}
        onLeave={() => {
          session.leave();
          setHash('');
          setInviteCode(null);
          setSession(null);
        }}
      />
    );
  }
  // key: a new invite code remounts Home so its form state starts from that code
  return <Home key={inviteCode ?? ''} onSession={setSession} inviteCode={inviteCode} />;
}
