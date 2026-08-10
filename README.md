# Job Application Tracking System (JATS)

A production-ready platform for tracking manual job applications submitted by users on external
job boards (LinkedIn, Indeed, company career sites, etc.), captured via a lightweight Chrome
Extension and surfaced through a web dashboard for applicants and a manager analytics dashboard.

This system does **not** search for jobs, auto-apply, or generate resumes. It only records and
tracks application activity that a human already performed manually.

See [`docs/system-design.md`](docs/system-design.md) for the full architecture, module
responsibilities, database schema, and API contract.

## Project Structure

```
.
├── backend/            FastAPI modular monolith (REST API)
├── frontend/           React + TypeScript user & manager dashboard
├── chrome-extension/   Manifest V3 extension that captures application events
├── docs/               Architecture & design documentation
└── docker-compose.yml  Local orchestration (Postgres, Redis, MinIO, backend, frontend)
```

## Tech Stack

| Layer            | Technology                                              |
|------------------|----------------------------------------------------------|
| Frontend         | React, TypeScript, React Router, Axios, React Query, Tailwind CSS |
| Backend          | Python 3.12+, FastAPI, SQLAlchemy 2.0, PyJWT, bcrypt      |
| Database         | PostgreSQL, Alembic migrations                            |
| Cache            | Redis (provisioned, future-ready)                        |
| File Storage     | S3-compatible object storage (MinIO locally / Cloudflare R2 in production) |
| Chrome Extension | Manifest V3, TypeScript, Vite                             |
| Local deployment | Docker, Docker Compose                                    |
| Production deployment | Vercel (frontend) + Render (backend) + Neon (Postgres) + Cloudflare R2 (storage) |

## Getting Started (local development)

### Prerequisites
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose (optional — the backend can also run natively against a local Postgres)

### 1. Start infrastructure (Postgres, Redis, MinIO)

```bash
docker compose up -d postgres redis minio
```

If Docker Desktop won't start (see the VPN troubleshooting section below), run Postgres/MinIO
natively instead: install Postgres directly, and for MinIO see
[`scripts/start-minio-native.ps1`](scripts/start-minio-native.ps1), which runs the same MinIO
version as a plain Windows executable with matching credentials - no Docker required.

### 2. Run the backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows (use `source .venv/bin/activate` on macOS/Linux)
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

The API will be available at `http://localhost:8080`. Interactive API docs (Swagger UI) at
`http://localhost:8080/docs`.

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be available at `http://127.0.0.1:5173`. Use `127.0.0.1` rather than
`localhost` — on machines running a VPN that disables IPv6 (e.g. Astrill), `localhost` can
resolve to the IPv6 loopback (`::1`) and become unreachable while the VPN is connected. The
dev server is configured (`frontend/vite.config.ts`) to always bind to the IPv4 loopback address
to avoid this.

### 4. Load the Chrome Extension

```bash
cd chrome-extension
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `chrome-extension/dist`.

Alternatively, end users can grab it from the web app itself (**Get the extension** in the navbar,
or `/extension`) as a downloadable zip instead of building it themselves — that page has the same
"Load unpacked" steps written out for a non-technical audience. That zip is a build artifact, not
committed (see `.gitignore`); regenerate it after any chrome-extension change with:

```bash
powershell -File scripts/package-extension.ps1 -ApiBaseUrl http://<this-machine-LAN-IP>:8080/api
```

The backend URL is baked into the build, not user-editable — end users installing a published
extension shouldn't need to know or configure a backend endpoint. This is also why `-ApiBaseUrl`
matters for the packaging script above: whoever downloads that zip is very likely on a *different*
computer than the one that built it, so pointing it at `localhost` (the script's default, meant for
building-and-loading-unpacked on the same machine only) would bake in "myself" from the builder's
point of view and produce a "Could not reach the server" / fetch-failed error for everyone else —
pass the actual LAN IP (from `ipconfig`, the adapter you connect through) so it also works for
other devices on the network. For a one-off local dev build, or a real non-LAN deployment, set
`VITE_API_BASE_URL` directly instead:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com/api npm run build
```

### Full stack via Docker Compose

```bash
docker compose up --build
```

## LAN access (letting another PC on the same network reach this one)

