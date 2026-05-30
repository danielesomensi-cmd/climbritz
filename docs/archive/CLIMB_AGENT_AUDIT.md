# Climb-Agent Audit — Reusable Patterns for Climbritz

> **Audited:** 2026-03-31
> **climb-agent path:** ~/Projects/climb-agent
> **Climbritz path:** ~/Projects/climbritz
> **Type:** D004 (Read-Only Audit)

## Executive Summary

The climb-agent repo has mature developer tooling that Climbritz lacks: automated counter synchronization (`sync_status.py`), pre-push hook enforcement, a lessons-learned log (`docs/lessons.md`), repo hygiene checks, and a roadmap trimming script. The FastAPI architecture is structurally similar to Climbritz's, but climb-agent has a richer dependency injection layer (subscription guard, user resolution chain), a global exception handler, and a modular storage abstraction (file ↔ Supabase swap via env var). The most immediately portable items are the developer tooling scripts, the lessons.md pattern, and the global exception handler — all low-effort, high-value additions to Climbritz.

---

## Quick Wins (Easy + High Priority)

| Pattern | Source File(s) | What It Does | Effort to Port |
|---------|---------------|--------------|----------------|
| **Lessons learned log** | `docs/lessons.md` | Append-only file for non-obvious learnings; YYYY-MM-DD + brief-ID format | ~5 min — create file, add convention to CLAUDE.md |
| **Global exception handler** | `backend/api/main.py` (lines 89-96) | Catches all unhandled exceptions, logs traceback, returns generic 500 | ~10 min — add to Climbritz's `main.py` |
| **Pre-push hook (counter sync)** | `.githooks/pre-push` | Blocks push if doc counters are stale; runs `sync_status.py` | ~30 min — adapt for Climbritz's simpler counter set |
| **Repo hygiene script** | `scripts/repo_hygiene.py` | Read-only diagnostic: stale docs, bloat, .DS_Store, large files | ~1 hr — adapt checks for Climbritz file structure |
| **Health check with persistence marker** | `backend/api/main.py` `/health` endpoint | Checks DATA_DIR writability, counts users, tests persistence survival | ~20 min — enhance Climbritz's existing `/health` |
| **.gitignore refinements** | `.gitignore` | Surgical ignores with `!` exceptions for tracked assets; `.claude/commands/` tracked | ~10 min — review and merge patterns |

## Medium Effort (Worth Doing Soon)

| Pattern | Source File(s) | What It Does | Effort to Port |
|---------|---------------|--------------|----------------|
| **Counter sync script** | `scripts/sync_status.py` | Auto-updates test count, endpoint count, page count in PROJECT_BRIEF, README, CLAUDE.md via `<!-- STATUS_TABLE -->` markers | ~2 hr — adapt counters for Climbritz's stack |
| **Roadmap trimming** | `scripts/trim_roadmap.py` | Archives completed roadmap items (strikethrough rows) to history file; `--dry-run` mode | ~1.5 hr — adapt for ROADMAP_ACTIVE.md format |
| **Storage abstraction layer** | `backend/engine/storage.py`, `storage_file.py`, `storage_supabase.py` | Swap persistence backends via `STORAGE_BACKEND` env var; sys.modules replacement pattern | ~3 hr — useful when Climbritz moves to S3 |
| **Subscription guard pattern** | `backend/engine/subscription_guard.py` | Environment-aware feature gating: bypasses in dev/test, enforces in prod; `Depends()` integration | ~2 hr — reusable for any feature-flag or paywall |
| **Test isolation fixture** | `backend/tests/*.py` (autouse pattern) | `monkeypatch` + `tmp_path` per-test isolation; prevents cross-test contamination | ~1 hr — adapt for Climbritz's SQLAlchemy test DB |
| **Lifespan context manager** | `backend/api/main.py` (lines 68-71) | Validates DATA_DIR writable on startup before accepting requests | ~15 min — add startup checks to Climbritz |
| **Vocabulary governance doc** | `docs/vocabulary_v1.md` | Canonical closed-set definitions for all enums; new values must be added here first | ~1 hr — create for Climbritz's domain terms |
| **CLAUDE.md execution model** | `CLAUDE.md` | High-risk module list with mandatory analysis phase + STOP gate before implementation | ~30 min — adapt for Climbritz's critical modules |

