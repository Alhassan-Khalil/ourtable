import { useEffect, useRef, useState } from 'preact/hooks';
import type { BoardProps, GameDef, Seat } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import { Art } from './art';
import {
  apply,
  CATEGORIES,
  countBits,
  init,
  leaders,
  MAX_ANSWER_LEN,
  roundPoints,
  scoreRound,
  startsWithLetter,
  view,
  type Cell,
  type CatMove,
  type CatOptions,
  type CatState,
  type CatView,
} from './logic';
import { Setup } from './Setup';
import { tg } from './strings';
import './style.css';

type Send = (move: CatMove) => void;

const CAT_KEYS = ['cat.0', 'cat.1', 'cat.2', 'cat.3', 'cat.4'] as const;
const CAT_ICONS = ['🧑', '🐾', '🌿', '📦', '🌍'];
/** How long after the last keystroke the host gets the latest answers. */
const DRAFT_DELAY_MS = 500;

/** Blocks a double tap while a move is on its way; frees the button again if nothing came back. */
function useBusy() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => setBusy(false), 3000);
    return () => clearTimeout(id);
  }, [busy]);
  return [busy, () => setBusy(true)] as const;
}

/** The round's letter, big, with the round number. */
function Head({ letter, round, rounds }: { letter: string; round: number; rounds: number }) {
  return (
    <div class="cat-head">
      <div class="cat-letter">{letter}</div>
      <div class="cat-head-text">
        <span class="cat-sub">{tg('letter')}</span>
        <span class="cat-round">{tg('round', round, rounds)}</span>
      </div>
    </div>
  );
}

