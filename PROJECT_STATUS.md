# 📋 KILTER-UP — Project Status & Decisions Log

> **Questo file è la fonte di verità del progetto.**
> Aggiornato da Claude Code ogni volta che si prende una decisione importante.
> Leggi questo PRIMA di fare qualsiasi cosa sul progetto.

---

## 🗓️ Ultimo Aggiornamento: 9 Aprile 2026

---

## 📊 STATO ATTUALE

| Componente | Status | Note |
|------------|--------|------|
| Backend FastAPI | ✅ Done | Auth JWT + video pipeline, SQLite, Python 3.11 |
| Auth (JWT) | ✅ Done | Register, login, /me |
| VideoUpload model | ✅ Done | Consolidated — form_analysis JSON, processing_status |
| Gemini Video Service | ✅ Done | google.genai SDK, lazy init, gemini-2.5-flash, Kilter Board-specific prompt (B007+B008) |
| Video endpoints | ✅ Done | POST upload (202), GET /{id}, GET list, DELETE |
| Climb endpoints | ✅ Done | GET search, GET detail, GET stats (Phase 3b) |
| BoardLib DB | ✅ Done | 344k+ climbs, climb_service.py, test fixture DB |
| Alembic migrations | ✅ Done | 001 (initial) + 002 (form analysis) — single head |
| Tests | ✅ Done | 177 backend + 92 frontend passing, CI on GitHub Actions |
| Frontend upload UI | ✅ Done | Drag-drop, progress bar, mobile-first |
| Discovery frontend | ✅ Done | A011 — `/discover` (search + filters) + `/discover/[uuid]` (board viz). B016 — hollow rings for active holds, screw-on footholds smaller, kickboard row visible. Grip-type filter wired but disabled. |
| B001 Cleanup | ✅ Done | Removed v1/v2 duplication, dead code, broken imports |
| BoardLib integration | ✅ Phase 3a+3b | DB setup + search/detail API. Phase 3d (Level 2 analysis) next |
| Training logs | ⏳ Da fare | Phase 6 |
| Deploy (Railway) | ✅ Partial | Backend live on Railway (SQLite + kilter.db via boardlib auto-download, B013). Frontend + PostgreSQL + S3 still TODO |

---

## 🎯 CORE STRATEGY (Updated April 2026)

**One product, two tiers:**

| Tier | Name | What it does | Price |
|------|------|-------------|-------|
| **Free** | Discovery | Search 160k+ climbs by grip type, AI session builder, problem generation, BLE board connection, attempt logging | Free |
| **Paid** | Coach | Video upload → AI technique analysis with climb context, move-by-move coaching, training suggestions | €7.99/month |

**Key asset:** Proprietary hold classification database — every hold on the Kilter Board tagged by grip type (jug, good crimp, crimp, sloper, undercling, pinch). No competitor has this. Prerequisite for Discovery.

**BLE in scope:** Capacitor wraps Next.js for a native iOS/Android app. BLE connection (Phase 3e) enables lighting up the board directly from the app — unique feature.

**Coach intelligence — 3-level system:**
- Level 1: Solo video analysis (Gemini analyzes your technique) — ✅ WORKING
- Level 2: Contextual analysis (your video + climb data from BoardLib DB) — 🎯 Phase 3d
- Level 3: Expert comparison (your video vs expert beta video) — 🔮 Phase 5

See RESEARCH.md for full ecosystem audit.
See ROADMAP_ACTIVE.md for detailed implementation plan.

---

## 🔑 CREDENZIALI & CONFIG

| Variabile | Valore | Note |
|-----------|--------|------|
| `GEMINI_API_KEY` | Già in `.env` ✅ | AIzaSyCB... |
| `DATABASE_URL` | `sqlite:///./kilter.db` | Dev locale |
| `JWT_SECRET` | Già in `.env` ✅ | Generato |
| `UPLOAD_DIR` | `uploads/` | Locale |
| GitHub | `danielesomensi-cmd/kilter-up` | Main repo |

---

## 🐛 PROBLEMI RISOLTI (non ripetere gli errori!)

### ❌ PROBLEMA 1: Frame-by-frame analysis = rate limit
**Quando:** Day 3 planning (19-21 Feb 2026)
**Problema:** Il piano originale mandava ogni frame del video come immagine separata a Gemini. 30 secondi di video @ 1 FPS = 30 API calls → rate limit del free tier (15 req/min) → 2 minuti di attesa.
**Soluzione:** ✅ **Gemini File API** — upload il video intero UNA volta, poi UNA sola chiamata a Gemini con `file_data`. Gemini elabora internamente tutti i frame.