## Longer Term (Nice to Have)

| Pattern | Source File(s) | What It Does | Effort to Port |
|---------|---------------|--------------|----------------|
| **Audit snapshot extractor** | `scripts/extract_audit_snapshot.py` (65KB) | Generates 12-section markdown of production state; falls back local → API | ~4 hr — domain-specific; adapt for video analysis state |
| **Cluster-based exercise grouping** | `backend/engine/cluster_utils.py` | Normalizes attributes to stable keys for caching/tracking | ~1 hr — useful if Climbritz adds exercise recommendations |
| **Schema registry + validation** | `backend/engine/schema_registry.py`, `validate_log_entry.py` | JSON Schema Draft 7 validation with `$ref` resolution; dual-mode CLI + library | ~2 hr — useful for validating Gemini API responses |
| **Typed API client with retry** | `frontend/src/lib/api.ts` | Generic `request<T>()` wrapper with Clerk auth + single-retry on 401 | ~1 hr — reference for Climbritz's frontend API layer |
| **Versioned catalog structure** | `backend/catalog/{type}/v1/*.json` | `v1/` subdirectories allow future schema migrations without breaking code | ~30 min — adopt convention for any future catalog data |

---

## Detailed Findings

### 1. Repo Hygiene & Developer Tooling

#### `scripts/repo_hygiene.py`
- **What:** Read-only diagnostic checking for stale docs, roadmap bloat, .DS_Store, large untracked files, brief frequency since last audit
- **Checks:** Completed briefs (scans for CLOSED/FINAL/COMPLETED markers), ROADMAP >350 lines, unexpected root files (against whitelist), tracked .DS_Store via `git ls-files`, files >500KB, brief count since `LAST_AUDIT_DATE`
- **Invocation:** Manual, every ~10 briefs or ~2 weeks
- **Portability:** Easy — adapt file whitelist and paths for Climbritz
- **Priority:** Medium — prevents gradual repo decay

#### `.githooks/pre-push`
- **What:** Bash hook that runs `sync_status.py` before every push; blocks push if counters changed (forces commit of sync changes first)
- **Setup:** One-time `git config core.hooksPath .githooks`
- **Implementation:** Activates venv → runs sync → checks `git diff --quiet` → blocks if dirty
- **Portability:** Easy — same pattern, different sync script
- **Priority:** High — prevents stale documentation from reaching remote

#### `scripts/sync_status.py`
- **What:** Auto-updates counter tables in PROJECT_BRIEF.md, README.md, CLAUDE.md using `<!-- STATUS_TABLE_START/END -->` markers
- **Counts collected:** Tests (pytest --collect-only), exercises, sessions, templates, API endpoints (regex on decorators), frontend pages, frontend components
- **Safety:** Aborts if non-sync files are uncommitted; whitelists only PROJECT_BRIEF.md and README.md
- **Validation:** Cross-checks vocabulary doc template lists against filesystem; verifies CLAUDE.md endpoint table matches declared total
- **Portability:** Medium — needs adaptation for Climbritz's different counters (videos, users, endpoints)
- **Priority:** High — eliminates manual counter drift

#### `scripts/trim_roadmap.py`
- **What:** Archives completed roadmap items (rows with `~~strikethrough~~`) from ROADMAP_CURRENT.md to ROADMAP_v2.md
- **Features:** `--dry-run` mode, dated archive headers, empty section collapse
- **Portability:** Easy — same markdown table format
- **Priority:** Medium — useful once ROADMAP_ACTIVE.md accumulates >20 items

#### `docs/lessons.md`
- **What:** Append-only file for non-obvious patterns and mistakes; format: `[YYYY-MM-DD] [BRIEF-ID]: One-line lesson`
- **Current entries (4):** gym_id propagation bug, production debugging flow, diagnostic script hardcoding, wrong key paths in state
- **Portability:** Trivial — create file, add convention
- **Priority:** High — prevents repeat mistakes across conversations

#### Linting & Formatting
- **Python:** No linting config (no ruff, black, isort, mypy in pyproject.toml) — relies on code review
- **Frontend:** ESLint flat config extending `next/core-web-vitals` + `next/typescript`; no Prettier
- **No Makefile, editorconfig, or CI/CD pipelines** — all commands documented in CLAUDE.md
- **Portability:** N/A for Python linting (Climbritz already has its own setup)
- **Priority:** Low — Climbritz's existing setup is adequate

