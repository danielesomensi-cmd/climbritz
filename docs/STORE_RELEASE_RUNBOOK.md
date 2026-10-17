# 🏪 Store Release Runbook — Climbritz

> Public App Store / Play Store releases. For the mechanics of cutting an iOS
> build (keychain, archive, upload) see `docs/IOS_DEPLOY_RUNBOOK.md` — this
> document covers what has to be *true* before that build is worth submitting.
>
> **Provenance note:** Parts A–C were authored during A-STORE-PROD-001
> (2026-07-23) from the Phase 0 audit findings. Part D is the running lessons
> log — append, never rewrite.

---

## ⚡ Quick release — new TestFlight + Play build (the 10-minute path)

Use this for every "bump + ship" (no store submission). Secrets are never in
the repo — this table says only **where they live**.

### Keys & credentials

| What | Where | Used by | If it breaks |
|---|---|---|---|
| Apple app-specific password | `APP_PASSWORD=` line in `~/deploy_climbritz.sh` (home dir) | `altool` upload | `-22910` → new one at account.apple.com → Sign-In & Security → App-Specific Passwords, paste into the script |
| Apple ID / Team ID | `daniele.somensi@icloud.com` / `KSD2RSAZP2` (defaults in the script) | archive + upload | — |
| iOS signing certs | macOS **login keychain** + Xcode → Settings → Apple Accounts | `xcodebuild archive/export` | `errSecInternalComponent` → keychain locked: `security unlock-keychain ~/Library/Keychains/login.keychain-db` (Mac password), re-run. `No Accounts` / no Distribution cert → see `IOS_DEPLOY_RUNBOOK.md` |
| Apple agreements | App Store Connect → Business | upload | `403 CONTRACT_NOT_VALID` → accept the pending agreement |
| Android upload keystore | `~/kilter-up-release.keystore` (legacy name, **not** `climbritz-release.keystore`) | `./gradlew bundleRelease` | — |
| Android keystore passwords + alias | `android/keystore.properties` (gitignored) | Gradle signing | — |
| Android testers | Google Group `climbritz-testers@googlegroups.com` | Play closed testing | testers must join the group **and** opt in (`/get` explains both steps) |

Back up the keystore + `keystore.properties` off this Mac: losing the
upload key means a Play Console key-reset request (days).

### Steps

1. **Green suites:** `cd backend && pytest` · `npx jest` · `npx tsc --noEmit` · `npm run build`.
2. **Bump** (build numbers only; marketing version only for a new public version — Part B):
   - iOS: `CURRENT_PROJECT_VERSION` +1 in `ios/App/App.xcodeproj/project.pbxproj` (**2 occurrences**).
   - Android: `versionCode` +1 in `android/app/build.gradle` (never reuse a code).