**Implementazione corretta (pattern File API — architettura ancora valida):**
> **Nota storica:** Il codice sotto usa il vecchio SDK `google.generativeai` e il modello `gemini-2.0-flash`, entrambi deprecati. Il codebase attuale usa `google.genai` SDK con `gemini-2.5-flash` (migrato in B003). Il *pattern* (File API, un'unica chiamata) è corretto.

```python
import google.generativeai as genai  # ← deprecato, ora: from google import genai

# Step 1: Upload video (una volta)
video_file = genai.upload_file(path="climbing_video.mp4")

# Step 2: Aspetta che il file sia processato
while video_file.state.name == "PROCESSING":
    video_file = genai.get_file(video_file.name)

# Step 3: UNA sola chiamata di analisi
model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content([
    video_file,
    "Analizza la tecnica di arrampicata in questo video..."
])
```

**DON'T DO THIS:**
```python
# ❌ SBAGLIATO - frame per frame
for frame in frames:
    response = genai.generate_content([frame, prompt])  # 30 API calls!
```

---

### ❌ PROBLEMA 2: PostgreSQL → SQLite migration
**Quando:** Day 2 sprint (19 Feb 2026)
**Problema:** Setup iniziale con PostgreSQL aveva problemi di compatibilità UUID su macOS dev.
**Soluzione:** ✅ Switchato a SQLite per dev locale (String(36) per UUID), PostgreSQL per production.
**File:** `backend/app/models/user.py`, `backend/app/models/video.py`

---

## ✅ DECISIONI ARCHITETTURALI PRESE

### 1. Gemini 2.5 Flash (non MediaPipe/YOLO)
**Decisione:** Usare Gemini Vision API per MVP invece di MediaPipe + YOLO.
**Perché:**
- Zero ML training richiesto → MVP più veloce
- Gemini capisce il contesto climbing senza dataset custom
- MediaPipe/YOLO possono essere aggiunti in Phase 2 per accuracy
- Costo irrisorio: ~$0.001 per video analizzato

### 2. FastAPI + SQLite (dev) / PostgreSQL (prod)
**Decisione:** Backend Python perché l'ML ecosystem è Python-first.
**Perché:** MediaPipe, YOLO, google-generativeai sono tutti Python.

### 3. Video = async processing
**Decisione:** Upload video → 202 Accepted → job in background → polling status.
**Perché:** Video processing può durare 10-30 secondi, non bloccare la UI.

### 4. Storage: Locale (dev) → S3 (prod)
**Decisione:** Local filesystem per dev, S3 per production.
**Perché:** Semplicità dev, scalabilità prod.

### 5. NO Celery/Redis per MVP
**Decisione:** Background task con FastAPI `BackgroundTasks` (built-in), non Celery.
**Perché:** Celery aggiunge complessità (Redis dependency). FastAPI BackgroundTasks è sufficiente per MVP.

### 6. BoardLib for Kilter Board Data (not custom scraping)
**Decision:** Use BoardLib Python library to download the official Kilter Board SQLite database locally.
**Why:**
- Gives us 160k+ climbs with full metadata (grade, holds, angle, ascents)
- Open source, pip installable, maintained
- Database is ~189MB, stored locally (gitignored)
- No need to reverse engineer Aurora Climbing API ourselves
- Sync command updates DB incrementally

### 7. Search-first for Climb Identification (not vision-first)
**Decision:** Users search/select climbs by name with autocomplete as primary flow. Visual LED recognition is a Phase 4 enhancement.
**Why:**
- Simpler, more reliable, works offline
- BoardLib DB enables fast local search
- Can add visual recognition in Phase 4 without changing core flow

**PoC Update (April 2026):** Manual PoC validated that Gemini 2.5 Flash can detect LEDs from a non-ideal Instagram gym photo. Start/finish holds (green/magenta) detected reliably. Cyan middle holds harder (can miss or hallucinate). Approach under evaluation: count physical holds from board edges (distortion-resistant) vs percentage-based positioning (vulnerable to camera angle). **Phase 4 is now a validated concept, pending second PoC.** See ROADMAP_ACTIVE.md Phase 4 and D005 Q4 for reverse-lookup matching strategy.

### 8. 3-Level Analysis Architecture
**Decision:** Build intelligence incrementally — solo analysis → contextual → comparison.
**Why:**
- Level 1 already works (Gemini + video)
- Level 2 only requires BoardLib integration (no external video sources)
- Level 3 depends on video availability (YouTube/Instagram) — decouple from MVP
- Each level is independently valuable

---

## 📋 BACKLOG — Technical Debt

| Item | Priority | Notes |
|------|----------|-------|
| ~~Migrate `google.generativeai` → `google.genai`~~ | ✅ Done | B003 — migrated to google.genai SDK + gemini-2.5-flash |
| ~~`gemini_service.py` API key → pydantic Settings~~ | ✅ Done | B003 — reads from `get_settings().gemini_api_key` |
| Recreate API_SPECIFICATION.md | After Phase 3 | Archived — was heavily outdated |
| Recreate DATABASE_SCHEMA.sql | After Phase 3 | Archived — was heavily outdated |
| ~~Frontend deploy to Vercel~~ | ✅ Done | kilter-up-coach.vercel.app |
| PostgreSQL on Railway | Phase 7 | Currently using SQLite on Railway |

---

## 🗺️ ROADMAP

### ✅ Phase 1 — Foundation (Done)
### ✅ Phase 2 — Video Analysis (Done)
### 🎯 Pre-Phase 3 — Hold Classification HC-1→HC-7 [IN PROGRESS — HC-1✅ HC-2✅ HC-3⏳ HC-5✅ HC-6⏳ HC-7⏳] (HC-4 removed — manual classification via `/classify` UI)
### 🎯 Phase 3 — Discovery + Coach Build (3a✅ 3b✅ A011 frontend✅ 3c→3h pending)
### ⏳ Phase 3.5 — Soft Launch (Discovery free → Coach paid)
### ⏳ Phase 4 — Visual Problem Recognition
### ⏳ Phase 5 — Expert Video Comparison
### ⏳ Phase 6 — Training Logs + Progress
### ⏳ Phase 7 — Deploy & Polish

See ROADMAP_ACTIVE.md for full details.

---

## 📁 STRUTTURA REPOSITORY

```
kilter-training-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py             ✅ JWT auth (register, login, /me)
│   │   │   ├── videos.py           ✅ Upload, list, get, delete + background analysis
│   │   │   ├── climbs.py           ✅ Search, detail, stats (Phase 3b)
│   │   │   └── circuits.py         ✅ Stub (legacy)
│   │   ├── models/
│   │   │   ├── user.py             ✅
│   │   │   └── video.py            ✅ Consolidated model
│   │   ├── schemas/
│   │   │   ├── user.py, auth.py    ✅
│   │   │   ├── video.py            ✅ VideoResponse, FormFeedbackResponse
│   │   │   └── climb.py            ✅ ClimbSearchResult, ClimbDetail
│   │   ├── services/
│   │   │   ├── auth_service.py     ✅
│   │   │   ├── gemini_service.py   ✅ File API, lazy init
│   │   │   ├── climb_service.py    ✅ Read-only BoardLib DB queries
│   │   │   ├── video_service.py    ✅ ffmpeg utils
│   │   │   └── storage_service.py  ✅ Local filesystem
│   │   ├── utils/
│   │   │   └── kilter_parser.py    ✅ Layout parser for BoardLib
│   │   ├── core/                   ✅ config, database, security, deps
│   │   └── main.py                 ✅
│   ├── alembic/versions/           ✅ 001 + 002 (single head)
│   ├── tests/                      ✅ 136 passing
│   ├── conftest.py                 ✅ In-memory SQLite fixtures
│   ├── requirements.txt            ✅
│   └── .env                        (gitignored)
├── app/ (Next.js 14 frontend)
│   ├── upload/page.tsx             ✅ Drag-drop upload
│   ├── login/page.tsx              ✅
│   └── ...
├── docs/archive/                   Historical sprint docs
├── CLAUDE.md                       ✅ Dev guidelines
├── PROJECT_STATUS.md               ✅ This file
├── ROADMAP_ACTIVE.md               ✅ Phase plan
└── RESEARCH.md                     ✅ Ecosystem audit
```

---

## 🧪 COME FARE GIRARE IL PROGETTO (dev)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8001

# Frontend
npm run dev  # porta 3000

# Test backend
cd backend && pytest -v
```

---

## 📌 REGOLE PER CLAUDE CODE

1. **Leggi questo file PRIMA di iniziare qualsiasi task**
2. **Usa Gemini File API** per video (NON frame-by-frame)
3. **NON aggiungere Celery/Redis** — usa FastAPI BackgroundTasks
4. **NON mettere secrets nel codice** — tutto in `.env`
5. **NON rompere auth esistente** — funziona, non toccarla
6. **Scrivi test** — pytest obbligatorio per ogni nuovo endpoint
7. **Commit piccoli e descrittivi** dopo ogni feature funzionante

---

*Creato da Claude Code — 22 Febbraio 2026 | Aggiornato: 6 Aprile 2026*
*Aggiorna questo file ogni volta che prendi una decisione importante!*