#### `.claude/settings.json` & `.claude/settings.local.json`
- **What:** Base permissions (Read-only) + extended local permissions (82 whitelisted: git, pytest, WebFetch, specific domains)
- **Portability:** Easy — reference for structuring Climbritz's Claude Code permissions
- **Priority:** Low — nice-to-have for permission hygiene

---

### 2. Test Infrastructure

#### Test Organization
- **Location:** `backend/tests/` — 87 test files, ~1,542 test functions
- **Naming convention:** Feature tests (`test_a121_exercise_ordering.py`, `test_b101_gym_id_propagation.py`), system tests (`test_api.py`, `test_multiuser.py`), engine tests (`test_planner_v2.py`, `test_macrocycle_v1.py`), unit tests (`test_grade_arithmetic.py`, `test_conversions.py`)
- **No explicit unit/integration/e2e directories** — all flat in `backend/tests/`
- **Portability:** Medium — naming convention by brief ID is useful for traceability
- **Priority:** Low — Climbritz already has test structure

#### `conftest.py`
- **What:** Minimal (8 lines) — only adds repo root to sys.path for imports
- **No global fixtures** — fixtures defined inline per test file
- **Portability:** N/A — Climbritz's conftest.py is already more comprehensive (DB fixtures, auth helpers)
- **Priority:** Low

#### Test Isolation Pattern (Most Valuable)
```python
@pytest.fixture(autouse=True)
def isolate_state(tmp_path, monkeypatch):
    tmp_state = tmp_path / "user_state.json"
    shutil.copy2(REAL_STATE_PATH, tmp_state)
    monkeypatch.setattr(storage, "STATE_PATH", tmp_state)
    yield tmp_state
```
- **What:** Each test gets a fresh copy of state in `tmp_path`; monkeypatches storage module
- **Portability:** Medium — pattern translates to Climbritz's SQLAlchemy test DB isolation
- **Priority:** Medium — good reference for strengthening test isolation

#### Mocking Patterns
- **External APIs:** `unittest.mock.patch("stripe.Webhook.construct_event")` for Stripe
- **Storage:** monkeypatch `backend.engine.storage` module paths
- **Auth:** X-User-ID header fallback (no JWT verification when `CLERK_JWKS_URL` not set)
- **No coverage config** in pyproject.toml — manual `pytest --cov` possible
- **Portability:** Easy — same mock.patch patterns apply to Gemini API mocking
- **Priority:** Medium

#### Test Fixture Files
- `backend/tests/fixtures/test_user_state.json` — sample state
- `backend/tests/fixtures/log_good.json`, `log_invalid_*.json` — validation test data
- **Portability:** Easy — create fixture files for Climbritz's video analysis responses
- **Priority:** Medium

---

### 3. FastAPI Architecture

#### Project Structure
```
backend/
├── api/
│   ├── main.py           # App creation, middleware, health, lifespan
│   ├── deps.py           # Dependency injection (user resolution, state, subscriptions)
│   ├── auth.py           # Clerk JWT verification
│   ├── models.py         # Pydantic request/response models (237 lines)
│   └── routers/          # 18 routers (state, onboarding, assessment, macrocycle, ...)
├── engine/               # Business logic (planner, replanner, progression, ...)
├── catalog/              # Versioned data (exercises, sessions, templates)
├── data/                 # Runtime data (user state, logs, schemas)
└── tests/                # 87 test files
```
- **Portability:** High — same FastAPI structure, Climbritz already uses similar layout
- **Priority:** Medium — compare and adopt missing patterns

#### Dependency Injection (`deps.py`)
- **User ID resolution chain:** Clerk JWT → X-User-ID header → None (with graceful fallback)
- **State management:** `load_state(user_id)` / `save_state(state, user_id)` with auto-migration
- **Subscription guard:** `Depends(require_active_subscription)` on mutation endpoints → raises 402
- **Date helpers:** `ensure_monday()`, `next_monday()`, `this_monday()`, `current_phase_and_week()`
- **Cache invalidation:** `invalidate_week_cache()` (current+future), `invalidate_future_week_cache()` (future only)
- **Portability:** Medium — user resolution chain and subscription guard patterns are directly reusable
- **Priority:** Medium

