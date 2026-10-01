import { useState } from 'preact/hooks';
import { formatCode } from '../core/ids';
import { COMING_SOON, GAME_LIST, GAMES } from '../games';
import { t, tKey } from '../i18n';
import type { Session } from '../net/session';

export const inviteLink = (code: string) => `${location.origin}${location.pathname}#/join/${code}`;

export function Room({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const room = session.room.value;
  const view = session.view.value;
  const status = session.status.value;
  const detail = session.detail.value;
  const toast = session.toast.value;
  const isHost = session.role === 'host';
  const partner = room.names[isHost ? 1 : 0];
  const def = room.gameId ? GAMES[room.gameId] : undefined;

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
    body = (
      <section class="lobby">
        <h2>{t('pickGame')}</h2>
        {!isHost && <p class="muted">{t('hostChooses', room.names[0])}</p>}
        <div class="game-grid">
          {GAME_LIST.map((g) => (
            <button
              key={g.id}
              class="game-card"
              disabled={!isHost}
              onClick={() => session.role === 'host' && session.openGame(g.id)}
            >
              <span class="game-icon">{g.icon}</span>
              <span class="game-text">
                <strong>{g.name}</strong>
                <span class="muted small">{g.blurb}</span>
              </span>
            </button>
          ))}
          {COMING_SOON.map((g) => (
            <div key={g.name} class="game-card soon">
              <span class="game-icon">{g.icon}</span>
              <span class="game-text">
                <strong>{t(g.name)}</strong>
                <span class="muted small">{t('comingSoon')}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  } else if (room.screen === 'setup') {
    body =
      session.role === 'host' && def.Setup ? (
        <def.Setup onStart={(opts) => session.startGame(def.id, opts)} onCancel={() => session.toLobby()} />
      ) : (
        <section class="panel center">
          <p>{t('settingUp', room.names[0], def.name)}</p>
        </section>
      );
  } else {
    body = view ? (
      <def.Board
        key={room.gameKey}
        view={view}
        me={session.me}
        names={room.names}
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
          <span>{status === 'connected' ? t('withPartner', partner) : t(`status.${status}` as const)}</span>
        </div>
        <div class="room-buttons">
          {room.screen === 'game' && (
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
          returning={!!session.guestName}
          partner={partner}
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

function Invite({
  code,
  returning,
  partner,
  onNewDevice,
}: {
  code: string;
  returning: boolean;
  partner: string;
  onNewDevice: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = inviteLink(code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt(t('copyPrompt'), link);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: t('appName'), text: t('shareText'), url: link });
    } catch {
      /* cancelled */
    }
  }

  return (
    <section class={`invite ${returning ? 'compact' : ''}`}>
      {returning ? (
        <p>{t('returning', partner)}</p>
      ) : (
        <>
          <h2>{t('inviteTitle')}</h2>
          <p class="muted">{t('inviteHint')}</p>
        </>
      )}
      <div class="invite-row">
        <input
          class="mono"
          dir="ltr"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t('inviteLink')}
        />
        <button class="btn primary" onClick={copy}>
          {copied ? t('copied') : t('copy')}
        </button>
        {'share' in navigator && (
          <button class="btn" onClick={share}>
            {t('share')}
          </button>
        )}
      </div>
      {returning && (
        <div class="new-device">
          <button class="btn ghost small" onClick={onNewDevice}>
            {t('newDevice')}
          </button>
          <span class="muted small">{t('newDeviceHint', partner)}</span>
        </div>
      )}
    </section>
  );
}
