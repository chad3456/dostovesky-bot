# 📖 Lumen — your library, everywhere

Lumen is a beautiful, Kindle-style reader for your own **EPUB** library. Upload a
book once and read it on any device — phone, tablet, laptop or Mac — with your
exact position, highlights and reading preferences kept in sync.

Built as a single, self-contained **Next.js** full-stack app (no external SaaS
required): Auth.js (Google sign-in), Prisma + PostgreSQL, on-disk file storage,
and [epub.js](https://github.com/futurepress/epub.js) for rendering.

---

## ✨ Features

- **Email sign-in (passwordless)** — enter your email, receive a 6-digit code,
  and you're in. The code is hashed at rest, expires in 10 minutes, is rate-limited
  and attempt-limited, and unifies sign-up with sign-in.
- **Google sign-in** (Auth.js / NextAuth v5) as an optional alternative, plus a
  gated test-login for automation.
- **First-run onboarding** — new users are guided through a short wizard to set
  their display name and initial reading preferences before reaching the library.
- **Swift EPUB upload** with drag-and-drop; metadata (title, author, language,
  description) and the cover are extracted server-side on upload.
- **Cross-device sync** — reading position, highlights and preferences live in the
  database and follow you to every device you sign in on.
- **Highlights & notes** in five colors, with a dedicated highlights panel.
- **Reading preferences for every age** — five themes (light, sepia, dark, night,
  high-contrast), three fonts including a **dyslexia-friendly** typeface, plus
  adjustable font size, line spacing, margins, justification and page/scroll layout.
- **Responsive** from small phones to large desktops; the page reflows on resize.
- **Share read-only** — generate a private link so anyone can read a book without
  an account; revoke it anytime.
- **Resilient** — every API route is wrapped in structured error handling, inputs
  are validated with Zod, and the UI has error boundaries and graceful empty/error
  states so a single failure never crashes the app.

---

## 🧱 Tech stack

| Concern        | Choice                                              |
| -------------- | --------------------------------------------------- |
| Framework      | Next.js 14 (App Router) + TypeScript                |
| Styling        | Tailwind CSS                                         |
| Auth           | Auth.js (NextAuth v5) — Google provider             |
| Database / ORM | PostgreSQL + Prisma                                 |
| EPUB rendering | epub.js (client) · JSZip + fast-xml-parser (server) |
| Validation     | Zod                                                 |
| Testing        | Vitest (unit + integration) · Playwright (E2E)      |

---

## 🚀 Quick start

### Option A — just read locally (no setup)

Want to upload an EPUB and read it with **no database, no account, no Docker**?
The home page (`/`) is a fully client-side reader: books are stored in your
browser (IndexedDB) and reading settings + highlights in local storage.

```bash
pnpm install
pnpm dev
# open http://localhost:3000 → drag in an .epub → read
```

That's it. The sections below are only needed for the **full app** (Google/email
sign-in and the cross-device synced library at `/library`).

### 1. Prerequisites

- Node.js ≥ 20
- A running PostgreSQL instance
- pnpm (`npm i -g pnpm`)

### 2. Install & configure

```bash
pnpm install
cp .env.example .env        # then edit values
```

Set at least `DATABASE_URL` and `AUTH_SECRET` (generate one with
`openssl rand -base64 32`).

**Email sign-in** works out of the box: with no SMTP configured, the 6-digit
code is printed to the server console (and, when `ENABLE_TEST_LOGIN="true"`,
shown on the login page) so local development needs no mailbox. To deliver real
emails, set `SMTP_HOST` / `EMAIL_FROM` (and optional `SMTP_USER` /
`SMTP_PASSWORD`) — see `.env.example`.

To enable **Google sign-in**, add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
(see below).

### 3. Set up the database

```bash
pnpm prisma migrate deploy   # apply schema
# or, for iterative dev:
pnpm prisma migrate dev
```

### 4. Run

```bash
pnpm dev          # http://localhost:3000
```

---

## 🔑 Google OAuth setup

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   create an **OAuth 2.0 Client ID** (type: Web application).
2. Add an authorized redirect URI:
   `http://localhost:3000/api/auth/callback/google`
   (and your production equivalent).
3. Put the client id/secret in `.env` as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

`ENABLE_TEST_LOGIN` is automatically ignored when `NODE_ENV=production`, so the
demo login can never be used in a real deployment.

---

## 🧪 Testing

The project ships a full test pyramid.

```bash
pnpm test             # unit + integration (Vitest)
pnpm test:unit        # pure logic: epub parsing, themes, validation, storage
pnpm test:integration # API routes against a real Postgres test DB
pnpm test:e2e         # full browser flows (Playwright)
```

- Unit + integration tests use the `epub_test` database (configured in
  `vitest.config.ts`) and run migrations automatically via the global setup.
- E2E tests start the app, sign in via the test-login, then upload, read,
  highlight, change preferences and open a shared link in a signed-out context.
  Install the browser once with `pnpm test:e2e:install`.

---

## 🗂️ Project structure

```
prisma/schema.prisma         Data model (users, books, progress, highlights, prefs, shares)
src/lib/                     auth, otp, email, prisma, epub parsing, storage, validation, themes
src/app/api/                 REST endpoints (auth/email, onboarding, books, progress, highlights, preferences, share)
src/app/                     Pages: landing, login, onboarding, library, read/[id], shared/[token]
src/components/              UI: login form, onboarding wizard, library, share dialog, reader + panels
tests/unit                   Vitest unit tests
tests/integration           Vitest API/route tests (real DB)
tests/e2e                    Playwright end-to-end tests
```

---

## 📦 Deployment notes

- **Deploy to Vercel:** see [`DEPLOYMENT.md`](./DEPLOYMENT.md) for a step-by-step
  guide (Vercel Blob for uploads + Postgres + Google sign-in). The repo's
  `vercel-build` script runs `prisma migrate deploy` before building.
- Run `pnpm build` (which runs `prisma generate` then `next build`) and
  `pnpm start`. Apply migrations on deploy with `pnpm prisma migrate deploy`.
- `STORAGE_DIR` controls where uploaded EPUBs are written. For multi-instance
  hosting, point it at shared storage (or swap `src/lib/storage.ts` for S3).
- Set `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, and the Google credentials
  in the host environment. Never enable `ENABLE_TEST_LOGIN` in production.
