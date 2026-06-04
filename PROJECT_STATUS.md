# 📋 CLIMBRITZ — Project Status & Decisions Log

> **Fonte di verità del progetto.** Aggiornata da Claude Code ad ogni decisione importante.
> Leggi questo PRIMA di lavorare. Per il piano forward → `ROADMAP_ACTIVE.md`. Per il "come funziona" → `CLAUDE.md` / `ARCHITECTURE.md`.

> **Ultimo aggiornamento: 4 Giugno 2026** — **B033 design-system** (web, diretto a `main`, 5 fasi): token foundation (`@theme static`) → quick wins (gray→zinc, contrasto AA, history soft-active, crimp→teal, BLE CTA, Clerk sign-in branding) → primitive `components/ui/` + adozione page-by-page → homepage off-inline + orphan tile → typography (Space Grotesk + Inter Tight self-hosted). ComingSoonBadge **droppato**. + B032 launch polish (un solo brand-orange `#ff6b35`, `/classify` IT→EN, account/sign-out homepage, BottomNav su upload/dashboard/videos-detail). + (4 Giu) Release mobile build 10/6 in upload: fix pacing BLE (18ms tra chunk-write, `4fae221`) — board intera sul diagnostico "All LEDs". + (31 Mag) Release mobile pre-Reddit: Android build 9 + iOS build 5. + (30 Mag) B021 Clerk Production + fix Gemini (`thinking_budget=0`). Dettagli sotto.

---

## 📊 STATO ATTUALE

Milestone recenti (più recente in alto). Una riga per voce — il racconto esteso del root-cause sta nei commit + nelle memorie.

