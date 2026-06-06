# 🛠️ Admin Runbook — operational checks

Quick, repeatable operational checks for Climbritz production. No code required —
just `curl` + the `ADMIN_SECRET`.

Backend base URL (Railway): `https://web-production-cea9.up.railway.app`
`ADMIN_SECRET` lives in the Railway service **Variables** (rotate it there if it
ever leaks — the endpoint keeps working with the new value, nothing to redeploy).
A local copy is in **`backend/.env`** (gitignored, `ADMIN_SECRET=...`) so the
helper scripts below work without you typing it.

## ⚡ TL;DR — the two helper scripts (easiest)

Both read `ADMIN_SECRET` from `backend/.env` (or the env var) and never print it:

```bash
./backend/scripts/check_recent_users.sh        # who signed up + what they did (prints JSON)
./backend/scripts/check_recent_users.sh 25      # last 25 (max 50)

./backend/scripts/notify_recent_users.sh        # PUSH that summary to Telegram (on-request)
```

---

## "Who just signed up — iOS or Android — and have they done anything?"

`GET /api/admin/recent-users` joins the **Clerk Backend API** (identity + device)
with **our DB** (in-app activity). One command:

```bash
curl -s -H "X-Admin-Secret: $ADMIN_SECRET" \
  "https://web-production-cea9.up.railway.app/api/admin/recent-users?limit=10" \
  | python3 -m json.tool
```

Query params: `limit` (1–50, default 10), `include_devices` (default `true`).

### Reading the result

Each user has:

- **Identity (from Clerk):** `email`, `name`, `created_at` (sign-up),
  `last_sign_in_at`, `last_active_at`.
- **`devices[]` (from Clerk sessions):** `platform` (iOS / Android / macOS /
  Windows), `device_type`, `browser`, `city`, `country`, `session_status`.
- **`activity` (from our DB):**
  - `has_local_row: false` → signed up in Clerk but **never hit an authenticated
    backend route** = never really used the app.
  - `has_local_row: true` → counts of `climb_logs`, `videos`, `classifications`,
    `projects`, plus `first_seen` (when our shadow row was created).

### Platform gotcha (important)

Clerk's user-agent parsing is quirky for the Capacitor WebViews:

| Real device | Clerk `device_type` | Clerk `browser` | Our `platform` label |
|---|---|---|---|
| iPhone app | `iPhone` | Safari / Chrome | **iOS** |
| Android app | **`Linux`** | **`Android`** | **Android** |
| Mac desktop | `Macintosh` | Safari | macOS (≠ iOS!) |
| `curl` / script | `null` | `curl` | Unknown |

So **Android shows up as `device_type:"Linux"` + `browser:"Android"`** — the
`platform` field already accounts for this (see `_guess_platform` in
`backend/app/services/clerk_admin_service.py`). If you read raw JSON, don't be
fooled by "Linux".

### Errors

- `403` → wrong/missing `X-Admin-Secret`.
- `503` → `CLERK_SECRET_KEY` not set on the server.
- `502` → Clerk API call failed (transient; retry).

---

## On-request Telegram push of recent sign-ups

`POST /api/admin/notify-recent-users` reuses the join above and pushes a
compact summary to Telegram on demand (one line per user: platform emoji +
name + activity counts). Same `X-Admin-Secret` gate.

```bash
./backend/scripts/notify_recent_users.sh        # or: ...notify_recent_users.sh 25
# raw curl equivalent:
curl -s -X POST -H "X-Admin-Secret: $ADMIN_SECRET" \
  "https://web-production-cea9.up.railway.app/api/admin/notify-recent-users?limit=10"
```

Returns `{sent, count}`. `sent: false` = Telegram not configured
(`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` Railway vars) or the send failed —
the request still returns 200 (best-effort, same as the webhook). The message
text is the same regardless; configure Telegram once (see next section) for
both the automatic and the on-request pushes.

---

## Automatic alert on every new sign-up (Clerk webhook → Telegram)

`POST /api/webhooks/clerk` verifies a Svix-signed Clerk webhook and, on a
`user.created` event, pushes a Telegram message. Truly automatic + server-side
(no laptop / Claude session needed). Implementation:
`backend/app/api/webhooks.py` + `backend/app/services/telegram_service.py`.

### One-time setup (do once)

1. **Create a Telegram bot:** message **@BotFather** → `/newbot` → copy the
   **bot token**.
2. **Get your chat id:** message your new bot once (say "hi"), then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and read
   `result[].message.chat.id` (a number). That's `TELEGRAM_CHAT_ID`.
3. **Create the Clerk webhook:** Clerk Dashboard → **Webhooks** → *Add Endpoint*
   → URL `https://web-production-cea9.up.railway.app/api/webhooks/clerk`,
   subscribe to **`user.created`** → copy the **Signing Secret** (`whsec_...`).
4. **Set 3 env vars** on the Railway service → *Variables*, then redeploy:
   - `CLERK_WEBHOOK_SECRET=whsec_...`
   - `TELEGRAM_BOT_TOKEN=...`
   - `TELEGRAM_CHAT_ID=...`
5. **Test:** Clerk's webhook page has a *Send example* button → you should get a
   Telegram ping. (Or sign up a throwaway user.)

### Behaviour / troubleshooting

- Unset secret → webhook returns **503** (no alert). Bad signature → **400**.
- Telegram is best-effort: if the bot token/chat is wrong the webhook still
  returns 200 (check Railway logs for `telegram send -> ...`).
- The alert only fires on **`user.created`**; other Clerk events are ack'd and
  ignored.

---

## Welcome email to new sign-ups (Gmail SMTP)

On a verified `user.created`, the same webhook also sends the new user a
**welcome email** (best-effort — a send failure never blocks the ack; the
Telegram alert and the email are independent). Sent from your personal Gmail
via SMTP (`app/services/email_service.py`). English copy, personalised with the
user's first name, with a reply-to-me invite.

### One-time setup

1. **Enable 2-Step Verification** on the Gmail account (required for app passwords):
   https://myaccount.google.com/security
2. **Create an App Password:** https://myaccount.google.com/apppasswords → name
   it "Climbritz" → copy the **16-character** password (no spaces).
3. **Set 2 vars** on the Railway service → *Variables*, then redeploy
   (also mirrored in `backend/.env` for local runs):
   - `GMAIL_ADDRESS=daniele.somensi@gmail.com`
   - `GMAIL_APP_PASSWORD=<the 16-char app password>` (NOT your normal password)

Until `GMAIL_APP_PASSWORD` is set, sending is skipped (the webhook still
returns 200). Free Gmail allows ~500 recipients/day — fine for the beta; move
to a domain-verified provider (Resend/SendGrid) before real volume.

> "Interesting activity" emails (first send, milestones, first video) are a
> planned phase 2 — not built yet.

---

## Where the data lives (so you know what's knowable from where)

| Question | Source |
|---|---|
| Email / name / sign-up / last login / **iOS-Android** | **Clerk only** (our `users` table is just `clerk_id` + timestamps — zero PII, zero device) |
| Logged climbs / videos / classifications / projects | **Our DB** on Railway |

The `recent-users` endpoint is the only place these two are joined — built
server-side because the prod server already holds both the `sk_live` Clerk key
and the DB.

---

## Implementation pointers

- Endpoint: `backend/app/api/admin.py` → `recent_users()` (X-Admin-Secret gated).
- Clerk calls: `backend/app/services/clerk_admin_service.py` (httpx, read-only —
  deliberately separate from the high-risk `core/clerk.py` JWT module).
- Tests: `backend/tests/test_admin_recent_users.py` + `test_clerk_admin_service.py`.
