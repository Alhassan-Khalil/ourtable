import { useState } from 'preact/hooks';
import { load, save } from '../../core/storage';
import type { SetupProps } from '../../core/types';
import { t } from '../../i18n';
import type { BasraOptions } from './logic';
import { tg } from './strings';

/** The host's last choice, so "Basra" opens the way it was played last time. */
const LAST_CHOICE = 'ourtable.basra.length';

const CHOICES = [
  { length: 'one', big: '1', title: 'one', hint: 'oneHint' },
  { length: 'full', big: '101', title: 'full', hint: 'fullHint' },
] as const;

/** Host-only: one round, or rounds until 101. */
export function Setup({ onStart, onCancel }: SetupProps<BasraOptions>) {
  const [length, setLength] = useState<BasraOptions['length']>(() => (load<string>(LAST_CHOICE) === 'full' ? 'full' : 'one'));

  function start() {
    save(LAST_CHOICE, length);
    onStart({ length });
  }

  return (
    <div class="panel basra-setup">
      <h2>{tg('name')}</h2>
      <p class="muted">{tg('lengthLabel')}</p>
      <div class="choice-row">
        {CHOICES.map((c) => (
          <button key={c.length} class={`choice ${length === c.length ? 'on' : ''}`} aria-pressed={length === c.length} onClick={() => setLength(c.length)}>
            <b class="basra-choice-big" aria-hidden="true">
              {c.big}
            </b>
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
