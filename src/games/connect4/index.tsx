import type { BoardProps, GameDef } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, TurnBanner } from '../../ui/common';
import { Art } from './art';
import { apply, COLS, init, ROWS, type C4Move, type C4State } from './logic';

function Board({ view, me, names, send, rematch, toLobby }: BoardProps<C4State, C4Move>) {
  const opp = names[me === 0 ? 1 : 0];
  const myTurn = view.winner === null && view.turn === me;
  const status =
    view.winner === 'draw'
      ? t('c4.draw')
      : view.winner === me
        ? t('youWin')
        : view.winner !== null
          ? t('oppWins', opp)
          : myTurn
            ? t('c4.yourTurn')
            : t('oppTurn', opp);

  return (
    <div class="c4">
      <TurnBanner text={status} active={myTurn} over={view.winner !== null} />
      <div class="c4-legend">
        {[0, 1].map((p) => (
          <span key={p} class={`c4-chip p${p}`}>
            <i /> {p === me ? t('you') : names[p]}
          </span>
        ))}
      </div>
      {/* Always left-to-right, so "the third column" is the same column on both screens in any language. */}
      <div class={`c4-board ${myTurn ? 'can-play' : ''}`} dir="ltr" style={{ '--cols': COLS, '--rows': ROWS }}>
        {Array.from({ length: COLS }, (_, col) => (
          <button
            key={col}
            class="c4-col"
            disabled={!myTurn || view.cells[col] !== null}
            onClick={() => send({ col })}
            aria-label={t('c4.dropIn', col + 1)}
          >
            {Array.from({ length: ROWS }, (_, row) => {
              const i = row * COLS + col;
              const cell = view.cells[i];
              const cls = [
                'c4-cell',
                cell !== null && `p${cell}`,
                view.last === i && 'drop',
                view.line?.includes(i) && 'win',
              ]
                .filter(Boolean)
                .join(' ');
              return <span key={i} class={cls} style={{ '--row': row }} />;
            })}
          </button>
        ))}
      </div>
      {view.winner !== null && <EndActions rematch={rematch} toLobby={toLobby} />}
    </div>
  );
}

export const connect4: GameDef<C4State, C4Move, C4State, null> = {
  id: 'connect4',
  get name() {
    return t('c4.name');
  },
  icon: '🔴',
  tags: ['board', 'quick'],
  minutes: 5,
  Art,
  get blurb() {
    return t('c4.blurb');
  },
  init: () => init(),
  apply,
  view: (s) => s,
  Board,
};