/** How far the other players are (never what they wrote). */
function Progress({ names, me, filled }: { names: string[]; me: number; filled: number[] }) {
  return (
    <ul class="cat-progress">
      {names.map((name, p) =>
        p === me ? null : (
          <li key={p} class={`cat-chip cat-p${p} ${filled[p] >= CATEGORIES ? 'done' : ''}`} aria-label={tg('progressAria', name, filled[p])}>
            <i />
            <bdi class="cat-chip-name">{name}</bdi>
            <span class="cat-pips" aria-hidden="true">
              {Array.from({ length: CATEGORIES }, (_, k) => (
                <b key={k} class={k < filled[p] ? 'on' : ''} />
              ))}
            </span>
            <span class="cat-count" dir="ltr">
              {filled[p]}/{CATEGORIES}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

/** Step 1: five boxes, typed at the same time as everyone else. */
function Write({ v, me, names, send }: { v: CatView; me: number; names: string[]; send: Send }) {
  const [answers, setAnswers] = useState<string[]>(() => v.mine.slice());
  // What was typed last (state lags a render behind), and what the host already has.
  const latest = useRef(answers);
  const sent = useRef(JSON.stringify(v.mine));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [busy, markBusy] = useBusy();

  useEffect(() => () => clearTimeout(timer.current), []);

  /** Send the answers to the host now, unless it already has exactly these. */
  function flush() {
    clearTimeout(timer.current);
    const key = JSON.stringify(latest.current);
    if (key === sent.current) return;
    sent.current = key;
    send({ type: 'draft', answers: latest.current });
  }

  function edit(i: number, value: string) {
    const next = latest.current.map((a, k) => (k === i ? value : a));
    latest.current = next;
    setAnswers(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DRAFT_DELAY_MS);
  }

  const allFilled = answers.every((a) => a.trim() !== '');

  function stop() {
    if (!allFilled || busy) return;
    clearTimeout(timer.current);
    markBusy();
    send({ type: 'stop', answers: latest.current });
  }

  return (
    <div class="cat-write">
      <Head letter={v.letter} round={v.round} rounds={v.rounds} />
      <Progress names={names} me={me} filled={v.filled} />
      <p class="cat-hint">{tg('writeHint', v.letter)}</p>

      <div class="cat-fields">
        {CAT_KEYS.map((key, i) => {
          const text = answers[i];
          const wrong = text.trim() !== '' && !startsWithLetter(text, v.letter);
          return (
            <label key={key} class={`cat-field ${wrong ? 'warn' : ''}`}>
              <span class="cat-label">
                <span aria-hidden="true">{CAT_ICONS[i]}</span> {tg(key)}
              </span>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                class="cat-input"
                type="text"
                value={text}
                maxLength={MAX_ANSWER_LEN}
                dir="auto"
                placeholder={`${v.letter}…`}
                autocomplete="off"
                spellcheck={false}
                enterkeyhint={i < CATEGORIES - 1 ? 'next' : 'done'}
                onInput={(e) => edit(i, e.currentTarget.value)}
                onBlur={flush}
                onKeyDown={(e) => {
                  // Enter jumps to the next box (and closes the keyboard after the last). It never stops the round.
                  if (e.key !== 'Enter' || e.isComposing) return;
                  e.preventDefault();
                  const next = inputs.current[i + 1];
                  if (next) next.focus();
                  else e.currentTarget.blur();
                }}
              />
              {wrong && (
                <span class="cat-warn" role="status">
                  {tg('wrongLetter', v.letter)}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <button type="button" class="cat-stop" disabled={!allFilled || busy} onClick={stop}>
        {tg('stop')}
      </button>
      {!allFilled && <p class="cat-note">{tg('stopLocked')}</p>}
    </div>
  );
}

interface RowProps {
  p: number;
  me: number;
  name: string;
  answer: string;
  cell: Cell;
  mask: number;
  players: number;
  letter: string;
  onVote: (on: boolean) => void;
}

/** One player's answer in one category: text, why it is worth nothing (if so), points, and the ✗ vote. */
function Row({ p, me, name, answer, cell, mask, players, letter, onVote }: RowProps) {
  const mine = p === me;
  const iRejected = ((mask >> me) & 1) === 1;
  const canVote = !mine && (cell.verdict === 'ok' || cell.verdict === 'rejected');
  const votes = countBits(mask);
  const needed = players - 1;

  const tags: string[] = [];
  if (cell.verdict === 'wrongLetter') tags.push(tg('wrongLetter', letter));
  if (cell.verdict === 'rejected') tags.push(tg('rejected'));
  if (cell.verdict === 'ok' && cell.shared) tags.push(tg('sameAnswer'));

  return (
    <div class={`cat-row cat-p${p} ${cell.points === 0 ? 'out' : ''} ${cell.verdict === 'empty' ? 'empty' : ''}`}>
      <div class="cat-main">
        <span class="cat-who">
          <i />
          <bdi>{mine ? t('you') : name}</bdi>
        </span>
        <span class="cat-answer" dir="auto">
          {cell.verdict === 'empty' ? '—' : answer}
        </span>
        {(tags.length > 0 || (cell.verdict === 'ok' && votes > 0)) && (
          <span class="cat-tags">
            {tags.map((tag) => (
              <span key={tag} class="cat-tag">
                {tag}
              </span>
            ))}
            {cell.verdict === 'ok' && votes > 0 && (
              <span class="cat-tag" dir="ltr">
                ✕ {votes}/{needed}
              </span>
            )}
          </span>
        )}
      </div>
      <span class={`cat-pts cat-pts-${cell.points}`} dir="ltr">
        {cell.points > 0 ? `+${cell.points}` : '0'}
      </span>
      {canVote ? (
        <button
          type="button"
          class="cat-reject"
          aria-pressed={iRejected}
          aria-label={tg('rejectAria', name)}
          onClick={() => onVote(!iRejected)}
        >
          ✕
        </button>
      ) : (
        <span class="cat-reject-slot" aria-hidden="true" />
      )}
    </div>
  );
}

/** Step 2: everything side by side, vote ✗ on answers that don't count, then "Ready". */
function Review({
  v,
  me,
  names,
  cells,
  pts,
  send,
}: {
  v: CatView;
  me: number;
  names: string[];
  cells: Cell[][];
  pts: number[];
  send: Send;
}) {
  const answers = v.answers ?? [];
  const rejects = v.rejects ?? [];
  const meReady = v.ready[me];

  return (
    <div class="cat-review">
      <Head letter={v.letter} round={v.round} rounds={v.rounds} />
      {v.stoppedBy !== null && (
        <p class="cat-stopped">{v.stoppedBy === me ? tg('stoppedByYou') : tg('stoppedBy', names[v.stoppedBy])}</p>
      )}
      <p class="cat-hint">{tg('reviewHint')}</p>

      <div class="cat-cards">
        {CAT_KEYS.map((key, c) => (
          <section key={key} class="cat-card">
            <h3 class="cat-card-head">
              <span aria-hidden="true">{CAT_ICONS[c]}</span> {tg(key)}
            </h3>
            {names.map((name, p) => (
              <Row
                key={p}
                p={p}
                me={me}
                name={name}
                answer={answers[p]?.[c] ?? ''}
                cell={cells[p][c]}
                mask={rejects[p]?.[c] ?? 0}
                players={v.players}
                letter={v.letter}
                onVote={(on) => send({ type: 'reject', player: p, category: c, on, round: v.round })}
              />
            ))}
          </section>
        ))}
      </div>

      <section class="cat-ready" aria-label={tg('thisRound')}>
        <h3 class="cat-ready-title">{tg('thisRound')}</h3>
        <ul class="cat-ready-list">
          {names.map((name, p) => (
            <li key={p} class={`cat-chip cat-p${p} ${v.ready[p] ? 'done' : ''}`}>
              <i />
              <bdi class="cat-chip-name">{p === me ? t('you') : name}</bdi>
              <b dir="ltr">+{pts[p]}</b>
              <span aria-hidden="true">{v.ready[p] ? '✓' : '…'}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          class="btn primary wide cat-ready-btn"
          disabled={meReady}
          onClick={() => send({ type: 'ready', round: v.round })}
        >
          {meReady ? tg('waiting') : tg('ready')}
        </button>
      </section>
    </div>
  );
}

/** Step 3: points round by round, and the totals. */
function Over({ v, me, names, rematch, toLobby }: { v: CatView; me: number; names: string[]; rematch: () => void; toLobby: () => void }) {
  const top = leaders(v.scores);
  const tiedAtTop = v.winner === 'draw' && top.length < v.players;

  return (
    <div class="cat-over">
      {tiedAtTop && <p class="cat-tied">{tg('tiedFor', t('listJoin', top.map((p) => (p === me ? t('you') : names[p]))))}</p>}

      <section class="cat-section">
        <h3 class="cat-section-title">{tg('final')}</h3>
        <div class="cat-table" style={`--rounds:${v.rounds}`} role="table">
          <div class="cat-tr cat-th" role="row">
            <span class="cat-td cat-td-name" role="columnheader" />
            {v.history.map((_, r) => (
              <span key={r} class="cat-td" role="columnheader" dir="auto">
                {v.letters[r]}
              </span>
            ))}
            <span class="cat-td cat-td-total" role="columnheader">
              {tg('total')}
            </span>
          </div>
          {names.map((name, p) => (
            <div key={p} class={`cat-tr cat-p${p} ${top.includes(p) ? 'lead' : ''}`} role="row">
              <span class="cat-td cat-td-name" role="rowheader">
                <i />
                <bdi>{p === me ? t('you') : name}</bdi>
              </span>
              {v.history.map((pts, r) => (
                <span key={r} class="cat-td" role="cell">
                  {pts[p]}
                </span>
              ))}
              <span class="cat-td cat-td-total" role="cell">
                {v.scores[p]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <EndActions rematch={rematch} toLobby={toLobby} />
    </div>
  );
}

function Board({ view: v, me, names, send, rematch, toLobby }: BoardProps<CatView, CatMove, Seat>) {
  const revealed = v.phase !== 'write' && v.answers !== null && v.rejects !== null;
  const cells = revealed ? scoreRound(v.answers!, v.letter, v.rejects!) : null;
  const pts = cells ? roundPoints(cells) : null;
  // While the round is being checked, the bar already counts this round's points (it moves as ✗ votes come in).
  const scores = v.phase === 'review' && pts ? v.scores.map((s, p) => s + pts[p]) : v.scores;

  let status: string;
  let active = false;
  if (v.phase === 'over') {
    status =
      v.winner === 'draw' ? t('draw') : v.winner === me ? t('youWin') : t('oppWins', names[v.winner as number] ?? '');
  } else if (v.phase === 'review') {
    status = v.ready[me] ? tg('waiting') : tg('reviewBanner');
    active = !v.ready[me];
  } else {
    status = tg('writeBanner');
    active = true;
  }

  return (
    <div class="cat">
      <TurnBanner text={status} active={active} over={v.phase === 'over'} />
      <ScoreBar names={names} me={me} scores={scores} />

      {v.phase === 'write' && <Write key={v.round} v={v} me={me} names={names} send={send} />}
      {v.phase === 'review' && cells && pts && <Review v={v} me={me} names={names} cells={cells} pts={pts} send={send} />}
      {v.phase === 'over' && <Over v={v} me={me} names={names} rematch={rematch} toLobby={toLobby} />}
    </div>
  );
}

export const categories: GameDef<CatState, CatMove, CatView, CatOptions, Seat> = {
  id: 'categories',
  get name() {
    return tg('name');
  },
  icon: '📝',
  tags: ['words'],
  minutes: 10,
  players: [2, 3],
  Art,
  get blurb() {
    return tg('blurb');
  },
  Setup,
  init: (opts, players) => init(opts, players),
  apply: (s, move, by) => apply(s, move, by),
  view: (s, me) => view(s, me),
  Board,
};
