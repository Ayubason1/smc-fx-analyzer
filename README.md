# SMC FX Analyzer (PWA)

A personal-use Progressive Web App: upload a higher-timeframe (HTF) and lower-timeframe (LTF)
forex chart screenshot, and Claude analyzes them using Smart Money Concepts (SMC) — market
structure, BOS/CHoCH, order blocks, FVGs, liquidity — to give you a bias, trade idea, entry,
stop loss, and take profit.

It installs straight from the browser to your phone's home screen — no app store involved.

**This is a technical-analysis tool, not financial advice.** Forex trading carries substantial
risk. Always do your own confirmation before risking real money.

## How it works

- `server.js` — a small Express server. Serves the app and has one endpoint, `/api/analyze`,
  which forwards your two chart images to Claude's API with an SMC-specific prompt.
- `public/` — the installable PWA front end (plain HTML/CSS/JS, no build step).
- Your **Anthropic API key is entered in the app's Settings** and stored only in your
  phone's browser (localStorage). It's sent to your own server on each request and forwarded
  straight to Anthropic — your server never stores it.

## 1. Get an Anthropic API key

1. Go to https://console.anthropic.com and create an account if you don't have one.
2. Add billing (API usage is pay-as-you-go, separate from a claude.ai subscription).
3. Create an API key under **API Keys** — you'll paste this into the app later.

## 2. Run it locally first (recommended)

```bash
cd smc-trading-app
npm install
cp .env.example .env      # edit APP_USER / APP_PASSWORD if you want a login gate
npm start
```

Visit `http://localhost:3000`, tap the ⚙ icon, paste your API key, and try it with two
chart screenshots.

## 3. Deploy it live

You need real HTTPS hosting for two reasons: PWAs only install from secure origins, and your
phone needs to reach the server from anywhere, not just your home Wi-Fi. Pick one:

### Option A — Vercel (free, recommended if you don't want a server to babysit)

The `vercel/` folder is a self-contained, Vercel-ready copy of the app: the same static PWA
files plus `/api/analyze.js` rewritten as a serverless function instead of an Express route
(Vercel doesn't run a long-lived server — each request spins up its own function).

**One hard limit to know:** Vercel functions cap the request body at **4.5MB**, with no way to
raise it. The app already compresses each chart screenshot client-side (resized + re-encoded
as JPEG) before upload specifically so this never becomes a problem — you don't need to do
anything extra.

Deploy via the dashboard:

1. Push the whole project to a GitHub repo.
2. Go to https://vercel.com → **Add New → Project** → import the repo.
3. Under **Root Directory**, select `vercel` (not the repo root — that's the Express version).
4. Framework preset: **Other**. No build command needed.
5. Deploy. You'll get a URL like `https://smc-fx-analyzer.vercel.app`.

Or via the CLI:

```bash
cd smc-trading-app/vercel
npm install -g vercel   # if you don't have it
vercel                  # first deploy, follow the prompts
vercel --prod           # promote to your production URL
```

**On the password gate:** Vercel's built-in Deployment Protection (password-lock a whole
project) is a Pro-plan feature, not available on the free Hobby plan. That's a smaller problem
here than it sounds — visitors must paste in *their own* Anthropic key to get an analysis, so
an uninvited visitor can't run up charges on your account. Still, if you want the URL genuinely
private on the free plan, keep it unlisted, or upgrade to Pro for real password protection.

### Option B — Render.com (a persistent server, if you'd rather not think about function limits)

1. Push this folder to a GitHub repo (`git init && git add . && git commit -m "init"`, then
   create a repo on GitHub and push).
2. Go to https://render.com → **New +** → **Web Service** → connect your GitHub repo.
3. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
4. Under **Environment**, add `APP_USER` and `APP_PASSWORD` (strongly recommended — without
   this, anyone with your URL can use your server and paste in their own key).
5. Deploy. Render gives you a URL like `https://smc-fx-analyzer.onrender.com`.

### Option C — Railway.app

1. Push to GitHub as above.
2. https://railway.app → **New Project** → **Deploy from GitHub repo**.
3. Railway auto-detects Node; it runs `npm install` and `npm start` automatically.
4. Add `APP_USER` / `APP_PASSWORD` under **Variables**.
5. Under **Settings → Networking**, generate a public domain.

### Option D — Fly.io / a VPS

Any host that runs a long-lived Node process works the same way: `npm install`, set env
vars, `npm start`, expose port via HTTPS (Fly.io and most VPS panels handle TLS certs for you
automatically, e.g. via Let's Encrypt/Caddy).

> A pure static host with no functions at all (plain GitHub Pages, Netlify's free static-only
> tier) is **not** enough on its own, since something still needs to run `/api/analyze`
> server-side to keep your API key handling sane. Vercel and Render/Railway both solve this,
> just with a different execution model (functions vs. a persistent process) — pick whichever
> `server.js` (Express) or `vercel/` (serverless) folder matches.

## 4. Install it on your phone (not the App/Play Store)

Once your URL is live over HTTPS:

- **Android (Chrome):** open the URL → tap the ⋮ menu → **Add to Home screen** / **Install app**.
- **iPhone (Safari):** open the URL → tap the Share icon → **Add to Home Screen**.

The icon then behaves like a native app (its own icon, launches full-screen, works offline for
the app shell) — it's just never listed in any store.

## 5. Using it

1. Open the app, tap the HTF card and upload/screenshot your higher-timeframe chart (e.g. 4H
   or Daily) — this sets market bias.
2. Tap the LTF card and upload your lower-timeframe chart (e.g. 5M or 15M) — this is where the
   entry trigger is found.
3. Optionally fill in the pair and any extra context.
4. Tap **Analyze setup**. You'll get HTF bias, the LTF setup found, and if there's a clean
   confluence: entry zone, stop loss, TP1/TP2, R:R, and an invalidation level. If the setup
   isn't clean, it will tell you `NO_TRADE` rather than force an idea.

## Notes & limitations

- Analysis quality depends entirely on chart legibility — make sure price axes and enough
  swing history are visible in your screenshots.
- The model reasons about what it can see in the image; it does not have live market data feeds.
- Treat this as a second pair of eyes for structure/liquidity reading, not a signal service —
  always sanity-check levels on your own platform before trading.
- If you skip setting `APP_USER`/`APP_PASSWORD`, your deployed URL is open to anyone who finds
  it, and they could run up charges against whatever API key they paste in (their own key, not
  yours — your server never stores your key) — but it's still worth locking down.
