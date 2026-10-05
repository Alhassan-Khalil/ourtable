import { useEffect } from 'preact/hooks';
import { formatCode } from '../core/ids';
import { GAMES } from '../games';
import { t, tKey } from '../i18n';
import type { Session } from '../net/session';
import { Invite } from './Invite';
import { Lobby, rememberPlayed } from './Lobby';

export function Room({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const room = session.room.value;
  const view = session.view.value;
  const status = session.status.value;
  const detail = session.detail.value;
  const toast = session.toast.value;
  const isHost = session.role === 'host';
  const mySeat = session.seat.value;
  const me = session.me.value;
  const def = room.gameId ? GAMES[room.gameId] : undefined;
  const nameAt = (seat: number) => room.seats[seat]?.name ?? room.names[seat] ?? '…';
  // Everyone else at the table who is online right now (for "With Sami and Rana").
  const others = room.seats.map((x, seat) => (x && seat !== mySeat && x.online ? x.name : null)).filter((x): x is string => !!x);
  const firstGuest = room.seats.slice(1).find(Boolean)?.name ?? room.names[1] ?? '';

  // Every new game (including "Play again") goes to the front of "Played recently" on this phone.
  const playing = room.screen === 'game' ? room.gameId : null;
  useEffect(() => {
    if (playing) rememberPlayed(playing);
  }, [playing, room.gameKey]);

  function leave() {
    if (confirm(isHost ? t('confirmCloseRoom') : t('confirmLeave'))) onLeave();
  }

  let body;
  if (status === 'failed') {
    body = (
      <section class="panel">
        <h2>{t('status.failed')}</h2>
        <p>{tKey(detail)}</p>
        <button class="btn primary" onClick={onLeave}>
          {t('backHome')}
        </button>
      </section>
    );
  } else if (room.screen === 'lobby' || !def) {
    body = <Lobby session={session} />;
  } else if (room.screen === 'setup') {
    body =
      session.role === 'host' && def.Setup ? (
        <def.Setup onStart={(opts) => session.startGame(def.id, opts)} onCancel={() => session.toLobby()} />
      ) : (
        <section class="panel center">
          <p>{t('settingUp', nameAt(0), def.name)}</p>
        </section>
      );
  } else if (room.players && me < 0) {
    // Someone joined while the others play a game they're not in.
    body = (
      <section class="panel center">
        <p>{t('watching', t('listJoin', room.players.map(nameAt)), def.name)}</p>
      </section>
    );
  } else {
    body = view ? (
      <def.Board
        key={room.gameKey}
        view={view}
        me={me}
        names={(room.players ?? [0, 1]).map(nameAt)}
        send={(m: unknown) => session.move(m)}
        rematch={() => session.rematch()}
        toLobby={() => session.toLobby()}
      />
    ) : (
      <section class="panel center muted">{t('loadingGame')}</section>
    );
  }

  return (
    <div class="room">
      <header class="room-head">
        <div class="room-title">
          <img src="./favicon.svg" alt="" width={28} height={28} />
          <span class="mono" dir="ltr">
            {formatCode(session.code)}
          </span>
        </div>
        <div class={`status-pill ${status}`} title={tKey(detail)}>
          <i />
          <span>{status === 'connected' && others.length ? t('withPartner', t('listJoin', others)) : t(`status.${status}` as const)}</span>
        </div>
        <div class="room-buttons">
          {room.screen === 'game' && me >= 0 && (
            <button class="btn ghost small" onClick={() => confirm(t('confirmStopGame')) && session.toLobby()}>
              {t('games')}
            </button>
          )}
          <button class="btn ghost small" onClick={leave}>
            {t('leave')}
          </button>
        </div>
      </header>

      {status !== 'connected' && status !== 'failed' && detail && <p class="status-detail">{tKey(detail)}</p>}
      {session.role === 'host' && status !== 'connected' && status !== 'failed' && (
        <Invite
          code={session.code}
          returning={session.hasGuests}
          partner={firstGuest}
          onNewDevice={() => {
            if (session.role !== 'host') return;
            session.resetSeat();
            session.showToast('seatFreed');
          }}
        />
      )}

      <main class="room-body">{body}</main>

      {toast && (
        <div class="toast" role="alert">
          {tKey(toast)}
        </div>
      )}
    </div>
  );
}
