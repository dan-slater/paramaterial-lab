# Deploying the lab to the server

Target: `https://paramaterial.danielslater.dev` → Cloudflare → the server (Ubuntu,
SERVER_IP) → `node build` on `127.0.0.1:3080`, run by a systemd **user** unit.

The build is made on the Mac, because the preset data (`web/static/data/*.json`,
about 10 MB) is gitignored and only exists there. `npm run build` copies it into
`build/client/data/`, so the server only ever needs `build/`, the two package
files and its own `node_modules`.

Paths below assume the deploy directory `~/apps/paramaterial-lab` on the server,
which is what `paramaterial-lab.service` expects. Change both together if you
pick another.

## 0. One-time prerequisites on the server

```bash
node -v        # need >= 20.19 or >= 22.12; Node 22 or 24 LTS recommended
command -v node   # if not /usr/bin/node, edit ExecStart in the unit (step 4)
ss -ltnp | grep ':3080' || echo "3080 free"   # pick another PORT if taken
sudo loginctl enable-linger "$USER"   # user units keep running after logout
# Only needed if better-sqlite3 has no prebuilt binary for this Node (step 3 says so):
sudo apt-get install -y build-essential python3
```

## 1. Build on the Mac

```bash
cd web      # or wherever the merged branch lives
ls static/data/*.json | wc -l                  # expect 8 (basic-usage, cs1-4, finance, climate, battery)
npm ci
npm run build
ls build/client/data/*.json | wc -l            # expect 8: the presets are inside the build
ls build/client/samples/                       # climate-long.csv, tension-single.csv
```

Optional local check before shipping (uses port 3081, stops itself):

```bash
node scripts/smoke-hosted.mjs
```

## 2. Ship to the server

```bash
DEST=the server:apps/paramaterial-lab
ssh the server 'mkdir -p ~/apps/paramaterial-lab/deploy'
ssh the server 'cd ~/apps/paramaterial-lab && [ -d build ] && rm -rf build.prev && cp -a build build.prev || true'
rsync -az --delete build/ "$DEST/build/"
rsync -az package.json package-lock.json .env.example LICENSE "$DEST/"
rsync -az deploy/ "$DEST/deploy/"
```

`--delete` is only ever used on `build/`. Never rsync `--delete` into the deploy
directory itself: it holds `.env` and `data/` (the SQLite file with accounts and
saved projects).

## 3. Install runtime dependencies on the server

```bash
cd ~/apps/paramaterial-lab
npm ci --omit=dev
```

That installs the four runtime dependencies: `marked`, `uplot`, `better-sqlite3`
and `@node-rs/argon2`. The two native ones:

- **`@node-rs/argon2`** ships prebuilt per platform as an optional dependency;
  the lockfile already lists `@node-rs/argon2-linux-x64-gnu`, so nothing compiles.
- **`better-sqlite3`** downloads a prebuilt binary for the server's exact Node
  ABI, and falls back to compiling with node-gyp (needs `build-essential` and
  `python3`). The binary is tied to the Node major version: **after any Node
  upgrade on the box run `npm rebuild better-sqlite3`**, or the service fails
  with `NODE_MODULE_VERSION … requires NODE_MODULE_VERSION …` the first time it
  touches the database. (The Mac hit exactly this on 2026-10-09: modules built
  for Node 24 under Node 26.)

Sanity-check both before going further:

```bash
node -e "const D=require('better-sqlite3'); console.log('sqlite', new D(':memory:').prepare('select sqlite_version() v').get().v)"
node -e "require('@node-rs/argon2').hash('x').then(h => console.log('argon2', h.slice(0, 9)))"
```

First deploy only, create the environment file and data directory:

```bash
cp .env.example .env
$EDITOR .env      # ORIGIN, HOST, PORT, DATA_DIR, BODY_SIZE_LIMIT, ADDRESS_HEADER, ALLOW_SIGNUP
mkdir -p data
chmod 600 .env
```

`.env` holds no secrets (the app needs none), but keep it out of git and out of
`build/`. Never put an Anthropic key in it: the chat is bring-your-own-key in
the visitor's browser.

