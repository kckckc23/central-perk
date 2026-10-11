# Central Perk — SpotSync

A fair meetup spot finder for groups of friends. Share an approximate
location, your food/category preferences, and a travel budget; the app
discovers nearby venues from **OpenStreetMap**, scores them by
*travel fairness* (45%), *preference match* (40%) and *data
completeness* (15%), and lets everyone vote and shortlist — the host
confirms the final spot.

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn-style components
- **Database:** Neon Serverless Postgres (add via the Vercel Marketplace)
- **Maps:** MapLibre GL + open tile styles (OpenFreeMap) — no Google Maps
- **Geocoding:** Photon (OpenStreetMap) — keyless
- **Venue data:** Overpass API (OpenStreetMap) — keyless; falls back to a deterministic demo dataset
- **Routing:** Haversine straight-line estimates (deterministic, offline); optional self-hosted Valhalla/OSRM

No API keys are required for the default open-data setup, and no
separate backend server is needed — the whole app is serverless.

---

## Quick start

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. Create the database

Deploy on Vercel and add the **Neon** integration
(Project → **Storage** tab → **Neon** → *Create Database*). Vercel
sets `DATABASE_URL` automatically; the schema migrates on every
server boot. To migrate manually:

```bash
npm run db:migrate
```

For local development, create a free Neon database at
`neon.tech`, paste its connection string into `.env` as
`DATABASE_URL`, then run `npm run db:migrate`.

### 3. Run

```bash
npm run dev        # http://localhost:3000
```

### 4. Build & verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

---

## Deployment on Vercel

1. Push the repo to GitHub.
2. In the Vercel dashboard: **Add New → Project → Import** the repo
   (framework preset: *Next.js*, Node.js 22).
3. **Storage tab → Neon → Create Database** — this creates the
   serverless Postgres instance and sets `DATABASE_URL`
   (pooled connection string) for you.
4. Set the remaining environment variables
   (Project → **Settings → Environment Variables**):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Auto-created by the Neon Marketplace integration (pooled URL) |
| `SESSION_SECRET` | ✅ (prod) | Random 32-byte hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_SITE_URL` | recommended | Base URL used in invite links |
| `PHOTON_BASE_URL` | optional | Default `https://photon.komoot.io` |
| `OVERPASS_BASE_URL` | optional | Default `https://overpass-api.de/api/interpreter`; empty = demo data |
| `NEXT_PUBLIC_MAP_STYLE_URL` | optional | Default: dark OpenFreeMap style |
| `ROUTING_PROVIDER` / `VALHALLA_BASE_URL` / `OSRM_BASE_URL` | optional | Self-hosted routing only |

⚠️ **Never** prefix `DATABASE_URL` or `SESSION_SECRET` with
`NEXT_PUBLIC_` — that would expose them to the browser. Database
access is server-side only; the browser receives session cookies and
approximate locations, never credentials or precise coordinates.

The schema is explicit and versioned in
[`lib/db/schema.ts`](lib/db/schema.ts); migrations apply
automatically at server boot (`instrumentation.ts`) or manually via
`npm run db:migrate`.

---

## How it works

### Room lifecycle

`POST /api/rooms` creates a room (14-day TTL) and a **host**
participant, then issues an httpOnly, sameSite=Lax session cookie
holding only a random token + participant id. Guests join with the
room token from the invite URL (`/room/[token]`). The host may leave
— the earliest remaining participant is promoted; when the last
participant leaves, the room is deleted.

### Privacy model

- Precise coordinates are stored **server-side only**
  (`private_locations` table) and never returned by any API.
- The UI works with approximate locations (e.g. "near my office"),
  chosen by the user at a fixed precision.
- `GET /api/rooms/[id]` returns `hasLocation`/`hasPreferences`
  flags and the caller's own location — never other people's.
- Travel time/distance estimates are computed server-side and are
  the only thing shared.

### Data layer

All database access lives in [`lib/db/`](lib/db):

- `lib/db/schema.ts` — explicit, versioned migrations
- `lib/db/client.ts` — Neon (postgres.js) client + migration runner
- `lib/db/repo.ts` — every query, parameterised, room-scoped

Key invariants enforced by database constraints:

- **One vote per participant** (`PRIMARY KEY (room_id, participant_id)`
  on `room_votes`) — concurrent clicks are safe, atomic upserts.
- **Unique display names per room** (`UNIQUE (room_id, display_name)`).
- **Idempotent shortlisting** (`PRIMARY KEY (room_id, venue_id)`).
- **Cascading deletes** keep rooms, participants, locations,
  preferences, votes and shortlist entries consistent.

### Venue discovery

1. Participants who have set **both** a location and preferences
   contribute to the search (fairness requires both).
2. A bounding box around the group's locations feeds an Overpass
   query for `amenity`/`shop`/`leisure` venues. If Overpass is
   unreachable, a **clearly-labelled deterministic demo dataset** is
   used so the UI can be evaluated offline.
3. Venues are scored by travel fairness (45%), preference match
   (40%) and data completeness (15%) — see
   [`lib/recommendations/scoring.ts`](lib/recommendations/scoring.ts).
   No invented ratings, prices or opening hours are fabricated.

### Realtime

The room view polls `GET /api/rooms/[id]` every 4 seconds
(configurable via `NEXT_PUBLIC_POLL_INTERVAL_MS`). This is the
brief's documented fallback when live subscriptions are not
available.

---

## Testing

Unit tests (scoring, validation, parsing) run with no external
services:

```bash
npm test
```

Integration tests (`tests/integration.test.ts`) exercise room
creation, joining, voting concurrency, privacy and isolation against
a real Postgres. Two ways to run them:

```bash
# Against a temporary embedded Postgres (no account needed):
npm run test:integration

# Against your own database — use a scratch database, not production:
DATABASE_URL="postgresql://…" npm test
```

---

## Configuration reference

See `.env.example`. Open-data endpoints are keyless; no API keys are
needed for the default stack.

## Limitations & roadmap

- Real travel times require a self-hosted routing engine
  (`ROUTING_PROVIDER=valhalla|osrm`); the default is Haversine.
- Polling, not WebSockets, refreshes the room view.
- Sessions are per-browser (cookie-based), no accounts.
- Rate limits are per-server-instance in-memory.

## Attribution

Uses © OpenStreetMap contributors (ODbL) data via Overpass and
Photon, and MapLibre GL. Map tiles come from OpenFreeMap
(© OpenStreetMap contributors, ODbL). Please attribute OpenStreetMap
in your deployment's UI if you ship this publicly.
