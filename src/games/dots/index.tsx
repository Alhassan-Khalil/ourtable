import { other, type BoardProps, type GameDef } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import { Art } from './art';
import { apply, init, type DotsMove, type DotsState } from './logic';
import { tg } from './strings';
import './style.css';

const U = 10; // distance between dots (SVG units)
const M = 4; // margin around the dots

function Board({ view: s, me, names, send, rematch, toLobby }: BoardProps<DotsState, DotsMove>) {
  const n = s.size;
  const opp = names[other(me)];
  const myTurn = s.winner === null && s.turn === me;
  const scoredAgain = s.last !== null && s.last.closed > 0 && s.last.by === s.turn;

  const status =
    s.winner === 'draw'
      ? t('draw')
      : s.winner === me
        ? t('youWin')
        : s.winner !== null
          ? t('oppWins', opp)
          : myTurn
            ? scoredAgain
              ? tg('again')
              : tg('yourTurn')
            : scoredAgain
              ? tg('oppAgain', opp)
              : t('oppTurn', opp);

  const X = (c: number) => M + c * U;
  const Y = (r: number) => M + r * U;
  const W = n * U + 2 * M;

  // Every line with its end points, so drawing and hit areas share one list.
  const lines: { o: 'h' | 'v'; i: number; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let r = 0; r <= n; r++)
    for (let c = 0; c < n; c++) lines.push({ o: 'h', i: r * n + c, x1: X(c), y1: Y(r), x2: X(c + 1), y2: Y(r) });
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= n; c++) lines.push({ o: 'v', i: r * (n + 1) + c, x1: X(c), y1: Y(r), x2: X(c), y2: Y(r + 1) });

  const owner = (o: 'h' | 'v', i: number) => (o === 'h' ? s.h : s.v)[i];
  const isLast = (o: 'h' | 'v', i: number) => s.last !== null && s.last.o === o && s.last.i === i;

  return (
    <div class="dots">
      <TurnBanner text={status} active={myTurn} over={s.winner !== null} />
      <ScoreBar names={names} me={me} scores={s.scores} turn={s.winner === null ? s.turn : null} />

      {/* Geometry, so always left-to-right. */}
      <svg class={`dots-board ${myTurn ? 'can-play' : ''}`} viewBox={`0 0 ${W} ${W}`} dir="ltr">
        {s.boxes.map((b, k) =>
          b === null ? null : (
            <rect
              key={`b${k}`}
              class={`dots-box p${b}`}
              x={X(k % n) + 0.7}
              y={Y(Math.floor(k / n)) + 0.7}
              width={U - 1.4}
              height={U - 1.4}
              rx={1}
            />
          ),
        )}

        {lines.map(({ o, i, x1, y1, x2, y2 }) => {
          const who = owner(o, i);
          if (who !== null) {
            return (
              <line
                key={`${o}${i}`}
                class={`dots-line p${who} ${isLast(o, i) ? 'last' : ''}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
              />
            );
          }
          // Empty line: faint guide, plus a generous invisible tap area when it's my turn.
          const horizontal = o === 'h';
          return (
            <g key={`${o}${i}`} class="dots-slot">
              <line class="dots-line empty" x1={x1} y1={y1} x2={x2} y2={y2} />
              {myTurn && (
                <rect
                  class="dots-hit"
                  role="button"
                  tabIndex={0}
                  aria-label={tg('line')}
                  x={horizontal ? x1 + 1.5 : x1 - 3.5}
                  y={horizontal ? y1 - 3.5 : y1 + 1.5}
                  width={horizontal ? U - 3 : 7}
                  height={horizontal ? 7 : U - 3}
                  onClick={() => send({ o, i })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      send({ o, i });
                    }
                  }}
                />
              )}
            </g>
          );
        })}

        {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => (
          <circle key={`d${k}`} class="dots-dot" cx={X(k % (n + 1))} cy={Y(Math.floor(k / (n + 1)))} r={1.1} />
        ))}
      </svg>

      {s.winner !== null && <EndActions rematch={rematch} toLobby={toLobby} />}
    </div>
  );
}

export const dots: GameDef<DotsState, DotsMove, DotsState, null> = {
  id: 'dots',
  get name() {
    return tg('name');
  },
  icon: '🔲',
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
