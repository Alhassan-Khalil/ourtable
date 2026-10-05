import { t } from '../i18n';

export function TurnBanner({ text, active, over }: { text: string; active: boolean; over?: boolean }) {
  return (
    <div class={`turn-banner ${active ? 'active' : ''} ${over ? 'over' : ''}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}

export function EndActions({ rematch, toLobby }: { rematch: () => void; toLobby: () => void }) {
  return (
    <div class="actions">
      <button class="btn primary" onClick={rematch}>
        {t('playAgain')}
      </button>
      <button class="btn ghost" onClick={toLobby}>
        {t('otherGames')}
      </button>
    </div>
  );
}

/**
 * Every player with their colour (p0 / p1 / p2), optional scores, and whose turn it is.
 * "You" is shown for `me`, so each screen reads naturally.
 */
export function ScoreBar({
  names,
  me,
  scores,
  turn,
}: {
  names: string[];
  me: number;
  scores?: readonly number[] | null;
  turn?: number | null;
}) {
  return (
    <div class="score-bar">
      {names.map((_, p) => (
        <span key={p} class={`score-chip p${p} ${turn === p ? 'turn' : ''}`}>
          <i />
          <span class="score-name">{p === me ? t('you') : names[p]}</span>
          {scores && <b>{scores[p]}</b>}
        </span>
      ))}
    </div>
  );
}
