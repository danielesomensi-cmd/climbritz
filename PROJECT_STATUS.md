# 📋 KILTER-UP — Project Status & Decisions Log

> **Questo file è la fonte di verità del progetto.**
> Aggiornato da Sam ogni volta che si prende una decisione importante.
> Leggi questo PRIMA di fare qualsiasi cosa sul progetto.

---

## 🗓️ Ultimo Aggiornamento: 30 Marzo 2026

---

## 📊 STATO ATTUALE

| Componente | Status | Note |
|------------|--------|------|
| Backend FastAPI | ✅ Done | Auth JWT + video pipeline, SQLite, Python 3.11 |
| Auth (JWT) | ✅ Done | Register, login, /me |
| VideoUpload model | ✅ Done | Consolidated — form_analysis JSON, processing_status |
| Gemini Video Service | ✅ Done | File API, lazy init, gemini-2.0-flash |
| Video endpoints | ✅ Done | POST upload (202), GET /{id}, GET list, DELETE |
| Alembic migrations | ✅ Done | 001 (initial) + 002 (form analysis) — single head |
| Tests | ✅ Done | 46 passed, 5 skipped (DB-dependent) |
| Frontend upload UI | ✅ Done | Drag-drop, progress bar, mobile-first |
| B001 Cleanup | ✅ Done | Removed v1/v2 duplication, dead code, broken imports |
| BoardLib integration | ⏳ Da fare | Phase 3 — climb search, contextual analysis |
| Training logs | ⏳ Da fare | Phase 6 |
| Deploy (Railway) | ✅ Partial | Backend live on Railway (SQLite), Alembic in startCommand. Frontend + PostgreSQL + S3 still TODO |

---

## 🎯 CORE STRATEGY (Updated March 2026)

The project has evolved from video analysis to **AI Climbing Coach**.

3-LEVEL INTELLIGENCE SYSTEM:
- Level 1: Solo video analysis (Gemini analyzes your technique) — ✅ WORKING
- Level 2: Contextual analysis (your video + climb data from BoardLib DB) — 🎯 NEXT
- Level 3: Expert comparison (your video vs expert beta video) — 🔮 FUTURE

VIDEO = CORE. But now enriched with Kilter Board data (160k+ climbs, grades, holds, angles).
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
| GitHub | `OpenClawDani/kilter-training-app` | Main repo |

---

## 🐛 PROBLEMI RISOLTI (non ripetere gli errori!)

### ❌ PROBLEMA 1: Frame-by-frame analysis = rate limit
**Quando:** Day 3 planning (19-21 Feb 2026)
**Problema:** Il piano originale mandava ogni frame del video come immagine separata a Gemini. 30 secondi di video @ 1 FPS = 30 API calls → rate limit del free tier (15 req/min) → 2 minuti di attesa.
**Soluzione:** ✅ **Gemini File API** — upload il video intero UNA volta, poi UNA sola chiamata a Gemini con `file_data`. Gemini elabora internamente tutti i frame.

**Implementazione corretta:**
```python
import google.generativeai as genai

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

### 1. Gemini 2.0 Flash (non MediaPipe/YOLO)
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
- Database is ~85MB, stored locally (gitignored)
- No need to reverse engineer Aurora Climbing API ourselves
- Sync command updates DB incrementally

### 7. Search-first for Climb Identification (not vision-first)
**Decision:** Users search/select climbs by name with autocomplete as primary flow. Visual LED recognition is a future enhancement.
**Why:**
- Simpler, more reliable, works offline
- BoardLib DB enables fast local search
- Visual recognition has too many edge cases for MVP (lighting, angle, occlusion)
- Can add visual recognition in Phase 4 without changing core flow

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
| Migrate `google.generativeai` → `google.genai` | Medium | FutureWarning on import. Package is deprecated. |
| `gemini_service.py` API key → pydantic Settings | Low | Uses `os.getenv()` instead of `Settings` object |
| Recreate API_SPECIFICATION.md | After Phase 3 | Archived — was heavily outdated |
| Recreate DATABASE_SCHEMA.sql | After Phase 3 | Archived — was heavily outdated |
| Frontend deploy to Vercel | Phase 7 | Backend is live, frontend still local |
| PostgreSQL on Railway | Phase 7 | Currently using SQLite on Railway |

---

## 🗺️ ROADMAP

### ✅ Phase 1 — Foundation (Done)
### ✅ Phase 2 — Video Analysis (Done)
### 🎯 Phase 3 — BoardLib Integration + Climb Context (NEXT)
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
│   │   │   └── circuits.py         ✅ Stub for BoardLib
│   │   ├── models/
│   │   │   ├── user.py             ✅
│   │   │   └── video.py            ✅ Consolidated model
│   │   ├── schemas/
│   │   │   ├── user.py, auth.py    ✅
│   │   │   └── video.py            ✅ VideoResponse, FormFeedbackResponse
│   │   ├── services/
│   │   │   ├── auth_service.py     ✅
│   │   │   ├── gemini_service.py   ✅ File API, lazy init
│   │   │   ├── video_service.py    ✅ ffmpeg utils
│   │   │   └── storage_service.py  ✅ Local filesystem
│   │   ├── utils/
│   │   │   └── kilter_parser.py    ✅ Layout parser for BoardLib
│   │   ├── core/                   ✅ config, database, security, deps
│   │   └── main.py                 ✅
│   ├── alembic/versions/           ✅ 001 + 002 (single head)
│   ├── tests/                      ✅ 46 passed
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

*Creato da Sam — 22 Febbraio 2026 | Aggiornato: 30 Marzo 2026*
*Aggiorna questo file ogni volta che prendi una decisione importante!*
