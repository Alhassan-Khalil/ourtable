import { useState } from 'preact/hooks';
import type { SetupProps } from '../../core/types';
import { lang, t } from '../../i18n';
import type { Alphabet, CatOptions } from './logic';
import { tg } from './strings';

type Rounds = CatOptions['rounds'];

/** Host-only screen: which letters and how many rounds. */
export function Setup({ onStart, onCancel }: SetupProps<CatOptions>) {
  const [alphabet, setAlphabet] = useState<Alphabet>(() => (lang.value === 'en' ? 'en' : 'ar'));
  const [rounds, setRounds] = useState<Rounds>(5);

  const alphabets: { id: Alphabet; label: string; sample: string }[] = [
    { id: 'ar', label: tg('setup.ar'), sample: 'أ ب ج' },
    { id: 'en', label: tg('setup.en'), sample: 'A B C' },
  ];

  return (
    <div class="panel cat-setup">
      <h2>{tg('setup.title')}</h2>

      <h3 class="cat-setup-label" id="cat-alphabet-label">
        {tg('setup.alphabet')}
      </h3>
      <div class="cat-opts" role="radiogroup" aria-labelledby="cat-alphabet-label">
        {alphabets.map((a) => (
          <button
            key={a.id}
            type="button"
            class={`cat-opt ${alphabet === a.id ? 'on' : ''}`}
            role="radio"
            aria-checked={alphabet === a.id}
            onClick={() => setAlphabet(a.id)}
          >
            <span class="cat-opt-sample" dir="ltr">
              {a.sample}
            </span>
            <strong>{a.label}</strong>
          </button>
        ))}
      </div>

      <h3 class="cat-setup-label" id="cat-rounds-label">
        {tg('setup.rounds')}
      </h3>
      <div class="cat-opts" role="radiogroup" aria-labelledby="cat-rounds-label">
        {([3, 5] as Rounds[]).map((n) => (
          <button
            key={n}
            type="button"
            class={`cat-opt ${rounds === n ? 'on' : ''}`}
            role="radio"
            aria-checked={rounds === n}
            onClick={() => setRounds(n)}
          >
            <span class="cat-opt-sample" dir="ltr">
              {n}
            </span>
            <strong>{tg('setup.roundsN', n)}</strong>
          </button>
        ))}
      </div>

      <div class="actions">
        <button class="btn ghost" onClick={onCancel}>
          {t('back')}
        </button>
        <button class="btn primary" onClick={() => onStart({ alphabet, rounds })}>
          {t('startGame')}
        </button>
      </div>
    </div>
  );
}
