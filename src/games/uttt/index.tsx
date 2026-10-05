import { other, type BoardProps, type GameDef, type Player } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import { Art } from './art';
import { apply, BOARDS, init, type UtttMove, type UtttState } from './logic';
import { tg } from './strings';
import './style.css';

/** ✕ for seat 0, ◯ for seat 1, drawn as SVG so it scales with the cell and looks the same everywhere. */
function Mark({ p }: { p: Player }) {
  return p === 0 ? (
    <svg class="uttt-mark p0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5L19 19M19 5L5 19" />
    </svg>
  ) : (
    <svg class="uttt-mark p1" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" />
    </svg>
  );
}

function Board({ view: s, me, names, send, rematch, toLobby }: BoardProps<UtttState, UtttMove>) {
  const opp = names[other(me)];
  const over = s.winner !== null;
  const myTurn = !over && s.turn === me;

  const status =
    s.winner === 'draw'
      ? t('draw')
      : s.winner === me
        ? t('youWin')
        : s.winner !== null
          ? t('oppWins', opp)
          : myTurn
            ? s.next === null
              ? tg('yourTurnAny')
              : tg('yourTurnBoard')
            : t('oppTurn', opp);

  // Small boards won so far, shown next to each name.
  const won: [number, number] = [0, 0];
  for (const o of s.small) if (o === 0 || o === 1) won[o]++;

  return (
    <div class="uttt">
      <TurnBanner text={status} active={myTurn} over={over} />
      <ScoreBar names={names} me={me} scores={won} turn={over ? null : s.turn} />

      <div class="uttt-legend">
        <span class="uttt-sym">
          <span class="uttt-sym-name">{tg('yourSymbol')}</span>
          <Mark p={me} />
        </span>
        <span class="uttt-sym">
          <span class="uttt-sym-name">{opp}</span>
          <Mark p={other(me)} />
        </span>
      </div>

      {/* Geometry ("the top-right board"), so always left-to-right in any language. */}
      <div class="uttt-board" dir="ltr">
        {Array.from({ length: BOARDS }, (_, b) => {
          const owner = s.small[b];
          const open = owner === null;
          // The board the player whose turn it is may play in.
          const targeted = !over && open && (s.next === null || s.next === b);
          const playable = myTurn && targeted;
          const inLine = s.line !== null && s.line.includes(b);

          const cls = [
            'uttt-small',
            (owner === 0 || owner === 1) && `won won-p${owner}`,
            owner === 'draw' && 'drawn',
            playable && 'hot',
            // On the partner's turn, softly show where they have to play.
            !myTurn && targeted && s.next !== null && `aim aim-p${s.turn}`,
            myTurn && open && !targeted && 'dim',
            s.line !== null && (inLine ? 'win' : 'fade'),
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={b} class={cls}>
              {Array.from({ length: 9 }, (_, c) => {
                const i = b * 9 + c;
                const v = s.cells[i];
                return (
                  <button
                    key={c}
                    type="button"
                    class={`uttt-cell ${v !== null ? `p${v}` : ''} ${s.last === i ? 'last' : ''}`}
                    disabled={!playable || v !== null}
                    aria-label={tg('cell', b + 1, c + 1)}
                    onClick={() => send({ i })}
                  >
                    {v !== null && <Mark p={v} />}
                  </button>
                );
              })}
              {(owner === 0 || owner === 1) && (
                <span class="uttt-claim" aria-hidden="true">
                  <Mark p={owner} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {over ? <EndActions rematch={rematch} toLobby={toLobby} /> : <p class="uttt-hint">{tg('hint')}</p>}
    </div>
  );
}

export const uttt: GameDef<UtttState, UtttMove, UtttState, null> = {
  id: 'uttt',
  get name() {
    return tg('name');
  },
  icon: '❌',
  tags: ['board'],
  minutes: 10,
  Art,
  get blurb() {
    return tg('blurb');
  },
  init: () => init(),
  apply,
  view: (s) => s, // no hidden information
  Board,
};