#### Error Handling
- **Global exception handler:** Catches all unhandled exceptions, logs with `logger.exception()`, returns 500
- **Per-endpoint:** `HTTPException` with status codes 400, 402, 404, 409, 422, 500
- **No custom exception classes** — uses FastAPI's built-in HTTPException
- **Portability:** Easy — add global handler to Climbritz's main.py
- **Priority:** High

#### Middleware
- **CORS:** localhost:3000 + Vercel production origin; credentials, all methods, all headers
- **No request logging middleware**
- **No timing middleware**
- **Portability:** Easy — Climbritz already has CORS; no new middleware to port
- **Priority:** Low

#### Health Check
```python
@app.get("/health")
def health():
    return {
        "status": "ok",
        "data_dir": str(DATA_DIR),
        "data_dir_from_env": "DATA_DIR" in os.environ,
        "ephemeral_warning": is_ephemeral,
        "users_count": users_count,
        "persistence_marker_survived": not marker_fresh,
    }
```
- **Persistence marker:** Written once, checked on subsequent requests — proves volume survives redeployment
- **Portability:** Easy — enhance Climbritz's `/health` with persistence check
- **Priority:** High for Railway deployment

#### Router Mounting
- 18 routers via `app.include_router()`
- Stripe webhook mounted directly on `app` (not via router) to preserve raw body for signature verification
- **Portability:** Already using same pattern in Climbritz
- **Priority:** Low

---

### 4. Database & Migrations

#### Storage Abstraction (Key Pattern)
```python
# storage.py — dispatches based on env var
_BACKEND = os.environ.get("STORAGE_BACKEND", "file")
if _BACKEND == "supabase":
    import backend.engine.storage_supabase as _impl
else:
    import backend.engine.storage_file as _impl
sys.modules[__name__] = _impl
```
- **File backend:** JSON/JSONL on disk (per-user directories)
- **Supabase backend:** Postgres JSONB (users, session_logs, outdoor_logs, event_logs tables)
- **Portability:** Medium — useful when Climbritz migrates from SQLite to Postgres/S3
- **Priority:** Medium (aligns with Phase 3+ S3 migration)

#### No Alembic
- climb-agent uses file-based state (JSON), not relational DB with migrations
- State schema versioned via `schema_version` field in JSON (currently 1.5)
- Auto-migrations happen in `load_state()` (e.g., `_migrate_gym_ids()`)
- **Portability:** N/A — Climbritz already uses Alembic properly
- **Priority:** N/A

#### Schema Registry (`backend/engine/schema_registry.py`)
- Loads JSON Schema Draft 7 from `backend/data/schemas/` directory
- Caches schemas; supports `$ref` resolution
- Used for validating session logs, outdoor sessions, exercise outcomes
- **Portability:** Medium — useful for validating Gemini API response structure
- **Priority:** Low (Climbritz already does JSON repair on Gemini responses)

#### `validate_log_entry.py`
- Dual-mode: standalone CLI script + importable module
- Validates against JSON Schema with error collection (returns list of errors, not exceptions)
- CLI modes: `--file`, `--json`, `--jsonl`
- **Portability:** Easy — reusable validation pattern
- **Priority:** Low

---

### 5. Configuration & Environment

#### No Pydantic Settings
- Configuration via direct `os.environ.get()` calls throughout codebase
- No centralized Settings class
- **Portability:** N/A — Climbritz already uses Pydantic Settings (better pattern)
- **Priority:** N/A

#### Environment Variables
| Variable | Purpose | Climbritz Equivalent |
|----------|---------|---------------------|
| `STORAGE_BACKEND` | file / supabase | `DATABASE_URL` |
| `DATA_DIR` | Persistent data path | N/A (uses DB) |
| `CLERK_JWKS_URL` | Auth provider JWKS | `SECRET_KEY` (JWT) |
| `STRIPE_SECRET_KEY` | Payments | N/A (not yet) |
| `SUPABASE_URL` | Database URL | `DATABASE_URL` |
| `ADMIN_SECRET` | Internal admin key | Could adopt |

