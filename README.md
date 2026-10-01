# OurTable · طاولتنا

Board games for two people, wherever they are. One of you opens a room and sends a link; the other
taps it and you're playing. Moves and photos go **directly between your two browsers**, encrypted.
No accounts, no game server, nothing stored online.

Games: **Guess Who** (classic faces or your own photos) and **Connect Four**. Chess and Battleship next.

Arabic by default (right-to-left), English one tap away. Built for phones first.

## Run locally

On Windows, double-click **`run.bat`**: it installs on first use, starts the server and opens the
browser. Close its window to stop. Or from a terminal:

```bash
npm install
npm run dev
```

Open http://localhost:5173. To try it with two players on one computer, use two different browsers
(e.g. Chrome and Edge). Two tabs of the same browser share storage and act like the same device.

## Put it online (free)

**GitHub Pages (set up):** every push to `main` runs `.github/workflows/deploy.yml`, which tests,
builds and publishes the site to `https://<your-user>.github.io/<repo>/`. One-time setup in the repo:
Settings → Pages → Source: **GitHub Actions**.

It's a plain static site, so any other host works too: `npm run build` and upload `dist/`
(paths are relative, sub-folders work).

It must be served over **https** (all of these do) for copy-link, share and WebRTC to work on phones.
On the phone, "Add to Home Screen" makes it open like an app.

## If you can't connect

Most home and mobile networks connect directly. A few strict ones (some corporate or mobile
carriers) need a relay. Get free TURN credentials (e.g. Metered Open Relay or Cloudflare Calls), copy
`.env.example` to `.env`, fill it in and rebuild.

## Tests

```bash
npm test
```