3. **Commit + push** (pre-push hook runs `npm run build`).
4. **iOS → TestFlight:** `bash ~/deploy_climbritz.sh <build>` — runs `build:mobile` + `cap sync ios` + archive + export + upload (~5–10 min; works from Claude Code's shell if the keychain is unlocked). Success = `UPLOAD SUCCEEDED` + a `Delivery UUID`. The script restores `project.pbxproj`/`Info.plist` from backup at the end — `git status` must be clean afterwards.
5. **TestFlight external group:** App Store Connect → TestFlight → External Testing → **"Public Beta"** → Builds → **+** → pick the build. Skip it and the public link says "This beta isn't accepting any new testers".
6. **Android AAB** (after step 4, so `out/` is fresh): `npx cap sync android && cd android && ./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.
7. **Play Console:** Closed testing → Create release → upload AAB → Review release → **Start rollout** (upload alone ships nothing; ~up to 2h to reach testers).
8. **Tag** `v<marketing>-build<N>`, add a row to `PROJECT_STATUS.md` (Delivery UUID), send the "what to test" notes.

### Traps already paid for
- `build:mobile` failing silently behind a `| tail` ships a stale `out/` (build 17). Check the exit code / grep the bundle for the new feature before syncing.
- Local `main` behind `origin/main` (work pushed from another session) → the build ships without it. `git pull --ff-only` before bumping.

---

## Part A — Pre-submission gate

Everything here must be green *before* an archive is uploaded for review.
A rejection cycle costs ~1–3 days of review latency, so the cost of checking
is always lower than the cost of guessing.

### A1 — Hard rejection triggers

| # | Check | Guideline | How to verify |
|---|-------|-----------|---------------|
| 1 | In-app account deletion exists and is **findable** | 5.1.1(v) | `/settings` → `Delete account`, reachable in 1 tap from home (⚙️ beside the avatar). A link buried in a popover menu counts as absent. |
| 2 | No "Coming Soon" / placeholder / disabled-feature UI | 2.1, 4.2 | `grep -rn "Coming Soon\|coming_soon\|Placeholder\|TODO" app components --include="*.tsx"` — comments are fine, **rendered strings are not**. |
| 3 | No price, subscription copy, or external payment link | 3.1.1 | `grep -rniE "7\.99\|€\|/month\|subscribe\|stripe\|checkout\|upgrade to" app components --include="*.tsx"`. Until an IAP exists, **any** displayed price or external purchase path is an automatic rejection. |
| 4 | Sign in with Apple, **if and only if** a third-party social login is enabled | 4.8 | Query the live instance, don't trust memory: `curl -s "https://clerk.climbritz.app/v1/environment?__clerk_api_version=2021-02-05&_clerk_js_version=5.0.0"` → `user_settings.social`. Empty ⇒ 4.8 does not apply. |
| 5 | Privacy policy reachable at a public URL | 5.1.1 | `curl -o /dev/null -w "%{http_code}" https://climbritz.app/privacy` → 200. **Use the apex URL** — `app.climbritz.app` does NOT resolve. |
| 6 | Privacy policy matches what the app actually does | 5.1.1 | It must describe in-app deletion and list exactly what is removed. |

### A2 — Reviewer demo account

- Provision **two** accounts, not one (see Part D, 2026-07-23).
- **Automated:** `backend/scripts/seed_review_accounts.py` creates both Clerk
  users and populates them through the real API (logs across several grades
  and angles, projects, hold classifications), then prints a paste-ready
  credentials block. Idempotent — re-running never mints a third account.

  ```
  CLERK_SECRET_KEY=sk_live_… API_BASE=https://web-production-cea9.up.railway.app \
      python backend/scripts/seed_review_accounts.py --dry-run   # then without --dry-run
  ```

  Pass the secret inline for one shot. Never write it into `backend/.env`.
  The script refuses to run against an `sk_test_` key.
- **Manual:** the video analysis. It needs a real video file and a live
  Gemini round-trip, so upload one per account by hand — a reviewer on an
  account with no completed analysis cannot evaluate the Coach feature.
- Supply credentials in App Store Connect → *App Review Information* (B0.3).
- BLE board control cannot be reviewed without hardware — say so explicitly
  in the review notes so its absence doesn't read as a broken feature.

### A3 — Build hygiene

- `pytest` green, `npx jest` green, `npx tsc --noEmit` clean.
- `NEXT_PUBLIC_MOBILE=true npm run build` — **mandatory**; without the flag
  `next build` emits `.next/` instead of `out/` and `cap sync` silently
  copies nothing, shipping stale assets.
- `npx cap sync ios` + `npx cap sync android`.
- Spot-check that new routes actually reached the native bundle:
  `ls ios/App/App/public/<route>.html android/app/src/main/assets/public/<route>.html`.

---

## Part B0 — App Store Connect metadata

### B0.1 — Third-party trademarks (Guideline 5.2.1)

Climbritz interoperates with the **Kilter Board** (trademark of Setter Closet)
and serves data derived from that ecosystem. That combination invites a 5.2.1
challenge, so pre-empt it rather than answering it after a rejection:

- **Keep the trademark out of the app name.** "Climbritz" — never
  "Climbritz for Kilter Board".
- **Description uses "compatible with" phrasing.** Never possessive
  ("Kilter Board's companion app"), never implied endorsement
  ("official", "partnered", "approved").
- **Non-affiliation disclaimer at the end of the description**, e.g.
  *"Climbritz is an independent app and is not affiliated with, endorsed by,
  or sponsored by Setter Closet or Kilter Board. Kilter Board is a trademark
  of its respective owner."*
- **Raise it first in App Review Notes.** Explain the relationship on your own
  terms in the submission; do not wait to be asked.

### B0.2 — Screenshots

- **Three is the floor, five is better** — the first 3 are what appear in the
  install sheet, so they carry the pitch.
- **Verify the required device size in Media Manager before generating.**
  Apple retires sizes without much notice; a set built against last year's
  spec gets bounced.
- **Screenshots must depict the app as it actually is.** Mocked or
  aspirational UI is a **2.3.3** rejection.

### B0.3 — App Review Notes

**This is the highest-leverage field in the whole submission.** Any core
feature that needs hardware the reviewer does not have must be declared
explicitly, or the reviewer sees a broken feature and closes with 2.1.

For Climbritz that means **BLE board control**:

- Declare it in the notes text.
- Back it with a **screen recording**, uploaded as an *App Review Attachment*.
- Add a **redundant link** to the recording in the notes text itself —
  attachments are occasionally missed.

Also state in the notes: **Deadpoint is a bundled offline HTML5 mini-game (no remote code)** —
`/arcade` loads `public/arcade/deadpoint.html` from the app bundle in an
iframe; nothing is downloaded or executed from a server (Guideline 2.5.2).

Demo account credentials go in this section too — see A2, and generate the
paste-ready block with `backend/scripts/seed_review_accounts.py`.

---

## Part B — Version bump

Four places, all bumped together, then tagged. Skipping the tag is how
build numbers drift (see Part D).

| Location | Field | Notes |
|---|---|---|
| `package.json` | `version` | Marketing version, kept in step with the natives. |
| `android/app/build.gradle` | `versionCode` | **Always +1.** Play Console permanently rejects a re-used code. |
| `android/app/build.gradle` | `versionName` | Marketing version. |
| `ios/App/App.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION` | Build number, +1. **Two occurrences** (Debug + Release) — bump both. |
| `ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` | Marketing version. |

`Info.plist` holds `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)`
variables — edit `project.pbxproj`, never the plist.

Tag every release commit: `git tag v<marketing>-build<N>`.

---

## Part C — Submission

> **Never submit on a Friday.** A rejection sits unactioned over the weekend
> and costs three days instead of one. Submit early in the week.

1. **iOS archive + upload runs from Terminal.app interactively** —
   `bash ~/deploy_climbritz.sh <build>`. Code-signing for distribution needs
   the interactive session's keychain; from a non-interactive shell the
   App Store export fails with `errSecInternalComponent`. Claude Code cannot
   run this step.
2. Android: `./gradlew bundleRelease` → signed AAB at
   `android/app/build/outputs/bundle/release/app-release.aab`. Verify the
   `versionCode` in the merged manifest before uploading.
   **An AAB must be rolled out, not merely uploaded**, for testers to see it.
3. App Store Connect metadata, screenshots and the privacy questionnaire are
   manual. Privacy policy URL: `https://climbritz.app/privacy`.
4. After review passes, tag and push.

---

## Part D — Lessons log

Append-only. Each entry is a rule paid for with real time.

- `2026-07-23` — Phase 0 audit corrected three brief assumptions: Clerk was
  already on a production instance (B021), no social providers were enabled
  so Guideline 4.8 did not apply, and declared SQLite cascades were
  unenforced. **Lesson: audit the live instance state, never the memory of
  it.**
- `2026-07-23` — Reviewer demo accounts must be provisioned in pairs. A
  reviewer testing in-app account deletion will delete the only demo account
  and lock themselves out of a re-review.
- `2026-07-23` — Account deletion must purge out-of-DB artifacts, not just
  rows. Found a pre-existing file leak on the storage volume in the process.