- **Portability:** Easy — `ADMIN_SECRET` pattern useful for Climbritz admin endpoints
- **Priority:** Low

#### Multi-Environment Support
- **Dev:** File backend, X-User-ID header, no Stripe/Clerk
- **Prod:** Supabase, Clerk JWT, Stripe webhooks
- Env-driven switching (no separate config files)
- **Portability:** Already similar in Climbritz (SQLite dev / Railway prod)
- **Priority:** Low

---

### 6. Logging & Observability

#### Logging Setup
- Per-module loggers via `logging.getLogger(__name__)`
- No structured logging (no structlog, python-json-logger)
- No centralized configuration; all logs to stdout
- No rotating file handlers
- **Portability:** N/A — both projects use same basic pattern
- **Priority:** Low

#### Request/Response Logging
- **None** — no middleware for request logging
- Unhandled exceptions logged with method + path in global handler
- Stripe webhook logs environment diagnostics (storage_backend, key status)
- **Portability:** N/A
- **Priority:** Low

#### Health Check Observability
- Persistence marker test (survive redeployment check)
- Ephemeral filesystem detection
- User count
- **Portability:** Easy — add to Climbritz's `/health`
- **Priority:** Medium

#### No Performance Monitoring
- No timing decorators, no request latency tracking
- `user_state_mtime()` returns file modification time for cache validation
- **Portability:** N/A
- **Priority:** Low

---

### 7. Deployment & DevOps

#### Railway Configuration
```json
// railway.json
{
  "build": {"builder": "NIXPACKS"},
  "deploy": {
    "startCommand": "uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "sleepApplication": false
  }
}
```
```
# Procfile
web: uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT
```
- **No Docker** — uses NIXPACKS auto-detection
- **No docker-compose** — local dev runs directly with uvicorn
- **Portability:** Already using same Railway setup in Climbritz
- **Priority:** Low

#### Startup Validation (Lifespan)
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    _check_data_dir()  # Validate persistence on startup
    yield
