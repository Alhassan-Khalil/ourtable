import { useMemo, useState } from 'preact/hooks';
import { KEYS, load, save } from '../core/storage';
import type { GameDef } from '../core/types';
import { COMING_SOON, GAME_LIST } from '../games';
import { t } from '../i18n';
import { Invite } from './Invite';
import { fitsPlayers } from '../net/seats';
import type { Session } from '../net/session';
import { byTag, known, LOBBY_TAGS, pickRandom, pushRecent, toggleFavorite, type LobbyTag } from './lobbyModel';

const VALID = new Set(GAME_LIST.map((g) => g.id));
const BY_ID = new Map(GAME_LIST.map((g) => [g.id, g]));

/** Remember a game as played on this phone (called when any game starts, for both players). */
export function rememberPlayed(id: string) {
  save(KEYS.recent, pushRecent(known(load(KEYS.recent), VALID), id));
}

/**
 * The game menu: category chips, "Surprise me", recently played, favourites, and illustrated cards.
 * Favourites, recents and the chosen chip are kept per phone, so each player has their own.
 * Only the room's creator starts games (as before); the partner can still browse and star.
 */
export function Lobby({ session }: { session: Session }) {
  const room = session.room.value;
  const isHost = session.role === 'host';
  const mySeat = session.seat.value;
  const [inviting, setInviting] = useState(false);

  // Games fit the people at the table right now (before the first sync a guest assumes two).
  const online = room.seats.length ? room.seats.filter((x) => x?.online).length : 2;
  const fits = (g: GameDef) => fitsPlayers(g.players, online);
  const freeSeat = room.seats.some((x) => x === null);

  const [tag, setTag] = useState<LobbyTag>(() => {
    const saved = load<LobbyTag>(KEYS.lobbyTag);
    return saved && LOBBY_TAGS.includes(saved) ? saved : 'all';
  });
  const [favs, setFavs] = useState<string[]>(() => known(load(KEYS.favorites), VALID));
  const recent = useMemo(() => known(load(KEYS.recent), VALID), []);

  function start(id: string) {
    if (session.role === 'host') session.openGame(id);
  }

  function chooseTag(next: LobbyTag) {
    setTag(next);
    save(KEYS.lobbyTag, next);
  }

  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = toggleFavorite(prev, id);
      save(KEYS.favorites, next);
      return next;
    });
  }

  const shown = byTag(GAME_LIST, tag);
  const favGames = shown.filter((g) => favs.includes(g.id));
  const others = shown.filter((g) => !favs.includes(g.id));
  const recentGames = tag === 'all' ? recent.map((id) => BY_ID.get(id)!).filter(Boolean) : [];
  const soon = tag === 'all' || tag === 'board' ? COMING_SOON : [];

  function surprise() {
    const g = pickRandom(shown.filter(fits), recent[0] ?? null);
    if (g) start(g.id);
  }

  const card = (g: GameDef<any, any, any, any, any>) => (
    <GameCard key={g.id} g={g} fav={favs.includes(g.id)} canStart={isHost} fits={fits(g)} onStart={() => start(g.id)} onFav={() => toggleFav(g.id)} />
  );

  return (
    <section class="lobby">
      <div class="lobby-head">
        <h2>{t('pickGame')}</h2>
        {isHost && (
          <button type="button" class="btn small lobby-surprise" onClick={surprise}>
            🎲 {t('surprise')}
          </button>
        )}
      </div>
      {!isHost && <p class="muted small lobby-note">{t('hostChooses', room.seats[0]?.name ?? room.names[0])}</p>}

      {room.seats.length > 0 && (
        <div class="lobby-table">
          <span class="lobby-table-label">{t('inRoom')}:</span>
          {room.seats.map((x, seat) =>
            x ? (
              <span key={seat} class={`lobby-seat p${seat} ${x.online ? 'on' : 'off'}`}>
                <i />
                {seat === mySeat ? t('you') : x.name}
                {session.role === 'host' && seat > 0 && !x.online && (
                  <button type="button" class="lobby-seat-remove" aria-label={t('removePlayer', x.name)} onClick={() => session.role === 'host' && session.removeSeat(seat)}>
                    ✕
                  </button>
                )}
              </span>
            ) : null,
          )}
          {isHost && freeSeat && room.seats.filter(Boolean).length > 1 && (
            <button type="button" class="btn ghost small lobby-invite" onClick={() => setInviting(!inviting)}>
              {t('inviteMore')}
            </button>
          )}
        </div>
      )}
      {isHost && inviting && <Invite code={session.code} returning={false} partner="" title={t('inviteMore').replace('+ ', '')} />}

      <div class="lobby-tags" role="tablist" aria-label={t('categories')}>
        {LOBBY_TAGS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={x === tag} class={`lobby-tag ${x === tag ? 'on' : ''}`} onClick={() => chooseTag(x)}>
            {t(`cat.${x}` as const)}
          </button>
        ))}
      </div>

      {recentGames.length > 0 && (
        <>
          <h3 class="lobby-sec">🕘 {t('recent')}</h3>
          <div class="lobby-recent">
            {recentGames.map((g) => (
              <button key={g.id} type="button" class={`lobby-recent-pill ${fits(g) ? '' : 'nofit'}`} disabled={!isHost || !fits(g)} onClick={() => start(g.id)}>
                <span class="lobby-recent-art">
                  <g.Art />
                </span>
                {g.name}
              </button>
            ))}
          </div>
        </>
      )}

      {favGames.length > 0 && (
        <>
          <h3 class="lobby-sec">⭐ {t('favorites')}</h3>
          <div class="lobby-grid">{favGames.map(card)}</div>
        </>
      )}

      {(others.length > 0 || soon.length > 0) && (
        <>
          {favGames.length > 0 && <h3 class="lobby-sec">{t('moreGames')}</h3>}
          <div class="lobby-grid">
            {others.map(card)}
            {soon.map((s) => (
              <div key={s.name} class="game-card soon">
                <div class="game-card-main">
                  <span class="game-card-art soon-art">{s.icon}</span>
                  <span class="game-card-body">
                    <strong>{t(s.name)}</strong>
                    <span class="game-card-meta">{t('comingSoon')}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function GameCard({
  g,
  fav,
  canStart,
  fits,
  onStart,
  onFav,
}: {
  g: GameDef<any, any, any, any, any>;
  fav: boolean;
  canStart: boolean;
  /** Playable by the number of people at the table now. */
  fits: boolean;
  onStart: () => void;
  onFav: () => void;
}) {
  const [min, max] = g.players;
  // Show the player count when it matters: games for 3, or a 2-player game when 3 are here.
  const who = !fits ? t('onlyFor', max) : max > 2 ? t('playersCount', min, max) : null;
  return (
    <div class={`game-card ${fits ? '' : 'nofit'}`}>
      <button type="button" class="game-card-main" disabled={!canStart || !fits} title={g.blurb} onClick={onStart}>
        <span class="game-card-art">
          <g.Art />
        </span>
        <span class="game-card-body">
          <strong>{g.name}</strong>
          <span class="game-card-meta">
            ⏱ {t('minutes', g.minutes)} · {who ? `👥 ${who}` : g.tags.map((x) => t(`cat.${x}` as const)).join(' · ')}
          </span>
        </span>
      </button>
      <button
        type="button"
        class={`game-card-star ${fav ? 'on' : ''}`}
        aria-pressed={fav}
        aria-label={fav ? t('favRemove') : t('favAdd')}
        onClick={onFav}
      >
        {fav ? '★' : '☆'}
      </button>
    </div>
  );
}