## 4. Install and start the unit (first deploy)

```bash
mkdir -p ~/.config/systemd/user
cp deploy/paramaterial-lab.service ~/.config/systemd/user/
# edit ExecStart if `command -v node` is not /usr/bin/node
systemctl --user daemon-reload
systemctl --user enable --now paramaterial-lab
systemctl --user status paramaterial-lab --no-pager
journalctl --user -u paramaterial-lab -n 50 --no-pager   # expect "Listening on http://127.0.0.1:3080"
```

## 5. Verify on the box

```bash
B=http://127.0.0.1:3080
curl -s -o /dev/null -w '/              %{http_code}\n' $B/
for p in materials finance climate battery; do curl -s -o /dev/null -w "/lab/$p  %{http_code}\n" $B/lab/$p; done
curl -s -o /dev/null -w '/lab/nope      %{http_code} (want 404)\n' $B/lab/nope
curl -s $B/data/climate.json | head -c 60; echo
curl -s -o /dev/null -w '/samples       %{http_code}\n' $B/samples/climate-long.csv
curl -s -o /dev/null -w '/api/auth/me   %{http_code} (want 401)\n' $B/api/auth/me
curl -s $B/robots.txt
```

The SQLite file appears in `data/` the first time something touches the
database (a sign-up, or any request carrying a session cookie), not at boot.

## 6. Cloudflare

Point `paramaterial.danielslater.dev` at `http://127.0.0.1:3080` on the server.
With a `cloudflared` tunnel already on the box, that is one ingress rule:

```yaml
- hostname: paramaterial.danielslater.dev
  service: http://127.0.0.1:3080
```

plus the tunnel's DNS route for the hostname. Then:

- `ORIGIN` in `.env` must be exactly `https://paramaterial.danielslater.dev`.
  Without it, session cookies are not marked `Secure` and form CSRF checks
  compare against the wrong origin.
- `ADDRESS_HEADER=CF-Connecting-IP` makes the per-IP sign-up and sign-in limits
  see visitors rather than the tunnel. It is only trustworthy while Cloudflare
  is the sole way in, so keep `HOST=127.0.0.1` and port 3080 closed to the
  internet.
- Static assets (`/_app/immutable/*`, `/data/*.json`, `/samples/*`) are served
  by Node from `build/client` with long-lived cache headers on the immutable
  ones; Cloudflare caching in front is optional.

From outside:

```bash
curl -sI https://paramaterial.danielslater.dev/lab/materials | head -1
```

## Redeploying

Steps 1 and 2 on the Mac, then on the box:

```bash
cd ~/apps/paramaterial-lab
cmp -s package-lock.json package-lock.json.deployed || npm ci --omit=dev
cp package-lock.json package-lock.json.deployed
systemctl --user restart paramaterial-lab
```

(`npm ci` again only when the lockfile changed.) Then rerun the step 5 checks.

**Rollback:** step 2 keeps the previous build in `build.prev`.

```bash
cd ~/apps/paramaterial-lab && rm -rf build && mv build.prev build && systemctl --user restart paramaterial-lab
```

## Operations

- **Logs:** `journalctl --user -u paramaterial-lab -f`
- **Close sign-ups:** set `ALLOW_SIGNUP=false` in `.env`, then
  `systemctl --user restart paramaterial-lab`. Existing accounts still sign in;
  anonymous use is unaffected.
- **Rate limits** (in-process, reset on restart): sign-in 10 attempts per 15
  minutes per IP, sign-up 5 per hour per IP. Change them in
  `src/lib/server/rateLimit.ts`.
- **Backups:** everything stateful is `data/paramaterial.db` (plus `-wal` and
  `-shm` while running). Online copy with the sqlite3 CLI:
  `sqlite3 data/paramaterial.db ".backup data/backup-$(date +%F).db"`, or stop
  the unit and copy the three files.
- **No email.** The app sends no mail; there is no password reset. A forgotten
  password is fixed by hand in the database.
