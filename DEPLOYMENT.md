# Deploying Lumen

There are two ways to ship this, depending on what you need.

## Option A — Zero-backend, "device = account" (easiest) ⭐

Deploy just the **client-side reader** (the home page `/`). Each device that
visits the URL gets its **own library that lives in that browser** (IndexedDB
for the EPUB files, local storage for highlights + reading position). No login,
no database, no Blob, no Docker — and it's free.

- ✅ One URL, open it on any phone/laptop/Mac.
- ✅ The **device is the account**: come back in the same browser on the same
  device and your books + last page + highlights are right where you left them.
- ⚠️ Data is stored **in that browser only** — it does not sync between devices,
  and clearing the browser's site data (or a different browser/incognito) starts
  fresh. That's the trade-off for having no accounts/servers.

**Deploy it (Vercel, ~2 minutes):**

1. Push the repo to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Framework preset: **Next.js**. **Don't set any environment variables.**
4. **Deploy.** The build auto-skips database migrations when no `DATABASE_URL`
   is present, so it succeeds with zero config.
5. Open `https://<your-app>.vercel.app` → upload an EPUB → read.

> This same build also works on Netlify, Cloudflare Pages, Render, etc. — it's a
> standard Next.js app with no required env vars.

> Want libraries that **follow you across devices** (true sync) instead of
> per-device? That needs accounts + a server — use Option B.

---

## Option B — Full app: accounts + cross-device sync

This gets a live instance with **Google sign-in**, where your library and
highlights sync across every device you log in on. Uploaded EPUBs go to
**Vercel Blob** and data lives in **PostgreSQL**.

> Why Blob? Vercel's function filesystem is ephemeral, so the local on-disk
> storage won't persist there. When `BLOB_READ_WRITE_TOKEN` is set, the app
> automatically stores uploads in Vercel Blob instead — no code changes needed.

---

## 1. Prerequisites

- The repo pushed to GitHub (branch `claude/compassionate-meitner-9719xp`).
- A free [Vercel](https://vercel.com) account.
- A PostgreSQL database. Easiest options:
  - **Neon** ([neon.tech](https://neon.tech)) — free, works great with Vercel, or
  - **Vercel Postgres** (Storage tab inside your Vercel project).

---

## 2. Create the database

Create a Postgres database and copy its connection string. Use the **standard
(direct) connection string** — it must allow `prisma migrate deploy` at build
time. It looks like:

```
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Keep it handy for `DATABASE_URL` below.

---

## 3. Create a Blob store

In your Vercel project (you can do this right after importing in step 5):
**Storage → Create → Blob**. When you connect it to the project, Vercel adds
the `BLOB_READ_WRITE_TOKEN` environment variable automatically. (You can also
copy the token and set it manually.)

---

## 4. Create Google OAuth credentials

1. Go to the [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create Credentials → OAuth client ID → Web application.**
3. You'll add the redirect URI in step 6 once you know your Vercel URL. For now,
   create it and copy the **Client ID** and **Client secret**.

---

## 5. Import the project into Vercel

1. **Add New → Project →** import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Leave build settings default —
   the repo ships a `vercel-build` script that runs database migrations and then
   builds:
   ```
   prisma migrate deploy && prisma generate && next build
   ```
3. Add the environment variables below **before** the first deploy
   (Project → Settings → Environment Variables):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | your Postgres connection string (step 2) |
   | `AUTH_SECRET` | a long random string — run `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | leave blank for now; set in step 6 |
   | `AUTH_GOOGLE_ID` | Google client ID (step 4) |
   | `AUTH_GOOGLE_SECRET` | Google client secret (step 4) |
   | `BLOB_READ_WRITE_TOKEN` | added automatically when you link Blob (step 3) |

4. Click **Deploy**. Note your production URL, e.g. `https://lumen-xxxx.vercel.app`.

---

## 6. Finish Google wiring & redeploy

1. In Google Cloud Console, edit the OAuth client and add the **Authorized
   redirect URI**:
   ```
   https://<your-project>.vercel.app/api/auth/callback/google
   ```
   (Optionally also add the Authorized JavaScript origin
   `https://<your-project>.vercel.app`.)
2. In Vercel, set `NEXTAUTH_URL` to `https://<your-project>.vercel.app`.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the new env var takes effect.

---

## 7. Try it

Open your Vercel URL → **Sign in → Continue with Google** → complete the
onboarding wizard → upload an EPUB and read. Your library, position, highlights
and preferences are stored in Postgres; book files live in Blob.

---

## Notes & limits

- **Upload size:** Vercel Serverless Functions cap the request body at ~4.5 MB on
  the Hobby plan. Most novels are well under that; very large, image-heavy EPUBs
  may exceed it. If you hit this, ask and I'll switch uploads to direct
  client→Blob transfer (bypasses the limit).
- **Email sign-in in production:** the on-screen/console code is dev-only and is
  disabled in production. Since you're using Google, that's fine. To also enable
  email codes on the live site, set `EMAIL_FROM` + `SMTP_*` (see `.env.example`).
- **Database connections:** for a test/low-traffic deploy a direct connection
  string is fine. For higher scale, use a pooled URL and add a `directUrl` to the
  Prisma datasource for migrations.
- **Self-hosting instead?** With a persistent disk (Railway, Render, Fly.io, a
  VM) you can skip Blob entirely — leave `BLOB_READ_WRITE_TOKEN` unset and the app
  uses `STORAGE_DIR` on disk.
