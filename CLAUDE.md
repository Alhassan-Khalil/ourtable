# OurTable (طاولتنا)

Two-player board games for a couple in different countries. Browser-to-browser (WebRTC via PeerJS),
no backend, no accounts. Arabic-first (RTL) with an English toggle, phone-first layout.

## Commands

- `npm run dev`: dev server on http://localhost:5173 (also on the LAN via `--host`)
- `npm test`: unit tests (vitest) for game rules and room codes
- `npm run build`: type-check + production build into `dist/` (static files, any host works)
- `npm run typecheck`

## Architecture

```
src/core/      types (GameDef, Player, GameError), wire protocol, ids (room codes), storage
src/net/link.ts     the "phone line": PeerJS peers, handshake, heartbeat, reconnects, seat lock
src/net/session.ts  HostSession (owns state, applies moves, persists, syncs) / GuestSession
src/games/<game>/   logic.ts (pure, tested) + index.tsx (GameDef + Board component)
src/ui/             Home, Room, shared bits
src/i18n.ts         all UI text, ar + en
```

- **Host-authoritative.** The host (player 0) holds the only real state and applies both players'
  moves. The guest (player 1) sends moves and renders the view it receives.
- **Hidden information lives in `GameDef.view(state, me)`.** Never put the opponent's secrets in a view.
- **Sync sends only changed top-level view keys** (reference equality). Keep big static data (photo
  decks) under the same object reference between moves, or it is re-sent every move.
- **Views and state must be JSON-serialisable**; the host persists to localStorage after each change.
- **GameError messages are i18n keys** (`'err.*'`), translated on the receiving side.
- Seat lock: the host remembers the first guest's `clientId`; "Let a new device join" frees it.

## Adding a game

A game is one self-contained folder. **`src/games/dots/` is the reference: copy its shape.**

```
src/games/<id>/
  logic.ts       init / apply / (view): pure, no DOM. Illegal move → throw new GameError(key)
  logic.test.ts  vitest, next to the logic
  strings.ts     export const tg = defineStrings('<id>', en, ar): both languages, same keys
  style.css      classes prefixed "<id>-" (imported by index.tsx)
  art.tsx        the lobby card drawing: <ArtFrame> (src/ui/art.tsx), 120 × 64, theme colours via style
  index.tsx      GameDef + Board component
```

1. GameError keys: shared ones from `src/i18n.ts` (`err.over`, `err.notYourTurn`, `err.generic`, …)
   or the game's own as `'<id>.err.something'` (defined in strings.ts as `'err.something'`).
2. Name/blurb in `GameDef` are getters calling `tg(...)`, so they follow the language switch.
   `tags` (lobby categories: us / words / board / quick), `minutes` (typical round) and `Art` are
   required; the lobby (src/ui/Lobby.tsx) uses them for the filters, the duration chip and the card.
3. Shared UI in `src/ui/common.tsx`: `TurnBanner`, `ScoreBar`, `EndActions`. Shared texts via `t()`:
   `youWin`, `oppWins(n)`, `oppTurn(n)`, `draw`, `you`, `yes`, `no`, `cancel`.
4. Randomness (dice, shuffles) is fine inside `apply`/`init`: only the host runs them.
5. Register in `src/games/index.ts` (the only shared file a new game touches).

Guess Who and Connect Four predate this and keep their texts in `src/i18n.ts`.

## Conventions

- Arabic text must not assume gender: use noun phrases ("دور سامي", "الفوز من نصيب …") and "شخصك".
  Never glue a prefix like "لـ" onto a name (breaks on names starting with "ال").
- Use logical CSS properties (`inset-inline-end`, `margin-inline-start`, `text-align: start`) so RTL works.
- Boards whose geometry players talk about (Connect Four columns) are forced `dir="ltr"`.
  On an `<svg>` the `dir` attribute does nothing: use CSS `direction: ltr` or SVG `<text>` inherits RTL
  from the page and right-aligns (numbers get cut off at the left edge).
- Phone layout is the main target (375px wide). Inputs stay >= 16px on phones (iOS zoom).

## Gotchas

- On this Windows machine Vite's file watcher sometimes misses rapid consecutive edits and keeps
  serving a stale module. If the app behaves like old code, restart the dev server.
- Two tabs in the same browser share localStorage (name, clientId), so a second tab auto-joins with
  the host's name and same clientId. Real testing needs two browsers/devices or a manual override.
- PeerJS JSON serialisation caps messages at ~16 KB; the default binary serialisation chunks. Keep it.
- Optional TURN relay for strict networks: see `.env.example`.
