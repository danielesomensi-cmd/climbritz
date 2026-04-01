# Kilter-Up — Ecosystem Research & Technical Audit
> Date: March 2026
> Purpose: Map existing tools, data sources, and technical feasibility for AI climbing coaching

---

## Core Vision Shift

The project's differentiator is NOT training logging — it's **AI-powered climbing coaching via video analysis**. The pipeline:
1. User uploads video of their climbing attempt on a specific Kilter Board problem
2. System identifies the problem (via search or visual LED recognition)
3. AI analyzes technique with full context (grade, holds, angle, known beta)
4. When available, AI compares with expert reference videos
5. Structured coaching feedback is returned

---

## Kilter Board Ecosystem — Key Findings

### The Official Kilter Board App
- **160,000+ climbs** in the database, set by climbers worldwide
- Each climb has: unique ID, name, setter, grade, angle, layout string (hold positions + roles), star rating, ascent count
- Beta videos are linked as **Instagram URLs** (not YouTube) — stored in the app's local SQLite database
- Hold roles are color-coded: Green = Start, Cyan = Middle, Magenta = Finish, Orange = Foot Only
- Layout format: `p{hold_id}r{role_code}` concatenated string (e.g., `p1083r15p1117r15p1164r12...`)
- The app syncs via Aurora Climbing's undocumented REST API

### BoardLib (Python library)
- **Repo:** https://github.com/lemeryfertitta/BoardLib
- **PyPI:** `pip install boardlib`
- Downloads the full public SQLite database for any Aurora board (Kilter, Tension, etc.)
- Database contains: all climbs, hold placements, holes (x/y coordinates), LED mappings, user-submitted beta video links
- Also exports personal logbook as CSV
- **Critical for us:** We can have the entire Kilter Board climb catalog locally without scraping
- Database is ~189MB with 344k+ climbs (larger than initial ~85MB estimate)
- Command: `boardlib database kilter kilter.db`
- Sync command updates existing DB with latest data

### Database Schema (from reverse engineering)
Key tables in the SQLite database:
- `climbs` — all climb metadata (name, setter, grade, layout string, description)
- `placements` — maps hold_id to hole_id for each board layout
- `holes` — x/y coordinates for each hole position on the board
- `leds` — maps hole_id to LED position (for BLE commands)
- Instagram video links are stored and associated with climbs
- The layout string encodes both position and role of each hold

### Climbdex (Search Engine)
- **Repo:** https://github.com/lemeryfertitta/Climbdex
- Built on BoardLib — adds **filter-by-hold** feature missing from official app
- PWA that works across all Aurora boards
- Has difficulty accuracy filter + minimum ascents filter
- Demonstrates that BoardLib data is rich enough for advanced filtering

### Boardsesh
- **Repo:** https://github.com/marcodejongh/boardsesh
- Open source unified app for Kilter + Tension + Moonboard
- Queue management, real-time collaboration, Party Mode
- Apache licensed — can study their approach to multi-board support

### Climbology / BetaShare
- **Repo:** https://github.com/Rundstedtzz/climbology
- Uses GPT for beta suggestions + Neo4j graph database for hold/move relationships
- PostgreSQL for hold data, React + Django stack
- Interesting approach but no video analysis — all text/data based

### Reverse Engineering Reference
- **Blog:** https://bazun.me/blog/kiterboard
- Detailed walkthrough of decompiling the Kilter Board APK
- Documents the SQLite schema, API auth flow, BLE protocol
- Confirms that ALL climb data + video links are in the local SQLite file

---

## Video Source Analysis

### Instagram (Primary source in official app)
- Beta videos in the Kilter app link to Instagram posts
- **Problem:** Downloading Instagram videos programmatically is against ToS, unreliable, and rate-limited
- **Verdict:** Not viable as primary video source for automated comparison

### YouTube
- Many climbers post Kilter Board beta videos on YouTube with climb names in titles
- YouTube Data API v3: free tier = 10,000 units/day (search = 100 units each = ~100 searches/day)
- `yt-dlp` can download videos for local processing
- **Verdict:** Feasible for popular climbs. Search by climb name + "kilter board" + grade
- **Limitation:** Not every climb has a YouTube video. Coverage is good for popular/benchmark problems, sparse for obscure ones

### Gemini Video Capabilities
- Gemini 2.0 Flash can process full videos via File API (already implemented in our backend)
- Can accept MULTIPLE videos in a single request for comparison
- Can analyze technique: body position, foot placement, momentum, timing
- **Key insight:** Gemini can also analyze still images of the board with LEDs lit to identify hold patterns

---

## Visual Problem Recognition — Feasibility

### Approach: LED Pattern Recognition
- User takes photo/screenshot of Kilter Board with LEDs active
- Gemini identifies colored holds (green/cyan/magenta/yellow) and their approximate positions
- System matches against known climb layouts in the BoardLib database
- User confirms match + provides angle

### Challenges
- Camera angle distortion (photo taken from below, at angle)
- Partial occlusion by climber or other objects
- Color accuracy under gym lighting
- Multiple board sizes/layouts to account for

### Simpler Alternative: Search + Autocomplete
- User types climb name → autocomplete from local BoardLib SQLite DB
- User selects angle from dropdown (or sets a default for their gym)
- Faster, more reliable, zero ML complexity
- Can add visual recognition as enhancement later

### Recommendation
Start with **search/autocomplete** (simpler, reliable). Add visual recognition as Phase 4+ feature. The search approach also works offline with the local SQLite database.

---

## "Expert" Definition Strategy

Since we need to identify "expert" videos for comparison, here's how to define expertise levels:

### Option A: Ascent Data from Database
- Filter users who completed the climb in fewer attempts
- Problems: ascent data is per-user (need auth), attempt count not always reliable

### Option B: Curated Expert List
- Maintain a list of known strong climbers / pro athletes / notable setters
- Filter YouTube results by these channels
- More reliable quality, but limited coverage

### Option C: Grade-Based Heuristic
- If someone posts a clean send video of a V8 and they regularly climb V10+, they're likely demonstrating good technique
- Can infer from YouTube channel content

### Recommendation
Start with **Option B** (curated list of 10-20 known strong Kilter Board climbers on YouTube). Expand with community contributions over time. For MVP, even WITHOUT expert comparison video, the AI coaching from Gemini + climb context data is already valuable.

---

## Target Board Configuration
- **Board:** Kilter Board Original Layout
- **BoardLib board_name:** `kilter`
- **Database command:** `boardlib database kilter kilter.db`

---

## Impact on Architecture

### New Dependencies
- `boardlib` — Python, pip installable, for downloading/syncing Kilter Board database
- YouTube Data API v3 — for searching beta videos (future phase)
- `yt-dlp` — for downloading YouTube videos (future phase)

### New Data Flow
```
BoardLib SQLite DB (local)
    ↓
Climb lookup (by name/search or by hold pattern)
    ↓
Gemini analysis context (grade, angle, hold types, positions)
    +
User's video upload
    ↓
AI Coaching Feedback
```

### Storage
- BoardLib SQLite DB: `backend/data/kilter.db` (gitignored, ~189MB)
- Periodic sync via `boardlib database kilter backend/data/kilter.db`
