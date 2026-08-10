# System Design — Job Application Tracking System (JATS)

## 1. Purpose & Scope

JATS tracks job applications that a user submits **manually** on external platforms (LinkedIn,
Indeed, company career sites). It is not a job board, crawler, auto-apply bot, or resume
generator. A Chrome Extension captures the submission event and sends it to the backend; a web
dashboard lets the applicant review their history; a manager dashboard provides read-only
analytics across all users.

## 2. High-Level Architecture

```
┌─────────────────────────┐        ┌───────────────────────────┐
│   Web Client (React)     │        │   Chrome Extension (MV3)   │
│  - Login / Register      │        │  - Manual capture popup    │
│  - Profile / Resume      │        │  - Sends application event │
│  - Application History   │        └──────────────┬──────────────┘
│  - Manager Dashboard     │                       │
└────────────┬─────────────┘                       │ HTTPS (JWT)
             │ HTTPS (JWT)                          │
             └──────────────────┬───────────────────┘
                                 ▼
                  ┌────────────────────────────┐
                  │   Backend API (FastAPI)     │
                  │   Modular Monolith          │
                  │  - auth     - tracking       │
                  │  - user     - notification    │
                  │  - resume   - dashboard        │
                  └───────────┬────────────────┘
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
        PostgreSQL         Redis           S3-compatible
        (system of        (future-ready    storage (resume
         record)           caching)         files)
```

## 3. Backend — Modular Monolith

A single FastAPI application (sync SQLAlchemy 2.0 + PostgreSQL), organized as vertical feature
modules rather than horizontal layers, so each module can later be extracted into its own service
if scale demands it. No microservices, message brokers, or service mesh in the MVP — that would be
premature for current load and complexity.

| Module | Responsibility |
|---|---|
| `auth` | Registration, login, JWT issuing/validation, role-based authorization |
| `user` | User profile CRUD |
| `resume` | Resume metadata (file URL, version) — files live in S3-compatible storage, never in Postgres |
| `tracking` | Application event ingestion, duplicate detection, application CRUD, status history |
| `notification` | In-app notifications (duplicate warnings, status updates) |
| `dashboard` | Read-only aggregation APIs for the Manager role |
| `common` | Cross-cutting concerns: exception handling, response envelopes, base entities |

Each module follows `Router → Service → ORM model`, with Pydantic schemas at the router boundary.
SQLAlchemy models are never returned directly from route handlers.

## 4. Roles & Account Lifecycle

Two roles: `USER` (job applicant) and `MANAGER` (system operator, read-only over user data).

**Account approval gate:** self-registered accounts start as `PENDING_APPROVAL`. A user in this
state can log in and manage their profile/resume, but **cannot submit application events** until
a manager approves the account (`ACTIVE`). This matches the intended operational flow: a manager
reviews new applicants before they start actively tracking data through the extension.

```
register → PENDING_APPROVAL ──(manager approves)──▶ ACTIVE ──▶ can submit application events
                              └──(manager rejects)──▶ REJECTED
```

`MANAGER` accounts are not self-service; they are provisioned out-of-band (seed data /
operator-only process), since the spec defines no manager registration flow.

## 5. Database Schema (PostgreSQL, managed via Alembic)

```
users
  id UUID PK
  email VARCHAR UNIQUE NOT NULL
  password_hash VARCHAR NOT NULL
  role VARCHAR(20) NOT NULL              -- USER | MANAGER
  status VARCHAR(20) NOT NULL            -- PENDING_APPROVAL | ACTIVE | REJECTED
  created_at TIMESTAMP NOT NULL
  updated_at TIMESTAMP NOT NULL

profiles
  id UUID PK
  user_id UUID FK -> users.id UNIQUE
  name VARCHAR
  location VARCHAR
  skills TEXT
  experience TEXT
  updated_at TIMESTAMP NOT NULL

resumes
  id UUID PK
  user_id UUID FK -> users.id
  file_url VARCHAR NOT NULL
  version INT NOT NULL
  created_at TIMESTAMP NOT NULL

applications
  id UUID PK
  user_id UUID FK -> users.id
  company VARCHAR NOT NULL
  job_title VARCHAR NOT NULL
  job_url VARCHAR NOT NULL
  status VARCHAR(20) NOT NULL            -- see Section 6
  applied_date DATE NOT NULL
  created_at TIMESTAMP NOT NULL
  updated_at TIMESTAMP NOT NULL
  UNIQUE (user_id, job_url)

application_history
  id UUID PK
  application_id UUID FK -> applications.id
  old_status VARCHAR(20)
  new_status VARCHAR(20) NOT NULL
  changed_at TIMESTAMP NOT NULL

notifications
  id UUID PK
  user_id UUID FK -> users.id
  message VARCHAR NOT NULL
  read_status BOOLEAN NOT NULL DEFAULT FALSE
  created_at TIMESTAMP NOT NULL
```

