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
