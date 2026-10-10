# SpotSync

**Find a place everyone can get to.**

SpotSync is a mobile-first web app where friends create a shared room, add their starting locations and hangout preferences, discover venues that work for the group, and shortlist/vote on a final meetup spot.

It is built entirely on open-source software and open geographic data — no Google Maps, Mapbox, paid place-search APIs, paid AI APIs, or mandatory sign-in providers.

## Features

- **Rooms with unguessable links** — create a room, share `/room/<random-id>`; friends join as guests with just a display name.
- **Private locations** — each participant's exact coordinates are stored in a protected record and never exposed to other participants; only travel estimates are shared.
- **Preferences** — place types, cuisines, budget (INR), max straight-line distance, travel mode, and nice-to-haves. Each field can be a hard constraint or a soft preference.
- **Honest discovery** — venues come from OpenStreetMap (Overpass), normalised and deduplicated. Missing data is shown as "Not available" / "Unknown" — no invented ratings, prices, or opening hours.
- **Deterministic ranking** — 45% travel fairness (average + worst case), 40% preference match, 15% data completeness. Fully unit-tested.
- **Shortlist & vote** — idempotent votes, host confirms the final venue, directions open in OpenStreetMap's routing UI.
- **Graceful degradation** — if the map-data endpoint is unreachable, a clearly labelled demo-data mode keeps the room and voting flow working.

## Prerequisites

- Node.js 20+ (developed on Node 22) and npm
- Docker (to run PocketBase locally)

## Quick start

```bash
git clone <repo-url>
cd central-perk

cp .env.example .env

# 1. Start PocketBase (SQLite-backed, persistent volume)
docker compose up -d

# 2. Create the first superuser
#    Open http://127.0.0.1:8090/_/ and create an account.
#    Put those credentials into .env:
#      POCKETBASE_SUPERUSER_EMAIL=...
#      POCKETBASE_SUPERUSER_PASSWORD=...

# 3. Install and run
npm install
npm run dev
```

Open http://localhost:3000. Collections are created/updated automatically on server start and on the first API request — no manual setup step.

> **Note:** rooms are only reachable by friends when the app runs on a server they can all access. Localhost development lets you test the full flow in two browser sessions (e.g. an incognito window), but friends in different homes need a deployed instance.

## Commands

| Task | Command |
|---|---|
| Development server | `npm run dev` |
| Production build | `npm run build` |
| Start production server | `npm start` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Tests (watch) | `npm run test:watch` |

## Environment variables

Copy `.env.example` to `.env`. All external endpoints are configurable so public community endpoints can be replaced with self-hosted instances.

| Variable | Purpose | Default |
|---|---|---|
| `POCKETBASE_URL` | Server-side PocketBase URL | `http://127.0.0.1:8090` |
| `POCKETBASE_SUPERUSER_EMAIL` | Superuser email (server-side only) | — |
| `POCKETBASE_SUPERUSER_PASSWORD` | Superuser password (server-side only) | — |
| `SESSION_SECRET` | Cookie signing secret for production | dev fallback (change in prod) |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre style URL | OpenFreeMap "liberty" style |
| `PHOTON_BASE_URL` | Photon-compatible geocoding endpoint | `https://photon.komoot.io/api/` |
| `OVERPASS_BASE_URL` | Overpass-compatible venue query endpoint | `https://overpass-api.de/api/interpreter` |
| `ROUTING_PROVIDER` | `haversine` (default), `valhalla`, or `osrm` | `haversine` |
| `VALHALLA_BASE_URL` | Self-hosted Valhalla endpoint (optional) | — |
| `OSRM_BASE_URL` | Self-hosted OSRM endpoint (optional) | — |
| `NEXT_PUBLIC_SITE_URL` | Public URL, used for invite links | `http://localhost:3000` |

Leave `PHOTON_BASE_URL` or `OVERPASS_BASE_URL` empty to disable manual place search / live venue discovery (the app then shows its clearly labelled demo venues).

## Local services

**PocketBase** runs via `docker compose up -d` with a persistent `./pb_data` volume. The app connects server-side only, using the superuser token; the browser never talks to PocketBase directly, and all collection API rules are empty (default deny). Authorisation is enforced in the Next.js API routes.

**Backup / restore** (SQLite inside PocketBase):

```bash
# stop the container, then copy the database
docker compose down
cp pb_data/data.db pb_data/data.db.bak
# restore
cp pb_data/data.db.bak pb_data/data.db
docker compose up -d
```

## Self-hosting the data layer

Public community endpoints are shared infrastructure with usage policies — for sustained use, self-host:

- **Overpass API** — for venue queries (regional extracts recommended)
- **Photon** — for geocoding
- **OpenFreeMap** — self-hosted tile styles, or any MapLibre-compatible style
- **Valhalla / OSRM** — optional road routing; when configured, distances become real route distances with estimated travel times. Without a router, all distances are labelled **straight-line** estimates.

## Data attribution

- **OpenStreetMap** contributors, © OpenStreetMap contributors, licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/). Attribution is shown on the map and in venue details.
- **Map tiles** — OpenFreeMap (openstreetmap data) unless you configure another MapLibre style.
- **Geocoding** — Photon (Komoot), built on OpenStreetMap.
- **Map rendering** — [MapLibre GL JS](https://maplibre.org/).

Open-source software and public data do **not** guarantee free unlimited hosting. Check each provider's usage policy before relying on public endpoints in production.

## Privacy model

- Exact coordinates live only in the `private_locations` collection, which is never readable through any client-facing payload.
- Other participants see only: display names, readiness flags, server-computed travel estimates, and your own location.
- Room links are invitations, not authentication: session tokens are 32-byte random values stored as SHA-256 hashes; participants can only modify their own records; only the host can confirm the final venue.
- Rooms expire after 30 days (enforced server-side), and leaving a room deletes your data.

## Limitations

- **No ratings/reviews** — OpenStreetMap has no trustworthy rating data, so none is shown. In-room votes are the group signal.
- **Prices** — OSM rarely tags prices; most venues show "Price unknown".
- **Opening hours** — shown as source-provided text; "open now" is not claimed.
- **Realtime** — the first iteration uses a documented 4-second polling fallback rather than PocketBase realtime subscriptions, to keep room-scoped authorisation airtight.
- **Rate limiting** is single-process/in-memory.
- **Demo venues** are deterministic fake data, used only when the Overpass endpoint is unreachable, and always labelled.

## Project structure

```text
app/                  Next.js App Router pages + API routes
components/           UI (ui kit, landing, room, map, location)
lib/
  config/             env + brand configuration
  db/                 PocketBase REST client + collection setup
  providers/          geocoding, places (Overpass), routing adapters
  recommendations/    haversine-based discovery + scoring engine
  venues/             OSM normalisation, category mapping, demo data
  auth/               guest session tokens + cookies
tests/                Vitest unit tests (scoring, haversine, parsing, …)
```

## License

MIT