By default, everything above binds to loopback only and rejects any other origin - safe for local
dev, but it means a browser on a different machine gets "page not loading" (can't even reach the
dev server) or, if it somehow does, CORS errors on every API call. To allow that:

1. **Backend**: start uvicorn with `--host 0.0.0.0` (default is `127.0.0.1`, loopback-only):
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8080
   ```
   `backend/app/core/config.py`'s `cors_allowed_origin_regex` already allows any private-network
   origin (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`) on ports 5173/5174, so no config change is
   needed there.

2. **Frontend**: already binds to `0.0.0.0` (`frontend/vite.config.ts`), so no change needed - `npm
   run dev` alone is enough. Its printed "Network:" URLs are what to open from the other PC.

3. **API base URL**: the frontend defaults to whatever hostname it was itself loaded from (same
   scheme, port 8080) rather than a hardcoded `localhost` - so opening the frontend's LAN URL from
   another PC automatically points its API calls back at *that* host, not the visiting PC's own
   loopback. Only set `VITE_API_BASE_URL` explicitly if the backend needs to be reached at a
   different host/port than the frontend was loaded from.

4. **Windows Firewall**: if the other PC still can't connect, check the Windows Firewall profile
   for whichever network category your adapter is on (`Get-NetConnectionProfile`,
   `Get-NetFirewallProfile`) - if it's enabled, allow inbound TCP 5173 and 8080, e.g.:
   ```powershell
   New-NetFirewallRule -DisplayName "JATS dev (5173, 8080)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173,8080
   ```

Find this machine's LAN IP with `ipconfig` (Windows) - look for the adapter you're actually
connected through (Wi-Fi/Ethernet), not a VPN or virtual adapter.

## Production deployment

```
Global User → Vercel (frontend, static React build)
            → Render (backend, FastAPI + uvicorn)
                → Neon (PostgreSQL)
                → Cloudflare R2 (resume/screenshot storage, S3-compatible)
```

None of this changes local development above - `docker compose up --build` and the native/hybrid
flows keep using local Postgres and MinIO exactly as before. Production just points the same
code at managed equivalents via environment variables. Push this repo to GitHub first (all
platforms below deploy by connecting a GitHub repo):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 1. Neon (PostgreSQL)

