import { useMemo, useState } from 'preact/hooks';
import { KEYS, load, save } from '../core/storage';
import type { GameDef } from '../core/types';
import { COMING_SOON, GAME_LIST } from '../games';
import { t } from '../i18n';
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
    const g = pickRandom(shown, recent[0] ?? null);
    if (g) start(g.id);
  }

  const card = (g: GameDef) => (
    <GameCard key={g.id} g={g} fav={favs.includes(g.id)} canStart={isHost} onStart={() => start(g.id)} onFav={() => toggleFav(g.id)} />
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
      {!isHost && <p class="muted small lobby-note">{t('hostChooses', room.names[0])}</p>}

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
              <button key={g.id} type="button" class="lobby-recent-pill" disabled={!isHost} onClick={() => start(g.id)}>
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
  onStart,
  onFav,
}: {
  g: GameDef;
  fav: boolean;
  canStart: boolean;
  onStart: () => void;
  onFav: () => void;
}) {
  return (
    <div class="game-card">
      <button type="button" class="game-card-main" disabled={!canStart} title={g.blurb} onClick={onStart}>
        <span class="game-card-art">
          <g.Art />
        </span>
        <span class="game-card-body">
          <strong>{g.name}</strong>
          <span class="game-card-meta">
            ⏱ {t('minutes', g.minutes)} · {g.tags.map((x) => t(`cat.${x}` as const)).join(' · ')}
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
