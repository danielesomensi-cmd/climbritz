# 🔐 Clerk + Capacitor Auth — Runbook & Lessons Learned

> **Why this exists:** B021 (Clerk Dev→Prod promotion, 29–30 May 2026) burned a
> full night on auth that *looked* broken in a dozen different ways but was
> really a small set of origin/cookie/CORS rules interacting badly with mobile
> WebViews. This is the map so we never re-walk it blind. Read it before touching
> Clerk keys, the Capacitor `server` block, or auth origins.

---

## TL;DR — the mental model

There are **three independent gates** an authenticated mobile request passes
through. A failure in any one looks like "auth is broken", but the symptom and
the fix are different for each:

| Gate | Who enforces it | Failure symptom | Fix |
|------|-----------------|-----------------|-----|
| **1. Clerk FAPI origin check** | Clerk (`pk_live` is domain-locked) | `origin_invalid` 400 on `/v1/environment` + `/v1/client` → **infinite spinner** | Add the exact WebView origin to Clerk **`allowed_origins`** |
| **2. Session persistence** | The WebView (cookie / token) | login succeeds then **"You are signed out"** | Same-site origin (Android) / native origin in `allowed_origins` (iOS) |
| **3. Backend CORS** | Our FastAPI (`main.py`) | login works but **API calls fail** ("Import failed", empty Discover) | Add the exact origin to **backend CORS** |

**The crux: the WebView origin differs per platform, and BOTH allowlists
(Clerk `allowed_origins` AND backend CORS) must contain BOTH origins.**

| Platform | `capacitor.config` | Actual WebView origin (`window.location.origin`) |
|----------|--------------------|--------------------------------------------------|
| Android  | `androidScheme: 'https'` + `hostname` | `https://app.climbritz.app` ✅ (real https, honored) |
| iOS      | `iosScheme: 'https'` + `hostname` | `capacitor://app.climbritz.app` ⚠️ (**`https` is IGNORED** — WKWebView reserves it) |

So the canonical allowlists (Clerk `allowed_origins` **and** backend CORS) are:
```
https://app.climbritz.app        # Android
capacitor://app.climbritz.app    # iOS
https://localhost                # Android dev / old builds
capacitor://localhost            # iOS dev / old builds
http://localhost                 # dev
```

---

## Why each thing is the way it is

- **`pk_test` (dev) "just worked" on mobile; `pk_live` (prod) didn't.** Dev
  instances are permissive and use a **URL-based dev-browser token** (no cookie,
  no origin allowlist). Production enforces the origin allowlist *and* relies on
  a **cookie**. Promotion flips both on at once → mobile breaks in two ways.

- **Clerk session cookie is `SameSite=Lax` on `Domain=climbritz.app`.** A
  cross-site WebView origin (`https://localhost`) can't send it → "You are
  signed out". **Android fix:** `androidScheme=https` + `hostname=app.climbritz.app`
  makes the origin a real `https://` subdomain of `climbritz.app` → same-site →
  cookie sent. **iOS:** can't get a real `https` origin (see below), but adding
  `capacitor://app.climbritz.app` to `allowed_origins` was enough — Clerk treats
  a registered native origin without relying on the same-site cookie.

- **iOS ignores `iosScheme: 'https'`.** WKWebView reserves `http`/`https` for
  real network loads; you cannot register a `WKURLSchemeHandler` for them. So the
  iOS WebView stays on `capacitor://` regardless. `hostname` *is* honored (the
  host becomes `app.climbritz.app`), but the scheme stays `capacitor://`. There
  is no way to give iOS a bundled-asset `https://` origin short of loading the app
  from a **real hosted URL** (`server.url`) — which we did NOT do.

- **`WKAppBoundDomains` is a trap.** It does **not** cover subdomains, and if the
  WebView's own origin isn't listed it silently **refuses user-script injection**
  ("Ignoring user script injection for non-app bound domain") → Capacitor bridge +
  clerk-js never load → spinner. It was added in A020 for an OAuth-handshake-to-
  Safari concern that doesn't apply to email/password. **We removed it.** (Safari
  redirects are handled by Capacitor `allowNavigation`, not this key.)

