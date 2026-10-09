# paramaterial lab

A browser lab for one research move: take a family of series, reduce each one
to a few scalar parameters, and scatter those parameters against each other or
against the conditions the series were recorded under. It grew out of
[paramaterial](https://github.com/dan-slater/paramaterial), a Python package for
mechanical test data written for an MSc at the University of Cape Town, where
the series is a stress–strain curve and the scatter is yield stress against
temperature. The lab runs the same pipeline on three more domains to show that
the workflow, not the metallurgy, is the reusable part.

You build a report out of blocks (dataset, curve overlay, parameters table,
parameter scatter, model fits, notes). Every analyzer runs in your browser.

## The four presets

Each has a shareable URL that opens it with its report template.

| URL | Data | The plot to look at |
|---|---|---|
| `/lab/materials` | 154 uniaxial tension tests, 9 aluminium alloy lots, 20–300 °C (the thesis data) | 0.2 % proof stress vs temperature |
| `/lab/finance` | 40 US large caps, 8 sectors, 504 trading days of adjusted closes (Yahoo Finance snapshot, Apr 2024 – Apr 2026) | max drawdown vs annualized volatility (r = +0.79) |
| `/lab/climate` | 30 NOAA GHCN-Daily stations, 3 years of daily mean temperature (Aug 2022 – Aug 2025) | annual mean vs latitude (r = −0.86 against \|latitude\|) |
| `/lab/battery` | 124 LFP cells from Severson et al. 2019, early-life capacity (cycles 2–100) plus true cycle life | cycle life vs charge C-rate (r = −0.03: it doesn't predict it; batch does) |

The four thesis case studies are at `/lab/cs1` … `/lab/cs4`. `/docs` has the
full write-up: a methodology chapter naming every analyzer function, one
chapter per domain, reproducibility notes and a glossary. Every number the
chapters quote is computed by `scripts/chapter-numbers.mjs` from the shipped
data rather than typed in by hand.

## Bring your own CSV

The dataset picker takes one or more CSV files. They are parsed in the browser
(`src/lib/csvImport.ts`) into the same shape the presets use, and nothing is
uploaded. Two layouts work:

- **One series per file:** an x column and a y column, e.g. `strain,stress_MPa`.
  The file name becomes the series id; drop several files for several series.
- **Long format:** an id column plus x and y, e.g. `station,day,tavg_C,latitude`.
  Each distinct id becomes a series.

Any other column with one value per series (temperature, lot, sector, latitude)
becomes metadata you can colour by or scatter against. Comma, semicolon and tab
separators are detected; date x columns become days since the first date; with
no x column the row number is used. You pick which analyzer set applies
(materials, finance, climate or battery). Two real-data samples live in
`static/samples/` and are one click away on the import panel.

## The Claude assistant (bring your own key)

The chat pane can drive the report ("plot stress vs strain", "scatter UTS
against temperature"). It calls the Anthropic Messages API **directly from the
visitor's browser** with the key they paste into the settings cog. The key is
kept only in that browser's localStorage (`paramaterial:apikey:v1`); it never
reaches this server. There is no server-side key, and none should ever be added.
Without a key the pane falls back to a small rule-based assistant. The model is
`CLAUDE_MODEL` in `src/lib/claude.ts` (currently `claude-sonnet-5-5`).

## Accounts and saved projects

Accounts are optional and only gate saved projects (SQLite on the server). The
presets, CSV import and chat all work anonymously. Passwords are hashed with
Argon2id; sign-up and sign-in are rate-limited per IP in process; there is no
email of any kind (so no password reset). Registration can be closed with
`ALLOW_SIGNUP=false`.

## Running it

Requires Node ≥ 20.19 (≥ 23 for the two scripts that import the TypeScript
analyzers directly: `test-csv-import.mjs` and `chapter-numbers.mjs`).

```bash
npm ci
npm run dev                      # http://localhost:5173
```

The preset data (`static/data/*.json`, ~10 MB) is gitignored. Rebuild it with
the scripts described in the Reproducibility chapter
(`node scripts/build-{finance,climate,battery}.mjs`, and
`scripts/build_data.py` for the materials sets), or copy it from an existing
checkout.

### Production build

There is one build: SvelteKit with `@sveltejs/adapter-node`.

```bash
npm run build
cp .env.example .env             # then edit
node build                       # or: npm start
```

The preset JSON is copied into `build/client/data/` and served as static files;
it never touches the database.

| Variable | Default | Purpose |
|---|---|---|
| `ORIGIN` | (none) | Public URL, e.g. `https://paramaterial.danielslater.dev`. Required in production for CSRF checks and `Secure` cookies. |
| `HOST` | `0.0.0.0` (adapter-node); set `127.0.0.1` | Bind address. Keep it on loopback behind a proxy or tunnel. |
| `PORT` | `3000` (adapter-node); set `3080` | Listen port. `.env.example` and the systemd unit use 3080. |
| `DATA_DIR` | `./data` | Directory for `paramaterial.db` (created if missing). |
| `BODY_SIZE_LIMIT` | `512K` (adapter-node); set `30M` | Largest request body. CSVs are parsed client-side; this bounds saved reports. |
| `ADDRESS_HEADER` | (none); set `CF-Connecting-IP` behind Cloudflare | Where the real client IP comes from, for the rate limits. |
| `ALLOW_SIGNUP` | `true` | `false` closes registration; existing users can still sign in. |

`.env.example` documents each one and holds no secrets; the app needs none.
Deployment as a systemd user service behind Cloudflare is written up step by
step in [`deploy/README.md`](deploy/README.md), with the unit file next to it.

## Checks

```bash
npm run check                    # svelte-check: 0 errors expected
npm run test:csv                 # CSV parser against the samples and edge cases
npm run numbers                  # recompute every number the docs quote
```

Browser smokes use headless Playwright (`npx playwright install
chromium-headless-shell` once) against a running server given by `BASE_URL`:

```bash
BASE_URL=http://127.0.0.1:5173 node scripts/smoke-lab.mjs        # preset routes + CSV import
BASE_URL=http://127.0.0.1:5173 node scripts/smoke.mjs            # also smoke-templates, -persistence,
                                                                 # -toolbar, -visual, -chat-api
BASE_URL=http://127.0.0.1:5173 node scripts/visual-matrix.mjs    # every surface x 4 viewports
```

Two smokes start their own `node build` (run `npm run build` first; port from
`SMOKE_PORT`, default 3081):

```bash
node scripts/smoke-hosted.mjs    # anonymous use, static data, error page, auth hardening, ALLOW_SIGNUP
node scripts/smoke-backend.mjs   # accounts, projects, reports, members API
```

Screenshots go to `SMOKE_OUT` (set it; the default is a `tmp/` folder outside `web/`).

## Layout

```
src/lib/analyzers/       finance, climate, battery analyzers + the registry the UI reads
src/lib/processing.ts    materials analyzers (UTS, E, proof stress, Ramberg–Osgood, Zener–Hollomon)
src/lib/csvImport.ts     in-browser CSV → Dataset
src/lib/claude.ts        browser-side Claude client (BYO key)
src/lib/server/          SQLite, auth, rate limits, config (the only server-side code)
src/lib/docs/            the /docs chapters and the supervisor reviews
src/routes/lab/[preset]  shareable preset routes
src/routes/api/          auth, projects, reports
scripts/                 data builders, chapter-numbers bench, smokes
deploy/                  systemd unit + deployment runbook
```

## Licence

Source-available, all rights reserved: see [`LICENSE`](LICENSE). The source is
published for reference and evaluation; no licence is granted to copy, modify,
distribute or host it. The paramaterial Python package is separately licensed
under MIT.