```
- Checks DATA_DIR writable before accepting requests
- **Portability:** Easy — add startup checks (DB connectivity, upload dir) to Climbritz
- **Priority:** Medium

#### Frontend: Vercel
- Auto-deploy on push to main; root: `frontend/`
- **Portability:** Same pattern available for Climbritz's Next.js frontend
- **Priority:** Low (Climbritz frontend deployment not yet active)

---

### 8. Documentation Patterns

#### Doc Structure
| File | Purpose |
|------|---------|
| `README.md` | Project overview + auto-updated status table |
| `CLAUDE.md` | Developer handbook: role, principles, commands, high-risk gates, deployment |
| `PROJECT_BRIEF.md` | Current status + architecture (auto-updated counters) |
| `docs/vocabulary_v1.md` | Canonical enums (closed-set governance) |
| `docs/ROADMAP_CURRENT.md` | Active work items (auto-trimmed) |
| `docs/ROADMAP_v2.md` | Archived history (auto-appended) |
| `docs/ENGINE_ARCHITECTURE.md` | Implementation reference |
| `docs/DESIGN_GOAL_MACROCICLO_v1.1.md` | Methodology & rationale |
| `docs/lessons.md` | Accumulated learnings |
| `docs/audit_workflow.md` | Literature audit SOP |

- **Naming:** Descriptive names, version suffixes for evolving docs
- **No ADRs** — decisions captured in CLAUDE.md and PROJECT_BRIEF.md
- **API docs:** Auto-generated by FastAPI (Swagger/ReDoc at `/docs`, `/redoc`)
- **Portability:** Medium — adopt vocabulary doc and lessons log patterns
- **Priority:** Medium

#### CLAUDE.md Execution Model (High Value)
- **High-risk module list:** Explicit files requiring mandatory analysis phase + STOP gate
- **Three-phase protocol:** Phase 1 (Analysis) → STOP (wait for OK) → Phase 2 (Implementation) → Phase 3 (Verification)
- **Model switching suggestion:** Recommend Opus for high-risk briefs (decision always developer's)
- **Portability:** Easy — add high-risk module list to Climbritz's CLAUDE.md
- **Priority:** Medium — useful as Climbritz grows in complexity

---

### 9. Anything Else Interesting

#### Equipment Expansion Rules (`backend/engine/equipment_utils.py`)
- Centralized implication rules: board surfaces → `gym_boulder`, weight subtypes → `weight`
- Used by planner, resolver, replanner — single source of truth
- **Portability:** Domain-specific but pattern is reusable for any taxonomy with implications
- **Priority:** Low

#### Closed-Loop Adaptation (`backend/engine/adaptation/closed_loop.py`)
- Multiplier-based progression: difficulty feedback → percentage adjustment → clamped to [0.85, 1.15]
- Streak tracking (consecutive hard/fail)
- Cooldown clusters: fail/too_hard → 2-day cooldown for exercise cluster
- **Portability:** Hard — deeply domain-specific to training periodization
- **Priority:** Low (Climbritz focuses on form analysis, not training planning)

#### Cluster Grouping (`backend/engine/cluster_utils.py`)
- Normalizes exercise attributes to stable string keys: `domain=X|role=Y|eq=Z|pattern=W`
- Utility functions: `norm_str()`, `sorted_join()`, `parse_date()` (robust ISO parsing)
- **Portability:** Easy — generic utility functions are reusable
- **Priority:** Low

#### Typed Frontend API Client (`frontend/src/lib/api.ts`)
- Generic `request<T>()` with Clerk auth token injection
- Single retry on 401 with 500ms delay (B155 finding)
- SSR-aware (`typeof window`)
- **Portability:** Medium — good reference for Climbritz's frontend API layer
- **Priority:** Low (Climbritz frontend not yet mature)

#### Versioned Catalog (`backend/catalog/{type}/v1/`)
- Exercises, sessions, templates, cues in versioned subdirectories
- Allows future schema migrations without breaking code
- **Portability:** Easy — adopt convention for any structured data
- **Priority:** Low

#### Brief-Based Development Workflow
- Each task has a brief ID (A=feature, B=bug, C=chore, D=audit)
- Commits reference brief ID: `B169: fix gym_id propagation`
- Tests named by brief: `test_b101_gym_id_propagation.py`
- **Portability:** Easy — already partially adopted in Climbritz (B001, B003, D004)
- **Priority:** Low — already in use

---

## Patterns NOT Worth Porting

| Pattern | Why Not |
|---------|---------|
| **File-based state storage** | Climbritz uses SQLAlchemy + PostgreSQL — proper relational DB is better |
| **sys.modules replacement for storage dispatch** | Clever but fragile; dependency injection via FastAPI `Depends()` is cleaner |
| **No linting/type-checking config** | Climbritz should have stricter tooling, not less |
| **Italian-language responses** | climb-agent specific preference |
| **Macrocycle/planner/replanner engine** | Deeply domain-specific to training periodization |
| **Closed-loop adaptation multipliers** | Domain-specific to progressive overload |
| **Equipment expansion rules** | Domain-specific to climbing equipment taxonomy |
| **Extract audit snapshot script** | 65KB script tightly coupled to climb-agent's engine architecture |
| **No centralized Settings class** | Climbritz's Pydantic Settings is the better pattern |
| **Flat test directory (no unit/integration split)** | Climbritz benefits from organized test categories |

---

## Recommended Next Steps

1. **Create `docs/lessons.md`** in Climbritz — start accumulating learnings immediately (5 min)
2. **Add global exception handler** to `backend/app/main.py` — catches unhandled errors with proper logging (10 min)
3. **Enhance `/health` endpoint** — add persistence marker check, upload dir writability test (20 min)
4. **Add lifespan startup validation** — verify DB connectivity and upload directory before accepting requests (15 min)
5. **Create high-risk module list** in CLAUDE.md — identify Climbritz modules requiring analysis-first protocol (30 min)
6. **Set up `.githooks/pre-push`** — enforce test pass before push (adapt for `pytest` in Climbritz) (30 min)
7. **Create `scripts/sync_status.py`** — auto-update test count, endpoint count in docs (2 hr)
8. **Create `scripts/repo_hygiene.py`** — adapt for Climbritz's file structure (1 hr)
9. **Create `docs/vocabulary.md`** — canonical terms for analysis types, feedback levels, video states (1 hr)
10. **Evaluate storage abstraction** — plan for S3 migration using env-driven backend switching (when Phase 3 starts)