## 6. Application Status Workflow

```
APPLIED → SCREENING → INTERVIEW → OFFER → ACCEPTED
   │           │            │        │
   └────────▶ REJECTED  ◀───┴────────┘
   └────────▶ WITHDRAWN
```

Every transition is recorded as a row in `application_history` (old status → new status,
timestamp), written explicitly by the `tracking` service — no DB triggers or ORM event listeners,
to keep the transition logic explicit, testable, and in one place.

## 7. Duplicate Detection

Before inserting an application:
1. Application-level check: `existsByUserIdAndJobUrl(userId, jobUrl)` → if true, return
   `DUPLICATE` without a DB round trip to insert.
2. Database-level constraint: `UNIQUE (user_id, job_url)` as the authoritative safety net against
   race conditions (e.g., two near-simultaneous extension submissions).

## 8. API Contract

All endpoints are prefixed with `/api`. Authenticated endpoints require `Authorization: Bearer
<jwt>`. Manager-only endpoints additionally require `role = MANAGER`.

```
Auth
  POST   /auth/register                  Create USER account (status = PENDING_APPROVAL)
  POST   /auth/login                     Returns JWT + role + status

User
  GET    /users/me                       Current user summary (incl. status)
  GET    /users/me/profile
  PUT    /users/me/profile

Resume
  POST   /resumes/upload-url             Get a presigned S3 PUT URL + object key
  POST   /resumes                        Register new resume version (file already uploaded to S3)
  GET    /resumes
  GET    /resumes/{id}
  DELETE /resumes/{id}

Application Tracking
  POST   /application-events                       Chrome Extension entry point (requires ACTIVE status)
  POST   /application-events/screenshot-upload-url  Presigned S3 PUT URL + key for a submission screenshot
  GET    /applications                   Paginated, filterable by status
  GET    /applications/{id}
  PATCH  /applications/{id}/status
  GET    /applications/{id}/history

Notifications
  GET    /notifications
  PATCH  /notifications/{id}/read

Manager Dashboard (role = MANAGER)
  GET    /manager/stats/overview         Total users, total applications
  GET    /manager/stats/applications     Status breakdown & trends
  GET    /manager/users                  User list + activity metrics
  PATCH  /manager/users/{id}/approve
  PATCH  /manager/users/{id}/reject
```

### `POST /application-events` contract

Request:
```json
{
  "eventType": "APPLICATION_SUBMITTED",
  "company": "Google",
  "jobTitle": "Software Engineer",
  "jobUrl": "https://example.com/job/123",
  "timestamp": "2026-08-05T10:00:00",
  "screenshotKey": "screenshots/<userId>/<uuid>.png"
}
```

`screenshotKey` is optional (omit or send `null` for manually-logged applications). When present, it
must be the `key` returned by `POST /application-events/screenshot-upload-url` for this same user,
with the screenshot bytes already `PUT` there — see "Screenshot capture flow" below. The stored,
publicly-viewable URL is then returned as `screenshotUrl` on `JobApplicationResponse` /
`ManagerApplicationResponse`.

Response (success):
```json
{ "status": "SUCCESS", "message": "Application tracked successfully" }
```

Response (duplicate):
```json
{ "status": "DUPLICATE", "message": "Application already exists" }
```

### Screenshot capture flow

