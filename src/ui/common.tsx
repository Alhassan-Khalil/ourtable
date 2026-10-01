import type { Player } from '../core/types';
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
 * Both players with their seat colour (p0 / p1), optional scores, and whose turn it is.
 * "You" is shown for `me`, so each screen reads naturally.
 */
export function ScoreBar({
  names,
  me,
  scores,
  turn,
}: {
  names: [string, string];
  me: Player;
  scores?: [number, number] | null;
  turn?: Player | null;
}) {
  return (
    <div class="score-bar">
      {([0, 1] as const).map((p) => (
        <span key={p} class={`score-chip p${p} ${turn === p ? 'turn' : ''}`}>
          <i />
          <span class="score-name">{p === me ? t('you') : names[p]}</span>
          {scores && <b>{scores[p]}</b>}
        </span>
      ))}
    </div>
  );
}
