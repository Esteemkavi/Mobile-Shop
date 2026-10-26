# NextGen Mobiles

Mobile app, website, and optional self-hosted PostgreSQL API/admin panel.

## Architecture

- `mobile-app/` contains the Expo app and website.
- `backend/` contains the API, admin panel, PostgreSQL schema, and local image storage.
- The API uses the existing PostgreSQL database `nextgen_mobiles` and creates an isolated `nextgen_app` schema. It does not drop, truncate, or reset the database.
- The app and website use the PostgreSQL API for catalog, guest profiles, likes, and uploaded images.
- The API binds to `127.0.0.1` by default. No public exposure, DNS, firewall change, or router port-forward is configured.

## Local development

1. Install Node.js 20 or newer and PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env`, then fill in the credentials for the already-existing `nextgen_mobiles` database.
3. In `backend/`, run `npm install`, then `npm run db:check`.
4. Run `npm run db:migrate`. This creates only the `nextgen_app` schema/tables and inserts default categories if missing. Existing data stays untouched.
5. In `backend/`, run `npm run admin:hash` in an interactive terminal, then put the printed `ADMIN_PASSWORD_HASH` in the ignored `backend/.env`. Choose a unique admin password of at least 14 characters. Set `ADMIN_USERNAME` too.
6. Run `npm start` in `backend/`. It listens on loopback port 3001 by default. Open `http://127.0.0.1:3001/admin`.
7. For the Expo app, copy `mobile-app/.env.example` to `mobile-app/.env` and set `EXPO_PUBLIC_API_URL` to an API address reachable by that device. Run Expo from `mobile-app/`.
8. Build the website with `npm run build:web` from `mobile-app/`. The backend serves `mobile-app/dist` when present.

When Expo web dev server and API use different origins, add the exact Expo origin (for example `http://192.168.1.25:8082`) to `CORS_ORIGINS` in `backend/.env`. In Expo web development on ports 8081/8082, the app defaults to the same host on port 3001. The production website is served by this API origin and needs no separate CORS entry.

Ignored `.env` files are local-only. Never commit them or paste their contents into logs/chat.

## Admin panel

- Open `/admin` and sign in with `ADMIN_USERNAME` and the password used to generate `ADMIN_PASSWORD_HASH`.
- Add/edit products, categories, category order/visibility, product prices/descriptions, New Arrivals visibility, and product images.
- Image uploads accept JPG, PNG, or WebP files up to 10 MB and use generated names under `DATA_DIR/uploads`.
- Product deletion requires explicit browser confirmation. A category cannot be removed while products reference it.
- Admin login is rate-limited; session tokens are random and stored hashed in PostgreSQL; cookies are HttpOnly/SameSite strict; admin mutations require a CSRF token. Admin sign-in fails closed when no password hash is set.

## Debian deployment preparation

1. Back up the existing PostgreSQL database before applying the additive schema, for example `pg_dump -Fc -d nextgen_mobiles -f nextgen_mobiles-before-nextgen-app.dump`. Do not run `dropdb`, `DROP SCHEMA`, `TRUNCATE`, or reset commands.
2. Pull the desired GitHub branch and install backend dependencies. Keep `.env` outside Git; use `/etc/nextgen-mobile-shop/backend.env` with mode `0600` for production credentials.
3. Use the existing `nextgen_mobiles` database and a PostgreSQL account allowed to create/use the `nextgen_app` schema. Run `npm run db:check` then `npm run db:migrate` from `backend/`.
4. Create `/var/lib/nextgen-mobiles/uploads` owned by the service account. Build the website with `npm ci && npm run build:web` in `mobile-app/`.
5. Copy `deploy/nextgen-api.service` to `/etc/systemd/system/`, adjusting the Node binary path if needed. Create a dedicated `nextgen` OS account; it should only write to `/var/lib/nextgen-mobiles`.
6. Start with `HOST=127.0.0.1`, `PORT=3001`, `COOKIE_SECURE=false`, and `TRUST_PROXY=false` for local HTTP access. Behind a deliberately configured HTTPS reverse proxy, set `COOKIE_SECURE=true` and `TRUST_PROXY=true`.
7. `deploy/nginx-localhost.conf` binds only to loopback. It does not expose the app to the LAN or internet. Do not change bind address, enable Nginx, open ports, configure router forwarding, DNS, or public TLS until you explicitly choose the access scope. A phone on Wi-Fi cannot reach a loopback-only API. If you later choose private Wi-Fi use, set `HOST=0.0.0.0` only with a firewall rule limited to that LAN; this is not enabled by default. Internet/public access requires a separate explicit decision.

### GitHub push/pull commands

From the project root on the development Mac, review `git status` and make sure no `.env` file or key is staged, then:

```bash
git add README.md .gitignore backend mobile-app/App.js mobile-app/lib mobile-app/package.json mobile-app/package-lock.json mobile-app/.env.example deploy
git commit -m "Migrate app to PostgreSQL API"
git push origin mobile-app-expo
```

On Debian, pull into the existing checkout (or clone this branch once):

```bash
git clone --branch mobile-app-expo https://github.com/Esteemkavi/Mobile-Shop.git /opt/nextgen-mobile-shop
cd /opt/nextgen-mobile-shop
git pull --ff-only origin mobile-app-expo
```

Keep production `.env` files and uploaded images outside the checkout; never `git add -f` them.

## Checks

From `backend/`: `npm test`, `npm run db:check`, `npm run db:migrate`, `npm start`.

From `mobile-app/`: `npm run build:web`.

`db:check` and `db:migrate` must only run against the intended Linux PostgreSQL database. This repository environment does not connect to that database.