- **Bot protection / Turnstile CAPTCHA** is ON by default on Clerk production and
  **fails inside WebViews** (`captcha_missing_token`) → blocks sign-up *before any
  OTP is sent*. Looks like "the email never arrives". **Disable it** for native.

- **Email-code-only is fragile on a brand-new sender domain.** Codes land in
  spam / get throttled. We chose **email + password, with the email code only at
  sign-up** — daily login no longer depends on email delivery at all.

---

## Pre-flight checklist — ANY change to Clerk keys / origins / capacitor server

1. [ ] Confirm the **exact** WebView origin per platform: in the WebView console
       run `window.location.origin`. Don't assume — iOS ≠ Android.
2. [ ] That exact origin is in **Clerk `allowed_origins`** (`PATCH /v1/instance`)
       — verify with `GET /v1/instance`.
3. [ ] That exact origin is in **backend CORS** (`backend/app/main.py`) — verify
       with a preflight: `curl -X OPTIONS <backend>/api/... -H "Origin: <origin>"
       -H "Access-Control-Request-Method: POST"` → expect
       `access-control-allow-origin: <origin>`.
4. [ ] Clerk FAPI loads: no `origin_invalid` 400 on `/v1/environment`.
5. [ ] Login **HOLDS** (kill + reopen → still signed in) — not just "login screen
       renders".
6. [ ] An **authenticated backend call** works (not just login) — CORS is a
       separate gate. Test a real data page (Discover) or an action (Import JSON).
7. [ ] iOS only: `WKAppBoundDomains` removed (or lists the exact origin host);
       bot protection off.
8. [ ] Both allowlists changed are **server-side** (Clerk dashboard/API + Railway
       env/redeploy) — no app rebuild needed for origin changes; only
       `capacitor.config.ts` / `Info.plist` changes need a rebuild.

---

## Debugging mobile WebViews

- **Android — fully inspectable, no excuses.** `adb` over Wi-Fi/USB gives you
  everything: `adb logcat` (incl. `Capacitor/Console` JS logs on a **debug**
  build), `adb exec-out screencap`, and `adb shell input tap/text` to drive the
  UI yourself. Release builds suppress `console.*` → build/install the **debug**
  APK to read JS errors. Wi-Fi adb drops often: re-pair via
  `adb mdns services` → `adb pair <ip:port> <code>` / `adb connect <ip:port>`.

- **iOS — NOT remotely inspectable.** No adb. **TestFlight (release) builds are
  not web-inspectable.** To read the WebView console you must run a **debug build
  from Xcode** on a tethered iPhone (`npm run open:ios` → Run), then Mac **Safari
  → Develop → [iPhone] → [the WebView]** (enable *Web Inspector* on the iPhone +
  *Develop menu* in Safari first). `window.location.origin` in that console is the
  single most useful fact. **Don't blind-loop TestFlight deploys** — each one is
  slow and only Daniele can run the signing; get the console once, fix once.

---

## What the final working setup is (B021, as of 30 May 2026)

- Clerk **production** instance, custom domain `clerk.climbritz.app` (`pk_live`/`sk_live`).
- Auth: **email + password**, 6-digit email code **only at sign-up**. Google
  OAuth, magic links, and bot protection all **disabled**.
- `capacitor.config.ts`: `server.hostname = app.climbritz.app`,
  `androidScheme: 'https'`, `iosScheme: 'https'` (iOS ignores the scheme but the
  hostname is what matters), `allowNavigation` includes the Clerk hosts.
- `Info.plist`: **no** `WKAppBoundDomains`.
- Clerk `allowed_origins` **and** backend CORS both list:
  `https://app.climbritz.app`, `capacitor://app.climbritz.app`, and the three
  localhost variants.
- Backend JWKS issuer env-driven (`CLERK_JWKS_URL` → `clerk.climbritz.app`);
  `core/clerk.py` itself was never modified.

**Verified end-to-end on-device:** Android (Galaxy Tab A11, release build 8) and
iOS (iPhone, Xcode debug build) — login + cold-start persistence + authenticated
backend calls (Discover, Import JSON) all working.
