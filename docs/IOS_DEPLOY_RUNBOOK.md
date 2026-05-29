# 🍏 iOS Deploy Runbook — Climbritz → TestFlight

> **Why this file exists:** the 2026-05-29 session (build 3 upload) burned ~2 hours
> debugging a code-signing failure because the deploy convention lived only in one
> person's head + a shell script comment. This runbook is the single source of
> truth for shipping a TestFlight build. Read it before every deploy.

**App:** Climbritz · **Bundle ID:** `app.climbritz` · **Team ID:** `KSD2RSAZP2`
**Apple ID:** `daniele.somensi@icloud.com` · **Deploy script:** `~/deploy_climbritz.sh`

---

## ✅ Prerequisites — verify before EVERY deploy

1. **Apple Developer Program active** — check `developer.apple.com/account` (membership
   must not be expired/lapsed).
2. **Xcode is signed in** — Xcode → Settings → **Apple Accounts** shows
   `daniele.somensi@icloud.com` signed in.
3. **Both signing certificates exist** — in that same pane, select the account →
   **Manage Certificates** must show **BOTH**:
   - `Apple Development`
   - `Apple Distribution`  ← **this is the one that breaks app-store export when missing**
   The **Distribution cert lasts ~12 months** — regenerate it when it expires
   (see Common failures below).
4. **App-specific password is current** — `~/deploy_climbritz.sh` has a working
   `APP_PASSWORD`.
   **Convention changed 2026-05-29:** we now keep a **stable** app-specific password
   and reuse it across uploads (we no longer revoke-after-each-upload). Only rotate
   it if Apple invalidates it.

---

## 🚀 Standard flow

1. **(Optional) Bump `package.json` patch** — semver hygiene; not required for the build to upload.
2. **Open `Terminal.app` on the Mac** — **NOT** Claude Code's shell, **NOT** a
   background SSH/tmux session. Code signing needs the **interactive login session's
   keychain** (see "Why Terminal.app" below).
3. **Run the deploy script** with the build number as a single positional arg:
   ```bash
   bash ~/deploy_climbritz.sh <build-number>
   ```
   e.g. `bash ~/deploy_climbritz.sh 3`
4. **Wait ~10–15 min.** The script builds web assets, syncs Capacitor, archives,
   exports the IPA, and uploads via `altool`.
5. **Capture the `Delivery UUID:`** from the output — record it in `PROJECT_STATUS.md`
   + `ROADMAP_ACTIVE.md` for the build.
6. **Apple processing** takes ~10–45 min before the build shows as
   "Ready to Test" in TestFlight.

The export-compliance prompt is auto-resolved by `ITSAppUsesNonExemptEncryption=false`
in `ios/App/App/Info.plist` — no manual "Missing Compliance" click expected (true since build 3).

---

## 🔧 Common failures and fixes

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| `exportArchive: No Accounts` | No Apple account logged into Xcode in this session | Xcode → Settings → Apple Accounts → **add account** |
| `exportArchive: No signing certificate "iOS Distribution" found` | No Distribution cert available | Manage Certificates → **`+`** → **Apple Distribution** |
| `Team: Unknown Name (KSD2RSAZP2)` shown **in red** in Signing & Capabilities | Same root cause — no account logged into Xcode | Add the account (as above) |
| Build worked before but **fails now** | **Distribution cert expired** (~12-month lifetime) | Regenerate: Manage Certificates → `+` → Apple Distribution |
| `altool` **rejects the app-specific password** | Password revoked/invalidated by Apple | Generate a fresh one at `appleid.apple.com` → update the `APP_PASSWORD` line in `~/deploy_climbritz.sh` |

---

## ❗ Why `Terminal.app` and NOT Claude Code

- **Code signing requires keychain access tied to the interactive login session.**
- **Background shells cannot see Xcode's logged-in account state** — this includes
  Claude Code's shell, non-interactive SSH, tmux/screen sessions, and daemons.
  The archive step can succeed (it signs with the *development* cert from the
  keychain), but the **app-store export step fails** because it needs the logged-in
  account to mint the *distribution* provisioning profile.
- **Daniele runs the script himself in Terminal.app. Claude Code never runs the
  deploy script** — it can prep (bump version, validate `npm run build:mobile`,
  do the doc sync + tag afterwards), but the upload itself is a human-in-Terminal step.

---

## 📌 Concrete example — 2026-05-29 session (build 3)

The failure modes above are not hypothetical. On 2026-05-29, shipping build 3:

1. **First attempt ran from Claude Code's (non-interactive) shell.** Phases 0–6
   succeeded — the archive built and signed with `Apple Development: daniele somensi`.
   Then **Phase 7 (export IPA) failed** with:
   ```
   error: exportArchive No Accounts
   error: exportArchive No signing certificate "iOS Distribution" found
   ** EXPORT FAILED **   (exit code 70)
   ```
   `security find-identity -v -p codesigning` confirmed the keychain held **only**
   the `Apple Development` cert — no `Apple Distribution`. Phase 8 (`altool` upload)
   never ran, so **no upload attempt was burned** and the app-specific password was
   never even exercised.
2. **Re-run by Daniele in Terminal.app succeeded** — the interactive login session
   carries the Xcode account + distribution signing. The export + upload completed:
   **Delivery UUID `ef01e812-fb0c-49cb-ba95-03d1a687bb19`**, uploaded 10:39:31 CEST.
3. **Lesson:** the password was *not* the problem (the initial suspicion). The real
   issue was running in a background shell that can't see Xcode's account. → Always
   run from `Terminal.app`. Also documented here: the password convention switched
   to "keep a stable password" the same day.