Mirrors the resume upload flow below, but the Chrome extension is the only caller and the object is
tied 1:1 to a single application (no separate registration step, no versioning):

1. On detecting a successful submission, the extension captures a viewport screenshot of the
   confirmation page (`chrome.tabs.captureVisibleTab`) — best-effort; any failure just means the
   application is reported without one, same as before this feature existed.
2. `POST /application-events/screenshot-upload-url { "contentType": "image/png" }` → presigned S3 PUT
   URL + `key` (under `screenshots/{userId}/`).
3. Extension `PUT`s the PNG bytes directly to that URL (never through the backend).
4. Extension includes the returned `key` as `screenshotKey` on the same `POST /application-events`
   call that registers the application (step above) — one combined creation call, no separate
   "attach" endpoint.

### Resume upload flow

The backend never proxies file bytes — it only issues presigned URLs and stores metadata:

1. `POST /resumes/upload-url` with `{ fileName, contentType }` → backend generates a unique object
   key (`resumes/{userId}/{uuid}-{fileName}`) and returns a short-lived (5 min) presigned PUT URL
   pointing directly at the S3-compatible store, plus the `key` and eventual public `fileUrl`.
2. The client `PUT`s the file directly to that URL with the **same** `Content-Type` header (it's
   part of the signed request; a mismatch fails signature validation).
3. `POST /resumes` with `{ key }` → backend verifies the key is prefixed with the caller's own
   `userId` (rejecting an attempt to register another user's object), computes the next version
   number, and persists the metadata row.

Two S3 endpoints are configured (`app.storage.s3.endpoint` / `public-endpoint`) because the
presigned URL and the stored `file_url` must be reachable from the *browser*, which may differ
from the backend's own network path to storage (e.g. backend reaches MinIO via the Docker-internal
`minio:9000`, but the browser needs `localhost:9000`).

## 9. Security

- Passwords hashed with bcrypt.
- Stateless JWT (HS256), single access token, no server-side session. No refresh-token rotation
  in the MVP — unnecessary complexity for the current scope; can be layered in later without
  breaking the API contract.
- A `get_current_user` FastAPI dependency validates the bearer token on every protected route; a
  `require_manager` dependency additionally guards manager-only endpoints.
- CORS restricted to the frontend origin and the extension's origin.

## 10. Frontend

React + TypeScript, built with Vite. React Router for navigation, Axios for HTTP, React Query
for server-state caching/mutations, Tailwind CSS for styling. Feature-folder structure mirroring
backend modules (`auth`, `profile`, `resume`, `applications`, `dashboard`).

## 11. Chrome Extension

Manifest V3, TypeScript. Clicking the toolbar icon opens a docked side panel (`chrome.sidePanel`,
`openPanelOnActionClick: true`) rather than a dropdown popup, so it can stay open alongside the
page while the user fills it in. The panel form (pre-filled with the active tab's URL) is where
the user manually confirms company/title and submits — there is no DOM scraping or
auto-fill-and-submit automation, consistent with "the user already applied manually." A separate
options page handles login and stores the JWT (via `chrome.storage`).

The backend URL is a build-time constant (`VITE_API_BASE_URL`), not a user-facing setting — end
users of a published extension have no reason to see or change it. `manifest.json`'s
`host_permissions` is derived from the same variable at build time (see
`chrome-extension/vite.config.ts`) so the two can't drift out of sync.

## 12. Deployment

Docker Compose orchestrates: `postgres`, `redis`, `minio` (local S3-compatible stand-in),
`backend`, `frontend` (Nginx-served production build). Redis is provisioned now but not wired
into application logic yet — reserved for future caching (e.g., dashboard stats) without
requiring an infrastructure change later.

## 13. Implementation Phases

1. Project initialization (this document + folder scaffolding)
2. Backend foundation (entities, repositories, services, controllers skeleton)
3. Authentication (register/login/JWT/roles + approval gate)
4. Application Tracking (event ingestion, duplicate check, history)
5. Resume management (S3-compatible upload flow)
6. Chrome Extension (capture + send)
7. React user dashboard
8. Manager dashboard
9. Testing (unit + integration)
10. Docker deployment
