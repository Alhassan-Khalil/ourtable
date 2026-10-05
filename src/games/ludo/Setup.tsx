import { useState } from 'preact/hooks';
import { load, save } from '../../core/storage';
import type { SetupProps } from '../../core/types';
import { t } from '../../i18n';
import type { LudoOptions } from './logic';
import { tg } from './strings';

/** The host's last choice, so "Ludo" opens the way it was played last time. */
const LAST_CHOICE = 'ourtable.ludo.tokens';

const CHOICES = [
  { tokens: 2, title: 'quick', hint: 'quickHint' },
  { tokens: 4, title: 'classic', hint: 'classicHint' },
] as const;

/** Host-only: how many tokens each player races home. */
export function Setup({ onStart, onCancel }: SetupProps<LudoOptions>) {
  const [tokens, setTokens] = useState<2 | 4>(() => (load<number>(LAST_CHOICE) === 4 ? 4 : 2));

  function start() {
    save(LAST_CHOICE, tokens);
    onStart({ tokens });
  }

  return (
    <div class="panel ludo-setup">
      <h2>{tg('name')}</h2>
      <p class="muted">{tg('tokensLabel')}</p>
      <div class="choice-row">
        {CHOICES.map((c) => (
          <button key={c.tokens} class={`choice ${tokens === c.tokens ? 'on' : ''}`} aria-pressed={tokens === c.tokens} onClick={() => setTokens(c.tokens)}>
            <span class="ludo-choice-tokens" aria-hidden="true">
              {Array.from({ length: c.tokens }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            <strong>{tg(c.title)}</strong>
            <span>{tg(c.hint)}</span>
          </button>
        ))}
      </div>
      <div class="actions">
        <button class="btn ghost" onClick={onCancel}>
          {t('back')}
        </button>
        <button class="btn primary" onClick={start}>
          {t('startGame')}
        </button>
      </div>
    </div>
  );
}
