import { useEffect, useMemo, useState } from 'preact/hooks';
import { other, type BoardProps, type GameDef } from '../../core/types';
import { lang, t } from '../../i18n';
import { EndActions, TurnBanner } from '../../ui/common';
import { QUICK_QUESTIONS } from './faces';
import { apply, init, MAX_QUESTION, view, type Card, type GWMove, type GWOptions, type GWState, type GWView } from './logic';
import { Setup } from './Setup';

const label = (c: Card) => (lang.value === 'ar' && c.nameAr) || c.name;

function Board({ view: v, me, names, send, rematch, toLobby }: BoardProps<GWView, GWMove>) {
  const opp = names[other(me)];
  const [guessing, setGuessing] = useState(false);
  const [confirm, setConfirm] = useState<Card | null>(null);
  const [text, setText] = useState('');

  const byId = useMemo(() => new Map(v.deck.map((c) => [c.id, c])), [v.deck]);
  const chips = useMemo(
    () => QUICK_QUESTIONS.filter(([tag]) => v.deck.some((c) => c.tags?.includes(tag))),
    [v.deck],
  );
  const flipped = new Set(v.myFlips);
  const left = v.deck.length - v.deck.filter((c) => flipped.has(c.id)).length;

  const playing = v.phase === 'play';
  const myTurn = playing && v.turn === me;
  const canAsk = myTurn && v.step === 'ask';
  const mustAnswer = playing && v.step === 'answer' && v.turn !== me;
  const last = v.log[v.log.length - 1];
  const justAnswered = playing && last && last.by === me && last.a !== null && v.turn !== me;
  const mine = v.mySecret ? byId.get(v.mySecret) : undefined;

  useEffect(() => {
    if (!canAsk) {
      setGuessing(false);
      setConfirm(null);
    }
  }, [canAsk]);

  function ask(q: string) {
    if (!q.trim()) return;
    send({ type: 'ask', text: q });
    setText('');
  }

  function onCard(c: Card) {
    if (v.phase === 'pick') send({ type: 'pick', cardId: c.id });
    else if (playing && guessing) setConfirm(c);
    else if (playing) send({ type: 'flip', cardId: c.id });
  }

  const nameOf = (id: string | null) => {
    const c = id ? byId.get(id) : undefined;
    return c ? label(c) : '?';
  };

  let status: string;
  if (v.phase === 'pick') {
    status = !v.mySecret ? t('gw.pickPrompt') : !v.oppReady ? t('gw.waitPick', opp) : t('gw.starting');
  } else if (v.phase === 'over') {
    status = v.winner === me ? t('youWin') : t('oppWins', opp);
  } else if (canAsk) {
    status = guessing ? t('gw.tapGuess') : t('gw.yourTurn');
  } else if (myTurn) {
    status = t('gw.waitAnswer', opp);
  } else if (mustAnswer) {
    status = t('gw.oppAsked', opp);
  } else {
    status = t('gw.oppThinking', opp);
  }

  let result = '';
  if (v.phase === 'over' && v.guess) {
    const g = nameOf(v.guess.cardId);
    if (v.guess.by === me) {
      result = v.guess.correct ? t('gw.youRight', g) : t('gw.youWrong', g, nameOf(v.oppSecret));
    } else {
      result = v.guess.correct ? t('gw.oppRight', opp, g) : t('gw.oppWrong', opp, g, nameOf(v.mySecret));
    }
  }

  return (
    <div class="gw">
      <TurnBanner
        text={status}
        active={canAsk || mustAnswer || (v.phase === 'pick' && !v.mySecret)}
        over={v.phase === 'over'}
      />

      <div class="gw-layout">
        <div class={`gw-grid ${guessing ? 'guessing' : ''} ${v.phase}`}>
          {v.deck.map((c) => {
            const cls = [
              'gw-card',
              flipped.has(c.id) && v.phase !== 'pick' && 'down',
              v.phase === 'pick' && v.mySecret === c.id && 'chosen',
              v.phase === 'over' && v.oppSecret === c.id && 'reveal',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={c.id}
                class={cls}
                onClick={() => onCard(c)}
                disabled={v.phase === 'over' || (playing && guessing && flipped.has(c.id))}
                aria-pressed={flipped.has(c.id)}
              >
                <img src={c.img} alt="" draggable={false} />
                <span dir="auto">{label(c)}</span>
              </button>
            );
          })}
        </div>

        {/* On phones this aside dissolves (display: contents) and its parts are re-ordered around the grid. */}
        <aside class="gw-side">
          <div class="gw-secret">
            {mine ? (
              <img src={mine.img} alt="" />
            ) : (
              <span class="gw-secret-empty" aria-hidden="true">
                ?
              </span>
            )}
            <div>
              <div class="label">{t('gw.yourPerson')}</div>
              <strong dir="auto">{mine ? label(mine) : '—'}</strong>
              {v.phase !== 'pick' && <div class="muted small">{t('gw.left', left, v.deck.length)}</div>}
            </div>
          </div>

          {mustAnswer && last && (
            <div class="gw-question">
              <div class="label">{t('gw.asks', opp)}</div>
              <p class="q">
                {lang.value === 'ar' ? '«' : '“'}
                <bdi>{last.q}</bdi>
                {lang.value === 'ar' ? '»' : '”'}
              </p>
              <div class="yn">
                <button class="btn yes" onClick={() => send({ type: 'answer', yes: true })}>
                  {t('yes')}
                </button>
                <button class="btn no" onClick={() => send({ type: 'answer', yes: false })}>
                  {t('no')}
                </button>
              </div>
              <p class="muted small">{t('gw.answerAbout', mine ? label(mine) : '?')}</p>
            </div>
          )}

          {canAsk && !guessing && (
            <div class="gw-ask">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(text);
                }}
              >
                <input
                  value={text}
                  maxLength={MAX_QUESTION}
                  dir="auto"
                  enterKeyHint="send"
                  placeholder={t('gw.askPlaceholder')}
                  onInput={(e) => setText(e.currentTarget.value)}
                  aria-label={t('gw.yourQuestion')}
                />
                <button class="btn primary" disabled={!text.trim()}>
                  {t('gw.ask')}
                </button>
              </form>
              {chips.length > 0 && (
                <div class="chips">
                  {chips.map(([tag, q]) => (
                    <button key={tag} class="chip" onClick={() => ask(q[lang.value])}>
                      {q[lang.value]}
                    </button>
                  ))}
                </div>
              )}
              <button class="btn ghost" onClick={() => setGuessing(true)}>
                {t('gw.makeGuess')}
              </button>
            </div>
          )}

          {canAsk && guessing && (
            <div class="gw-ask">
              <p>{t('gw.guessHelp', opp)}</p>
              <button class="btn ghost" onClick={() => setGuessing(false)}>
                {t('gw.cancelGuess')}
              </button>
            </div>
          )}

          {justAnswered && (
            <p class="gw-hint">
              {t('gw.said', opp)} <b>{last.a ? t('yes') : t('no')}</b>. {t('gw.flipHint')}
            </p>
          )}

          {v.phase === 'over' && (
            <div class="gw-result">
              <p>{result}</p>
              <EndActions rematch={rematch} toLobby={toLobby} />
            </div>
          )}

          {v.log.length > 0 && (
            <div class="gw-log">
              <div class="label">{t('gw.questions')}</div>
              <ol>
                {v.log
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <li key={v.log.length - i}>
                      <span class="who">{e.by === me ? t('you') : opp}:</span> <bdi>{e.q}</bdi>{' '}
                      <span class={`ans ${e.a === null ? 'wait' : e.a ? 'yes' : 'no'}`}>
                        {e.a === null ? '…' : e.a ? t('yes') : t('no')}
                      </span>
                    </li>
                  ))}
              </ol>
            </div>
          )}
        </aside>
      </div>

      {confirm && (
        <div class="modal" role="dialog" aria-modal="true" onClick={() => setConfirm(null)}>
          <div class="modal-box" onClick={(e) => e.stopPropagation()}>
            <img src={confirm.img} alt="" />
            <h3>{t('gw.guessConfirm', label(confirm))}</h3>
            <p class="muted">{t('gw.ifWrong', opp)}</p>
            <div class="actions">
              <button class="btn ghost" onClick={() => setConfirm(null)}>
                {t('cancel')}
              </button>
              <button
                class="btn primary"
                onClick={() => {
                  send({ type: 'guess', cardId: confirm.id });
                  setConfirm(null);
                }}
              >
                {t('gw.yesGuess')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const guessWho: GameDef<GWState, GWMove, GWView, GWOptions> = {
  id: 'guesswho',
  get name() {
    return t('gw.name');
  },
  icon: '🕵️',
  get blurb() {
    return t('gw.blurb');
  },
  Setup,
  init: (opts) => init(opts),
  rematchOpts: (s) => ({ deck: s.deck, deckName: s.deckName }),
  apply,
  view,
  Board,
};