1. Create a project at [neon.tech](https://neon.tech) (any region).
2. On the project's **Dashboard → Connection string**, copy the **pooled** connection string
   (looks like `postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require`).
   Use the pooled one, not the direct one - Render's backend opens a connection per request-ish
   pattern via SQLAlchemy's default pool, and Neon's pooler (PgBouncer) handles many short-lived
   connections far better than the direct endpoint under real traffic.
3. This becomes `DATABASE_URL` on Render (below). Nothing else to configure - `sslmode=require` is
   already part of the string, and `backend/app/core/config.py`'s `sqlalchemy_database_url`
   normalizes Neon's `postgresql://` scheme to the `postgresql+psycopg://` driver this project
   already uses, so the same `psycopg[binary]` driver from `requirements.txt` handles it unchanged.
4. Migrations: nothing to run manually. Render's start command (below) runs `alembic upgrade head`
   on every deploy, the same additive/idempotent migration chain already in `backend/alembic/versions/`
   - it never drops or recreates tables, just applies whatever's new.

### 2. Cloudflare R2 (object storage)

1. Cloudflare dashboard → **R2 → Create bucket** (any name, e.g. `jats-storage`). Note the **Account ID**
   shown on the R2 overview page - the S3 API endpoint is `https://<account_id>.r2.cloudflarestorage.com`.
2. **R2 → Manage API Tokens → Create API Token**, permission "Object Read & Write", scoped to that
   bucket. This gives you an **Access Key ID** and **Secret Access Key**.
3. Enable public read access so uploaded files are viewable the same way they are locally with
   MinIO: bucket **Settings → Public Access → Allow Access** (enables the `pub-<hash>.r2.dev` URL),
   or connect a custom domain there instead. Either way, note the resulting public base URL.
4. **CORS**: the web app uploads resumes *directly* from the browser to R2 via a presigned URL (the
   backend never sees the file bytes) - the bucket needs a CORS policy allowing that. Bucket →
   **Settings → CORS Policy**:
   ```json
   [
     {
       "AllowedOrigins": ["https://your-app.vercel.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   Add your custom domain too if you set one up on Vercel. Update this after every new Vercel
   domain/preview URL you want uploads to work from.

### 3. Render (backend)

Easiest via the included [`render.yaml`](render.yaml) Blueprint: Render dashboard → **New → Blueprint**
→ select this GitHub repo → it reads `render.yaml` and creates the service below, prompting for the
`sync: false` variables. Or configure a plain Web Service manually with the same settings:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Python 3 |
| Build command | `pip install -r requirements.txt` |
| Start command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/actuator/health` |

Required environment variables (Render's dashboard → your service → **Environment**):

| Variable | Value |
|---|---|
| `PYTHON_VERSION` | `3.12.13` |
| `DATABASE_URL` | Neon pooled connection string from step 1 |
| `JWT_SECRET` | a long random string (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) - **not** the local dev default |
| `MANAGER_DEFAULT_EMAIL` / `MANAGER_DEFAULT_PASSWORD` | the manager account to seed in production |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` (comma-separate a custom domain too, no trailing slashes) |
| `S3_ENDPOINT` / `S3_PUBLIC_ENDPOINT` | both `https://<account_id>.r2.cloudflarestorage.com` from step 2 |
| `S3_PUBLIC_URL` | the R2 public bucket URL from step 2, e.g. `https://pub-xxxxxxxx.r2.dev` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | the R2 API token's key/secret from step 2 |
| `S3_BUCKET` | your R2 bucket name |
| `S3_REGION` | `auto` |

Note Render's assigned URL (`https://jats-backend.onrender.com` or similar) - it's `VITE_API_BASE_URL`
below, with `/api` appended.

### 4. Vercel (frontend)

Vercel dashboard → **Add New → Project** → import this GitHub repo:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` (default) |
| Output directory | `dist` (default) |
| Environment variable | `VITE_API_BASE_URL` = `https://<your-render-service>.onrender.com/api` |

[`frontend/vercel.json`](frontend/vercel.json) rewrites every path to `index.html` - required
because this is a client-side-routed SPA (React Router); without it, refreshing or directly
opening a nested URL like `/applications` 404s (Vercel resolves paths as real files by default and
has no way to know this project isn't one of the frameworks with server-side/file-based routing).

After the first deploy, go back to Render's `CORS_ALLOWED_ORIGINS` and Cloudflare R2's CORS policy
and confirm they list this exact Vercel URL (and any custom domain you add afterwards).

## Troubleshooting: VPN interference (e.g. Astrill)

If you run a VPN client while developing locally, be aware of this confirmed issue:

1. **Frontend won't load at `http://localhost:5173`.** Some VPNs disable IPv6 to prevent leaks.
   `localhost` can resolve to the IPv6 loopback (`::1`) before IPv4, which becomes unreachable in
   that state. Fixed here: `frontend/vite.config.ts` binds explicitly to `127.0.0.1`. Always use
   `http://127.0.0.1:5173`, not `http://localhost:5173`.

2. **Backend crashes on the JVM.** The backend previously ran on Spring Boot, where Astrill's
   network-interception DLL got injected into the process and crashed it
   (`EXCEPTION_ILLEGAL_INSTRUCTION` in `ASProxy64.dll`) — a bug in Astrill's driver, not this
   codebase. The backend has since been rewritten in Python/FastAPI, which isn't affected, so no
   VPN workaround is needed to run it natively.

3. **Docker Desktop itself fails to start ("failed to connect to the docker API...").** Astrill can
   also block Docker Desktop's own VM/network startup, taking down every containerized service at
   once — including MinIO, which resume uploads and the Chrome extension's application-screenshot
   feature both depend on for file storage. If a "screenshot"/resume upload silently doesn't show
   up anywhere, this is the first thing to check: `Test-NetConnection localhost -Port 9000` should
   succeed. If Docker won't start, run MinIO natively instead (no VPN workaround needed, same
   reasoning as the backend above) — see `scripts/start-minio-native.ps1`.

## Status

Project is in active development, following the phased implementation plan in
[`docs/system-design.md`](docs/system-design.md).