| Componente | Status | Note (sintesi) |
|------------|--------|----------------|
| **B033** Design-system (web → `main`, 5 fasi) | ✅ 2026-06-04 | Implementa la spec D018 (`docs/design-audit-2026-06-04/DESIGN-SYSTEM-DRAFT.md`). STOP-gate waived (no utenti attivi); ogni fase shippata indipendente, suite verde (jest 320 / pytest 240). **Fase 1** token foundation: `@theme static` in `globals.css` (forza l'emissione di tutte le var; le utility restano on-demand) — namespace nuovi (surface/text/state/feedback/category/radius/elevation), nessun default Tailwind sovrascritto, quindi il caveat B032 (`:root`-override, vale solo per i ramp built-in tipo `orange-*`) non si applica. Il layer token costruisce SOPRA il `:root`-override orange di B032. **Fase 2** quick wins: gray→zinc (D18-2, ble-test + ClimbBleControls + body bg→surface-base + hero-gradient token); contrasto AA (D18-8) testo near-black `zinc-950` su `orange-500` (~6.8:1, white falliva); history range-picker + pyramid filter → soft-active (D18-3); crimp category off-brand → teal `#0d9488` (`state.ts`); BLE "Light up" off green→brand; Clerk sign-in/up branding (`AuthShell` + `appearance`, no `@clerk/themes`). **Fase 3** primitive `components/ui/` (Button/Chip/Card/PageHeader/EmptyState/LoadingState/StatusDot) + `lib/ble/status.ts` (dedup D18-11) — **ComingSoonBadge droppato**; adozione 1 pagina/commit: ble-test → classify → history → discover(+FilterPanel) → discover/detail (densa, ultima; rimossa la Favorite row disabilitata). **Fase 4** homepage off inline-styles (D18-12) + fix orphan tile (5 tile → last col-span-2). **Fase 5** typography (D18-9/B030): Space Grotesk (display) + Inter Tight (body) via `next/font` self-hosted (10 woff2, NO fetch runtime → Capacitor-offline; fallback metric-matched, no layout shift); scala `text-display/page-title/section/body/label/micro`. |
| **B032** Launch UX polish (web → `main`) | ✅ 2026-06-04 | Bundled fix dal design audit D018. (1) **Un solo brand-orange `#ff6b35`**: il token `kilter-orange` era morto (0 usi) e le utility `orange-*` rendevano `#f97316` (Tailwind) → override del ramp `orange-*` su `:root` in `globals.css` (cascade, deterministico; `@theme` non faceva effetto in questo setup v4) + `--brand-orange` per gli inline-style; rimossi i 37 literal `#FF6B35`; token morto eliminato. (2) `/classify` IT→EN ("Next unclassified") — chiudeva la violazione English-UI mancata da B023. (3) **Account/sign-out in homepage** via Clerk `<UserButton>` top-right (frontend-only). (4) **BottomNav** montata su `/upload`, `/dashboard` (era il target del tab Profile ma senza nav) e `/videos/detail` (+`pb-nav`). Homepage resta launcher senza nav; `/board-map` escluso (non raggiungibile). 4 commit atomici, suite verde (pytest 240 + jest 307), build web OK. Diretto a `main` per verifica Vercel. |
| **Release** Mobile build bump (BLE pacing fix) | 🟡 2026-06-04 (in upload) | Android `versionCode 10` (AAB firmato localmente via `bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`, da caricare sul track **closed testing** di Play Console) + iOS build 6 (`CURRENT_PROJECT_VERSION 5→6` Debug+Release; upload TestFlight via `bash ~/deploy_climbritz.sh 6` da **Terminal.app** — non da Claude Code, vedi runbook). **Build number only**, marketing `1.0.0` invariato. Entrambi portano la fix BLE: **pacing di 18ms tra i chunk-write** (`writeChunks` in `lib/ble/kilter-board-service.ts`, commit `4fae221`) — risolve la board che non si accendeva sul diagnostico "All LEDs" (~78 chunk sparati senza flow-control → drop/timeout). Tag rinviati a upload confermato. |
| **Release** Mobile build bump (pre-Reddit) | ✅ 2026-05-31 | Android `versionCode 9` (tag `android-v1.0.0-build9`, AAB firmato per Play Console Internal Testing) + iOS build 5 (tag `ios-v1.0.0-build5`, upload App Store Connect — delivery UUID `5034ddc5-babb-4d70-9e6f-7c27231f021f`). **Build number only**, marketing `1.0.0` invariato. Entrambi portano: fix analisi video Gemini (`thinking_budget=0`) + rimozione `WKAppBoundDomains` iOS (`f435516`, prima build iOS che la include — la build 4 era archiviata prima). |
| **B021** Clerk Dev→Production + email/password | ✅ Android + iOS — 2026-05-30 | Custom domain `clerk.climbritz.app` (`pk_live`/`sk_live`, JWKS env-driven). Email+password, codice 6-cifre solo al sign-up; Google OAuth/magic-links/Turnstile disattivati. **Bug chiave:** cookie di sessione `SameSite=Lax` su `Domain=climbritz.app` era cross-site con l'origin WebView `https://localhost` → "You are signed out". **Fix:** WebView servita su `app.climbritz.app` (capacitor `server.hostname` + scheme https). **Gotcha iOS:** WKWebView ignora `iosScheme:'https'` → origin reale `capacitor://app.climbritz.app`; `WKAppBoundDomains` **rimosso** (non copre subdomini → bloccava clerk-js). Due allowlist separate (Clerk `allowed_origins` + CORS backend) ciascuna con **entrambi** gli origin per-piattaforma. Runbook completo: `docs/CLERK_CAPACITOR_AUTH.md`. Android build 8 shipped su Play Console Internal Testing; iOS verificato su Xcode debug build. ✅ iOS TestFlight build 5 (con la rimozione di `WKAppBoundDomains`) caricato il 2026-05-31 — vedi riga **Release** sopra. |
| Android build 6/7 | ✅ 2026-05-29 | build4/5 crashavano al launch (`ClassNotFoundException: app.climbritz.MainActivity`) — MainActivity era al package legacy `com.kilterup.app` mentre `namespace = app.climbritz` (AGP 8). Fix: spostato il source. build7: launcher icon Climbritz (da `AppIcon-1024.png` via `@capacitor/assets`). Tag `android-v1.0.0-build6/7`. |
| iOS TestFlight build 3 | ✅ 2026-05-29 | Bundling A023. Delivery UUID `ef01e812-…`. Export-compliance auto-risolto (`ITSAppUsesNonExemptEncryption=false`). App-specific password ora stabile e riusata in `~/deploy_climbritz.sh`. Tag `ios-v1.0.0-build3`. Verificato end-to-end su iPhone (Import JSON + persistenza reload). |
| Android build 4/5 AAB | ✅ 2026-05-22 / 28 | build4 (B031): primo AAB firmato a parità con iOS. build5: primo con A022+A023. Firmati con `~/kilter-up-release.keystore` via `android/keystore.properties` (gitignored). Distribuiti via GitHub Release / Google Drive. |
| **A023** Hold classification cloud sync | ✅ 2026-05-28 | `/classify` da localStorage → tabella per-utente `user_hold_classifications` (alembic 005, FK→users CASCADE, unique `(user_id, placement_id)`, no x/y). Surface Clerk-gated `/api/classifications` (GET/PUT/DELETE/POST-import merge). Hydration dal backend (localStorage = write-through cache), upsert/delete ottimistici, growth banners, Send-export + Import-JSON. STOP gate onorato. Per-utente; aggregazione canonica = HC-7 futuro. |
| **A022** Benchmark filter | ✅ 2026-05-26 | Toggle "Benchmarks only" in `FilterPanel`. `benchmark` param → `AND cs.benchmark_difficulty IS NOT NULL` su `_build_search_filters()`. **Angle-specific by design.** Phase 0.5 audit: 93.4% dei 412 benchmark sono tali a ≤3 angoli. Fixtures via `seed_a022_test_fixtures.py`. |
| **B020** Discover search cap → 500 | ✅ on-device 2026-05-11 | `limit` default 500, hard cap 500. Response envelope `{climbs, total_count}`; banner overflow quando `total_count > climbs.length`. `count_matching_climbs` condivide `_build_search_filters()`. `ClimbCard` in `React.memo`. Risolve il bug Next/Prev che si fermava a 30. |
| **A021** Climb logging + history (Phases 1–5) | ✅ Vercel-live | Tabelle `climb_logs` + `user_climbs` (alembic 004). Endpoint `/api/logs`, `/api/user-climbs`, `/api/stats`. Overlay `user_state` su search + chip Done/Project. `/history`: calendario heatmap (no lib), sessions list, pyramid + trend (Recharts). `X-User-Timezone` su tutte le richieste auth. |
| **B014 + iter** BLE LED presets | ✅ gym-validated | Auto-apply su tap (200ms debounce), write serializzate via promise-chain. 11 preset pixel-art + #11 stress test (476 LED). |
| **A014/A015** Nav + BLE su Discover | ✅ | BottomNav universale; `ClimbBleControls` su `/discover/detail` (connect → illumina); Next/Prev con auto-send (300ms debounce); `filtered-list-storage` (sessionStorage 24h). |
| **B017** Discovery UX | ✅ | Tap-target Prev/Next ingranditi; safe-area sweep (`.pt-safe`/`.pb-safe`/`.pb-nav` in `safe-area.css`); persistenza filtri in sessionStorage; bottone Filters prominente con badge. |
| **A019** Move count filter | ✅ | Chip Moves (Any/≤5/6–7/8–10/>10). `moves` param → SQL su `(cyan_holds + 2)`. Sequenze animate (`frames_count > 1`) escluse globalmente. |
| **A020** Clerk auth | ✅ web + Android + iOS | Sostituisce custom-JWT. JWKS verify backend, `users` = shadow row. AuthGuard client-side (no middleware, Clerk issue #4647). A019.16: tutte le pagine richiedono login eccetto `/sign-in`, `/sign-up`, `/privacy`, `/debug`. |
| **Sprint #1** (B022–B027) + B021 Coach Coming Soon | ✅ 2026-05-19 | 6 fix dall'audit D017 (dev banner, traduzioni IT→EN, blue→orange, chip outline, /history polish, Project/Active label). BottomNav 5→4 slot, Coach tile con pill COMING SOON, CTA Coach rimossa da detail. `/upload` resta URL-reachable. |
| Backend / Auth / Video / Gemini | ✅ | FastAPI + Clerk JWKS + pipeline video. SQLite. `google.genai`, gemini-2.5-flash, prompt Kilter-specific (B007+B008). **Fix 2026-05-30:** `thinking_budget=0` — il thinking dinamico di 2.5-flash saturava `max_output_tokens` su video reali → JSON troncato/vuoto → analisi `failed`. Vedi PROBLEMI RISOLTI #5. |
| BoardLib DB / Climb endpoints | ✅ Phase 3a+3b | search/detail/stats, fixture DB di test. |
| Deploy | ✅ Partial | Backend live su Railway (SQLite + kilter.db auto-download). Frontend su Vercel. PostgreSQL + S3 ancora TODO (Phase 7). |
| Training logs (Phase 6) | ⏳ Da fare | — |

> Storia completa pre-A020 + dettagli archiviati: `docs/archive/`. Audit D017: `docs/audit-2026-05-19/AUDIT_REPORT.md`.

---

## 🎯 CORE STRATEGY

One product, two tiers — **Discovery** (free: search by grip type, AI session builder, problem generation, BLE, attempt logging) + **Coach** (€7.99/mese: video → analisi tecnica AI con contesto climb).

**Key asset:** database di classificazione holds (ogni hold taggato per grip type). Prerequisito per Discovery, nessun competitor ce l'ha.

**Coach — 3 livelli:** L1 solo-video ✅ working · L2 contestuale (+ dati BoardLib) 🎯 Phase 3d · L3 confronto con video expert 🔮 Phase 5.

Dettagli: `RESEARCH.md` (ecosystem), `ROADMAP_ACTIVE.md` (piano), `CLAUDE.md` (strategy table).

---

## 🔑 CREDENZIALI & CONFIG

| Variabile | Valore | Note |
|-----------|--------|------|
| `GEMINI_API_KEY` | in `.env` ✅ | Google AI Studio |
| `DATABASE_URL` | `sqlite:///./kilter.db` | Dev locale |
| `CLERK_JWKS_URL` / `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | in `.env` ✅ | Backend Clerk (JWKS richiesto in prod — startup guard). Valori in `backend/.env` / `.env.local`, non committati. `CLERK_PUBLISHABLE_KEY` anche come `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend). |
| `UPLOAD_DIR` | `uploads/` | Locale |
| GitHub | `danielesomensi-cmd/climbritz` | Main repo |
| **Android keystore** | `~/kilter-up-release.keystore` ⚠️ | Path **legacy** (precede il rename Kilter Up → Climbritz). Wired via `android/keystore.properties` (gitignored). Vedi memoria `reference_android_keystore`. |
| iOS deploy | `~/deploy_climbritz.sh N` | App-specific password stabile (riusata). Vedi `docs/IOS_DEPLOY_RUNBOOK.md`. |

---

## ✅ DECISIONI ARCHITETTURALI

1. **Gemini 2.5 Flash** (non MediaPipe/YOLO) — zero ML training, capisce il contesto climbing, ~$0.001/video. MediaPipe/YOLO eventualmente in futuro per accuracy.
2. **Gemini File API, non frame-by-frame** — upload del video intero UNA volta + UNA chiamata. Frame-by-frame = rate limit del free tier (15 req/min). Pattern non-negoziabile.
3. **FastAPI + SQLite (dev) / PostgreSQL (prod)** — backend Python (ML ecosystem). UUID come `String(36)` per compatibilità SQLite↔Postgres.
4. **Video = async** — upload → 202 → BackgroundTask → polling. **NO Celery/Redis** (troppa complessità per MVP, BackgroundTasks basta).
5. **Storage locale (dev) → S3 (prod)**.
6. **BoardLib** per i dati Kilter (non scraping custom) — DB SQLite ufficiale, ~189MB, gitignored, sync incrementale.
7. **Search-first** per identificare i climb (autocomplete), non vision-first. Riconoscimento visivo LED = Phase 4 enhancement (PoC validato Apr 2026, secondo PoC richiesto prima del codice).
8. **3-Level analysis** costruita incrementalmente (L1→L2→L3), ognuno indipendentemente valido.
9. **Sequenze animate escluse da Discovery search** (`frames_count = 1`) — la formula moves `(cyan+2)` non si applica ai circuit e la BLE bar manda un solo frame statico. Circuits = Phase 8+ (B019).
10. **Clerk per l'identità** — outsource sign-in/MFA/OAuth/password-reset/email-verification. Backend verifica il JWT via JWKS; `users` = shadow row (id + clerk_id). `@clerk/clerk-react` SPA-mode (non `@clerk/nextjs`, incompatibile con `output: 'export'`). Route gating client-side via `useAuth()`. Origin/cookie gotchas: `docs/CLERK_CAPACITOR_AUTH.md`.

---

## 🐛 PROBLEMI RISOLTI (non ripeterli)

1. **Frame-by-frame = rate limit** (Feb 2026) → Gemini File API (un upload + una chiamata). Vedi decisione #2.
2. **PostgreSQL UUID su macOS dev** (Feb 2026) → SQLite per dev (`String(36)`), Postgres per prod.
3. **Capacitor "Failed to fetch" — CORS origin mismatch** (Apr 2026) → la WebView Android manda `Origin: https://localhost`; servono **tutti e tre** gli origin Capacitor nel CORS (`capacitor://localhost` iOS, `http://localhost` dev, `https://localhost` Android). File: `backend/app/main.py`. Diagnosticato via `/debug`.
4. **Clerk prod "You are signed out" su WebView** (Mag 2026) → cookie `SameSite=Lax` cross-site con `https://localhost`; fix servendo la WebView su `app.climbritz.app`. Per-platform origin gotcha iOS. Vedi B021 sopra + `docs/CLERK_CAPACITOR_AUTH.md`.
5. **Analisi video falliva silenziosamente** (Mag 2026) → `gemini-2.5-flash` fa "dynamic thinking" di default e quei token contano dentro `max_output_tokens` (8192); su un video reale il ragionamento visivo saturava il budget → JSON troncato/vuoto (`finish_reason=MAX_TOKENS`) → `_background_analyze` metteva `processing_status="failed"`. Sintomo: upload OK, analisi no. **Fix:** `thinking_config=ThinkingConfig(thinking_budget=0)` (tutto il budget al JSON) + guard su `response.text is None`. Validato su 2 video Kilter reali (`finish_reason=STOP`, JSON completo). File: `backend/app/services/gemini_service.py`. Memoria: `project_gemini_thinking_budget`. Se in futuro si passa a Gemini 3.x flash, ri-verificare il comportamento del thinking-disable su quella famiglia.

---

## 📋 BACKLOG — Technical Debt

| Item | Priority | Note |
|------|----------|------|
| Recreate API_SPECIFICATION.md / DATABASE_SCHEMA.sql | After Phase 3 | Archiviati (outdated) in `docs/archive/` |
| PostgreSQL su Railway | Phase 7 | Ora SQLite |
| S3 per video storage | Phase 7 | Ora filesystem locale |
| Auth su `/api/climbs/search` | Low | Endpoint accetta GET nudi; pagine già AuthGuard-gated. Spostare a `apiFetch` (Bearer) se emerge abuso. |
| Retry/backoff su Gemini 503/429 | Low | Ora fallisce subito su errori transienti |
| B018 repo-hygiene pre/post-task checks | Queued | Verificare `git status` + branch a inizio task |

✅ Done: migrazione `google.generativeai` → `google.genai` (B003), API key → pydantic Settings (B003), deploy Vercel, A020 Clerk.

---

## 🗺️ ROADMAP (sintesi)

Phase 1 ✅ · Phase 2 ✅ · Pre-Phase 3 Hold Classification [HC-1✅ HC-2✅ HC-3⏳ HC-5✅ HC-6⏳ HC-7⏳, HC-4 rimosso] · Phase 3 Discovery+Coach [3a✅ 3b✅ frontend✅ BLE✅ — 3c→3h pending] · Phase 3.5 Soft Launch ⏳ · Phase 4 Visual Recognition ⏳ · Phase 5 Expert Comparison ⏳ · Phase 6 Training Logs ⏳ · Phase 7 Deploy & Polish ⏳

Dettaglio completo: `ROADMAP_ACTIVE.md`.

---

## 🧪 RUN (dev)

```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && alembic upgrade head
uvicorn app.main:app --reload --port 8001
# Frontend
npm run dev          # porta 3000
# Test
cd backend && pytest -v
```

Struttura repo completa: `CLAUDE.md`.

---

## 📌 REGOLE PER CLAUDE CODE

1. Leggi questo file PRIMA di iniziare.
2. Gemini File API per i video (NON frame-by-frame).
3. NO Celery/Redis — usa FastAPI BackgroundTasks.
4. Secrets solo in `.env`.
5. NON rompere l'auth Clerk esistente.
6. Test (pytest) obbligatori per ogni endpoint.
7. Commit piccoli e descrittivi dopo ogni feature.

*Creato da Claude Code — 22 Febbraio 2026 · Aggiornato: 30 Maggio 2026*
