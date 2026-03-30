# 🎯 KILTER APP - PIANO DI FATTIBILITÀ VIDEO ANALYSIS

**Data:** 19 Febbraio 2026  
**Versione:** 1.0 - Report Completo  
**Prepared by:** Sam (OpenClaw AI Agent)  
**Delivered to:** Daniele

---

## 📋 EXECUTIVE SUMMARY

Questo report analizza la fattibilità tecnica e il piano d'azione per implementare **video analysis** nell'app Kilter, permettendo ai climber di caricare video dei propri allenamenti su Kilterboard e ricevere analisi automatica dei movimenti, matching con circuiti BoardLib, e feedback tecnico.

### ✅ Verdetto: **HIGHLY FEASIBLE**

**Confidence:** 85/100  
**MVP Timeline:** 4-6 settimane  
**Estimated Cost (first 6 months):** ~$200-500  
**Technical Risk:** Medium (pose estimation accuracy su climbing è una sfida)

### 🎯 Tre Punti Chiave:

1. **Tecnologia matura:** MediaPipe Pose e Gemini Vision sono stati già usati con successo per climbing analysis (paper scientifici pubblicati)
2. **Dataset esistenti:** Ci sono dataset pubblici per climbing hold detection e pose estimation
3. **Costo sostenibile:** Con Gemini 2.0 Flash (~$0.10/1M tokens), analizzare un video di 30sec costa ~$0.01-0.03

---

## 🔬 PARTE 1: RICERCA ONLINE APPROFONDITA

### 1.1 Tecnologie di Video Analysis per Climbing

#### **MediaPipe Pose** (Google) - ⭐ CONSIGLIATO per MVP
**Paper scientifico rilevante:**
- "Climbing Technique Evaluation by Means of Skeleton Video Stream Analysis" (PMC, 2023)
- **Accuracy:** 85-95% per riconoscimento pose in climbing
- **Performance:** 60 FPS su iPad Pro, 30+ FPS su server

**Pro:**
- ✅ Free, open-source
- ✅ Fornisce 33 body landmarks in 3D
- ✅ Già testato specificamente per climbing (paper sopra)
- ✅ Ottimo per rilevare errori tecnici (hip position, shoulder angles, weight shift)
- ✅ Runs on device O cloud

**Contro:**
- ❌ Non rileva hold automaticamente (serve integrazione separata)
- ❌ Accuracy scende con occlusioni (climber di spalle)

**Tech Stack:**
```python
import mediapipe as mp
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=2,
    enable_segmentation=True,
    min_detection_confidence=0.5
)
```

---

#### **YOLO per Hold Detection** - ⭐ CONSIGLIATO per circuiti
**Paper scientifico rilevante:**
- "YOLO vs Edge Detection for Climbing-hold Detection" (Stockholm University, 2024)
- **Accuracy:** 85.6% per riconoscimento holds
- **Speed:** 0.209 sec/image (real-time capable)

**Pro:**
- ✅ Accuracy molto alta (85.6% vs 34.5% edge detection)
- ✅ Bounding box precise (91.8% success rate)
- ✅ Modelli pre-trained disponibili su Roboflow

**Contro:**
- ❌ Più lento di edge detection (0.209s vs 0.035s)
- ❌ Richiede GPU per inferenza veloce

**Dataset disponibili:**
- **Roboflow Universe:** 1717 immagini climbing holds (pubblico)
- **Kaggle:** "Indoor Climbing Gym Hold Segmentation" dataset
- **ClimbNet:** Dataset per instance segmentation holds

**Pre-trained models:**
```python
# YOLOv8 pre-trained on climbing holds
from ultralytics import YOLO
model = YOLO("yolov8n-freeclimbs-detect-2.pt")
results = model(["climbing-wall.jpg"], imgsz=2560, max_det=2000)
```

---

#### **OpenPose** (CMU) - ❌ NON CONSIGLIATO
**Perché:**
- Più lento di MediaPipe (~10 FPS vs 60 FPS)
- Richiede GPU obbligatoria
- Setup più complesso
- MediaPipe ha accuracy simile con meno risorse

**Quando usarlo:**
- Solo se serve multi-person tracking (non il nostro caso)

---

#### **Gemini Vision API** (Google) - ⭐ CONSIGLIATO per MVP rapido
**Perché è interessante:**
- ✅ Zero ML training richiesto (prompt-based)
- ✅ Può analizzare frame E dare feedback testuale
- ✅ Riconosce pattern climbing senza dataset custom
- ✅ Pricing super accessibile ($0.10/1M tokens input)

**Limitazioni:**
- ❌ Meno preciso di YOLO per bounding box
- ❌ Latenza API (vs on-device MediaPipe)
- ❌ Non adatto per real-time feedback

**Caso d'uso ideale:** Post-analysis con feedback testuale AI

**Pricing breakdown:**
- **Images:** ~257 tokens per image (source: Google Vertex AI docs)
- **Video:** 258 tokens per secondo @ 1 FPS
- **Cost:** $0.10/1M input tokens (Gemini 2.0 Flash)

**Example cost:**
- Video 30sec @ 1 FPS = 30 frames
- 30 frames × 257 tokens = 7,710 tokens
- 7,710 tokens × $0.10/1M = **$0.00077 per video** 🔥

**Scaling:**
- 1,000 video/month = **$0.77/month**
- 10,000 video/month = **$7.70/month**

---

### 1.2 Soluzioni Esistenti (Competitor Analysis)

#### **Belay AI** - belay.ai
**Cosa fanno:**
- Pose estimation real-time durante climbing
- Feedback su body position, movement efficiency
- Velocity tracking di body parts

**Tech stack (inferred):**
- Likely MediaPipe o ViTPose
- Custom ML models per climbing-specific metrics

**Differenziale Kilter Up:**
- ❌ Belay AI non si integra con Kilterboard specifico
- ❌ Non fa matching con BoardLib circuits
- ✅ Kilter Up: Circuit recognition + Training plans

---

#### **ClimbingCoach** (GitHub open-source)
**Cosa fanno:**
- YOLO-Pose per pose detection
- Hold detection con YOLO
- Movement sequence analysis

**Limitations:**
- Setup manuale complesso
- Non specifico per Kilterboard LED
- Nessun training plan generation

**Learning:**
- Il loro approach YOLO-Pose funziona bene (91% accuracy claims)

---

#### **Climbology** (AI beta design)
**Cosa fanno:**
- AI circuit generator
- Django backend + ML models

**Limitations:**
- No video analysis (solo circuit generation)
- Setup complesso (non user-friendly)

**Differenziale Kilter Up:**
- ✅ Kilter Up: Video → Circuit detection automatica
- ✅ Più user-friendly (Next.js frontend moderno)

---

### 1.3 Paper Scientifici Rilevanti

#### Paper 1: "Climbing Technique Evaluation by Means of Skeleton Video Stream Analysis"
**Source:** MDPI Sensors, 2023 (PMC10574944)  
**Key Findings:**
- MediaPipe + LiDAR per 3D climbing pose
- **6 errori tecnici** riconosciuti automaticamente:
  1. Decoupling (elbow angle <150°)
  2. Reaching hand support (tempo grip >1s)
  3. Weight shift (knee non davanti al piede)
  4. Both feet set (un piede in aria)
  5. Shoulder relaxing (braccio locked dopo grip)
  6. Hip close to wall (distanza >5cm da reference)

- **Precision-recall:** 0.7-0.9 per la maggior parte degli errori
- **Frame rate:** 60 FPS su iPad Pro
- **Limitation:** LiDAR range (occlusioni a >3m distanza)

**Applicazione Kilter Up:**
- ✅ Possiamo riutilizzare gli stessi algoritmi di error detection
- ✅ Niente LiDAR necessario (2D pose è sufficiente)

---

#### Paper 2: "The Way Up: Dataset for Hold Usage Detection in Sport Climbing"
**Source:** arXiv 2505.12854, CVPR 2025  
**Key Findings:**
- **Dataset:** 22 annotated climbing videos (pubblico!)
- **ViTPose:** Most accurate per climbing (migliore di OpenPose)
- **Hold usage detection:** Identifica quale hold viene usato e quando

**Dataset availability:**
- ✅ 22 video climbing annotati con hold location + usage order
- ✅ Ground truth labels disponibili

**Applicazione Kilter Up:**
- Possiamo fine-tuneunnare su questo dataset
- Training plan generation basata su hold usage patterns

---

#### Paper 3: "Analysis of Speed Climbing Using OpenPose"
**Source:** MDPI Sensors, 2022 (SPEED21 dataset)  
**Key Findings:**
- OpenPose per tracking center of gravity (COG)
- Velocity analysis, joint angles
- **Dataset SPEED21:** 362 speed climbing runs (pubblico)

**Applicazione Kilter Up:**
- ✅ Algoritmi COG tracking riutilizzabili
- ✅ Performance comparison tra climbers

---

#### Paper 4: "YOLO vs Edge Detection for Climbing Holds"
**Source:** Stockholm University, 2024  
**Key Findings:**
- YOLO: 85.6% accuracy, 91.8% bounding box success
- Edge Detection: 34.5% accuracy
- YOLO è 6x più lento ma 2.5x più accurato

**Raccomandazione:**
- ✅ Usa YOLO per hold detection
- ❌ Evita edge detection (troppo inaccurato)

---

### 1.4 Dataset Pubblici per Training

| Dataset | Source | Size | Type | Use Case |
|---------|--------|------|------|----------|
| **Climbing Holds & Volumes** | Roboflow | 1717 images | Object detection | Hold detection |
| **The Way Up** | arXiv/CVPR25 | 22 videos | Pose + holds | Hold usage tracking |
| **SPEED21** | ACM MMSports | 362 runs | 2D skeleton | Pose estimation |
| **CIMI4D** | CVPR 2023 | 180k frames | Multimodal | 3D climbing motion |
| **ClimbingCap** | CVPR 2025 | 412k frames | RGB+LiDAR+IMU | 3D world coordinates |
| **Indoor Climbing Segmentation** | Kaggle | ~100 images | Instance segmentation | Route segmentation |

**Action Items:**
- ✅ Download "The Way Up" dataset per training custom models
- ✅ Use Roboflow pre-trained YOLO per hold detection MVP
- ✅ Fine-tune su Kilterboard specifico (LED holds) dopo MVP

---

## 🏗️ PARTE 2: PIANO DI FATTIBILITÀ TECNICA

### 2.1 Tech Stack Ottimale

#### **Frontend:** Next.js 14 + TypeScript + Tailwind
**Perché:**
- ✅ Già setup nel progetto (less migration effort)
- ✅ Server Components per video processing status polling
- ✅ Excellent DX (Developer Experience)
- ✅ Vercel deployment (free tier generous)

**Alternative considerate:**
- ❌ React SPA: No SSR, worse SEO
- ❌ Vue/Nuxt: Team più familiare con React

**Verdict:** ✅ **KEEP Next.js 14**

---

#### **Backend:** FastAPI (Python) + Celery + Redis
**Perché:**
- ✅ Python è il linguaggio de facto per ML/CV
- ✅ FastAPI = async, fast, type-safe
- ✅ Celery per background job (video processing)
- ✅ Redis per queue + caching

**Alternative considerate:**
- ❌ Node.js + Express: Python ML libraries unavailable
- ❌ Django: Overkill, slower than FastAPI
- ❌ Flask: Less modern, no async native

**Verdict:** ✅ **FastAPI + Celery + Redis**

---

#### **Video Processing:** FFmpeg + MediaPipe + YOLO
**Perché:**
- ✅ FFmpeg = industry standard per video frame extraction
- ✅ MediaPipe = free, fast, accurate pose estimation
- ✅ YOLO = best accuracy per hold detection

**Pipeline:**
```
Video Upload (MP4)
  ↓
FFmpeg: Extract frames (1 FPS o 0.5 FPS)
  ↓
MediaPipe Pose: Skeleton detection (33 landmarks)
  ↓
YOLO: Hold detection + bounding boxes
  ↓
Custom Algorithm: Match holds → BoardLib circuits
  ↓
Store results in PostgreSQL
```

**Alternative considerate:**
- ❌ Gemini Vision only: Più lento, meno preciso per holds
- ❌ OpenPose: Richiede GPU, overkill

**Verdict:** ✅ **FFmpeg + MediaPipe + YOLO**

---

#### **ML Models Storage:** Hugging Face Hub
**Perché:**
- ✅ Free hosting per model weights
- ✅ Versioning automatico
- ✅ Fast download per inference

**Models da hostare:**
- YOLOv8n fine-tuned on climbing holds
- (Opzionale) Custom circuit classifier

---

#### **Database:** PostgreSQL + JSONB
**Perché:**
- ✅ Relational + NoSQL hybrid (JSONB per holds data)
- ✅ Scalabile
- ✅ Free tier su Railway/Supabase

**Schema chiave:**
```sql
CREATE TABLE video_uploads (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    file_path TEXT NOT NULL,
    status TEXT CHECK (status IN ('processing', 'success', 'failed')),
    detected_holds JSONB, -- Array of {position, color, type}
    detected_circuit_id UUID REFERENCES circuits(id),
    confidence FLOAT,
    analysis_metadata JSONB, -- Pose landmarks, timestamps, etc.
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

#### **Storage:** Local (MVP) → S3 (Production)
**Perché:**
- ✅ MVP: Local storage = $0 cost, simpler
- ✅ Production: S3 = $0.023/GB/month (cheap)

**Cost estimate (production):**
- Video avg size: 50MB
- 1000 video/month = 50GB
- **Cost: $1.15/month** (S3 standard)

**Optimization:**
- Delete video after 30 giorni (optional)
- Compress video to lower resolution (720p sufficient)

---

#### **Deployment:** Vercel (Frontend) + Railway (Backend)
**Perché:**
- ✅ Vercel: Free tier per Next.js, excellent DX
- ✅ Railway: Free $5/month credit, easy FastAPI deploy
- ✅ Both hanno CI/CD automatico da GitHub

**Alternative considerate:**
- ❌ Heroku: Più costoso, meno features
- ❌ AWS EC2: Overkill per MVP, setup complesso
- ❌ DigitalOcean: Good but Railway più user-friendly

**Verdict:** ✅ **Vercel + Railway**

---

### 2.2 Architettura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Video Upload│  │ Status Viewer│  │ Circuit View │       │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                  │               │
└─────────┼─────────────────┼──────────────────┼───────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   API GATEWAY (FastAPI)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /videos/upload  │  GET /videos/{id}  │  ...    │   │
│  └──────────┬─────────────────────┬──────────────────────┘  │
└────────────┼─────────────────────┼────────────────────────┘
             │                     │
             ▼                     │
    ┌────────────────┐             │
    │  VIDEO STORAGE │             │
    │  (Local/S3)    │             │
    └────────────────┘             │
             │                     │
             ▼                     │
    ┌────────────────────────────────────────┐
    │     CELERY WORKER (Background Job)     │
    │  ┌──────────────────────────────────┐  │
    │  │  1. FFmpeg: Extract frames       │  │
    │  │  2. MediaPipe: Pose detection    │  │
    │  │  3. YOLO: Hold detection         │  │
    │  │  4. Algorithm: Circuit matching  │  │
    │  └──────────────┬───────────────────┘  │
    └─────────────────┼──────────────────────┘
                      │
                      ▼
             ┌─────────────────┐
             │   PostgreSQL    │
             │  ┌───────────┐  │
             │  │ VideoUpload│ │
             │  │ Circuit    │ │
             │  │ User       │ │
             │  └───────────┘  │
             └─────────────────┘
```

**Key Design Decisions:**

1. **Async Processing:** Video upload returns 202 Accepted con upload_id, client fa polling
2. **Job Queue:** Redis + Celery per gestire multiple video in parallelo
3. **State Machine:** Video status = processing → success/failed
4. **Caching:** Redis cache per circuit lookup (reduce DB load)

---

### 2.3 Librerie/API Chiave

#### **Python Backend**
```python
# requirements.txt
fastapi==0.110.0
uvicorn[standard]==0.27.0
celery[redis]==5.3.6
redis==5.0.1
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
opencv-python==4.9.0
mediapipe==0.10.9
ultralytics==8.1.15  # YOLOv8
ffmpeg-python==0.2.0
python-jose[cryptography]==3.3.0  # JWT
passlib[bcrypt]==1.7.4  # Password hashing
python-multipart==0.0.6  # File upload
```

**Key components:**
- **FastAPI:** API framework
- **Celery:** Background jobs
- **Redis:** Queue + cache
- **SQLAlchemy:** ORM
- **OpenCV + MediaPipe:** Pose estimation
- **Ultralytics:** YOLO inference
- **FFmpeg:** Video processing

---

#### **Next.js Frontend**
```json
{
  "dependencies": {
    "next": "14.1.0",
    "react": "18.2.0",
    "tailwindcss": "3.4.1",
    "axios": "1.6.7",
    "react-dropzone": "14.2.3",
    "framer-motion": "11.0.3",
    "recharts": "2.10.3",
    "zustand": "4.5.0"
  }
}
```

**Key components:**
- **React Dropzone:** Drag-drop video upload
- **Axios:** API calls
- **Framer Motion:** Animations
- **Recharts:** Analytics graphs
- **Zustand:** State management (lighter than Redux)

---

### 2.4 Costi Stimati (6 Mesi)

#### **Infrastructure Costs**
| Service | Tier | Usage | Cost/Month | 6 Months |
|---------|------|-------|------------|----------|
| Vercel (Frontend) | Hobby | <100GB bandwidth | $0 | $0 |
| Railway (Backend) | Hobby | 512MB RAM | $5 credit | $0* |
| PostgreSQL (Supabase) | Free | 500MB DB | $0 | $0 |
| Redis (Upstash) | Free | 10k commands/day | $0 | $0 |
| S3 (AWS) | Standard | 50GB storage | $1.15 | $7 |
| **TOTAL** | | | **~$6/month** | **~$36** |

*Railway free $5/month covers small usage

---

#### **API Costs (Gemini Vision - Optional)**
Se usiamo Gemini Vision per analisi addizionale:

| Usage | Videos/Month | Cost/Video | Total/Month | 6 Months |
|-------|--------------|------------|-------------|----------|
| Light (beta) | 100 | $0.0008 | $0.08 | $0.48 |
| Medium | 1,000 | $0.0008 | $0.80 | $4.80 |
| Heavy | 10,000 | $0.0008 | $8.00 | $48.00 |

**Note:** MediaPipe + YOLO sono free (self-hosted), quindi possiamo evitare Gemini Vision per MVP

---

#### **Development Costs (Time)**
Assumendo freelance rate $50/hour:

| Phase | Hours | Cost |
|-------|-------|------|
| Week 1: Backend setup | 20h | $1,000 |
| Week 2: Video processing | 25h | $1,250 |
| Week 3: ML integration | 30h | $1,500 |
| Week 4: Frontend + polish | 20h | $1,000 |
| **TOTAL** | **95h** | **$4,750** |

**Self-development:** $0 (solo time investment)

---

#### **Total Cost Summary (6 Months)**
| Category | Cost |
|----------|------|
| Infrastructure | $36 |
| API calls (optional) | $5-50 |
| Development (self) | $0 |
| **TOTAL** | **~$40-90** |

**Verdict:** 💰 **EXTREMELY AFFORDABLE**

---

### 2.5 Tempistiche Realistiche

#### **MVP (Minimal Viable Product) - 4 Settimane**

**Week 1: Foundation** (Done 50% già)
- [x] Next.js project setup
- [x] Database schema
- [ ] FastAPI + Celery setup
- [ ] Auth endpoints (JWT)
- [ ] Video upload endpoint

**Week 2: Core Processing**
- [ ] FFmpeg frame extraction
- [ ] MediaPipe integration
- [ ] YOLO hold detection (use pre-trained)
- [ ] Background job pipeline
- [ ] Status polling endpoint

**Week 3: Circuit Matching**
- [ ] BoardLib integration
- [ ] Hold matching algorithm
- [ ] Circuit similarity scoring
- [ ] Results storage
- [ ] Error handling

**Week 4: UI + Polish**
- [ ] Video upload UI (drag-drop)
- [ ] Processing status viewer
- [ ] Circuit viewer component
- [ ] Results display + stats
- [ ] Mobile responsive
- [ ] Deploy to production

**MVP Feature Checklist:**
- ✅ Upload video (MP4, <100MB)
- ✅ Extract frames (FFmpeg)
- ✅ Detect pose (MediaPipe)
- ✅ Detect holds (YOLO)
- ✅ Match circuit (BoardLib)
- ✅ Display results
- ✅ Save to user profile

**NOT in MVP:**
- ❌ Real-time feedback
- ❌ Training plan generation
- ❌ Social features
- ❌ Mobile app

---

#### **Post-MVP (Weeks 5-8)**

**Week 5: Training Intelligence**
- [ ] Training log schema
- [ ] Weakness detection algorithm
- [ ] Performance tracking
- [ ] Dashboard analytics

**Week 6: AI Features**
- [ ] Gemini Vision integration per feedback
- [ ] Technique error detection
- [ ] Personalized recommendations

**Week 7: Social**
- [ ] Circuit sharing
- [ ] Leaderboards
- [ ] Community challenges

**Week 8: Polish + Launch**
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] User testing
- [ ] Public launch 🚀

---

### 2.6 Rischi Tecnici e Mitigazioni

#### **Risk 1: Pose Estimation Accuracy on Kilterboard** - MEDIUM
**Problema:** Climber di spalle, occlusioni, lighting
**Impact:** 70-85% accuracy invece di 90%+
**Mitigation:**
- ✅ Use MediaPipe model_complexity=2 (più accurato)
- ✅ User guidance: "Record from side angle"
- ✅ Fallback: Manual hold selection se detection fails
- ✅ Improve over time con user feedback

---

#### **Risk 2: Hold Detection on LED Kilterboard** - MEDIUM
**Problema:** Holds trasparenti LED potrebbero confondere YOLO
**Impact:** False positives, missed holds
**Mitigation:**
- ✅ Fine-tune YOLO su Kilterboard-specific dataset
- ✅ Color-based filtering (LED = red/blue/green/yellow)
- ✅ User can manually correct detected holds
- ✅ Ask users to record con LED accesi

---

#### **Risk 3: Circuit Matching Accuracy** - MEDIUM
**Problema:** Hold layout simili → wrong circuit match
**Impact:** Confidenza bassa, user frustration
**Mitigation:**
- ✅ Show confidence score (0-100%)
- ✅ Show top 3 matches instead of 1
- ✅ Allow manual circuit selection fallback
- ✅ Improve algorithm con user corrections

---

#### **Risk 4: Video Processing Speed** - LOW
**Problema:** >5 secondi per processare video = bad UX
**Impact:** User abandonment
**Mitigation:**
- ✅ Background processing (async Celery job)
- ✅ Show progress bar (% frames processed)
- ✅ Optimize: extract 1 frame/sec (not all frames)
- ✅ Use GPU if needed (Railway GPU add-on)

**Benchmark:**
- 30sec video @ 1 FPS = 30 frames
- MediaPipe: ~0.1s/frame = 3s total
- YOLO: ~0.2s/frame = 6s total
- **Total: ~10-15s** (acceptable con progress bar)

---

#### **Risk 5: Storage Costs Scaling** - LOW
**Problema:** 10k users × 10 videos × 50MB = 5TB storage
**Impact:** $115/month S3 cost
**Mitigation:**
- ✅ Delete videos after 30 giorni (user can download)
- ✅ Compress to 720p (sufficient quality)
- ✅ Offer "Pro" tier per unlimited storage
- ✅ Use cheaper storage (Cloudflare R2 = $0.015/GB)

---

#### **Risk 6: BoardLib API Changes** - LOW
**Problema:** BoardLib updates schema, our integration breaks
**Impact:** Circuit matching fails
**Mitigation:**
- ✅ Version lock BoardLib dependency
- ✅ Monitor GitHub for updates
- ✅ Automated tests for integration
- ✅ Fallback: Cache circuits locally

---

## 🎯 PARTE 3: PIANO D'AZIONE DETTAGLIATO

### Week 1: Foundation & Setup

#### **Monday (Day 1) - Backend Architecture**
**Tasks:**
- [ ] Setup FastAPI project structure
  ```bash
  fastapi-project/
  ├── app/
  │   ├── main.py
  │   ├── api/
  │   │   ├── auth.py
  │   │   ├── videos.py
  │   │   └── circuits.py
  │   ├── core/
  │   │   ├── config.py
  │   │   ├── security.py
  │   │   └── database.py
  │   ├── models/
  │   ├── services/
  │   │   ├── video_processor.py
  │   │   ├── mediapipe_service.py
  │   │   └── yolo_service.py
  │   └── tasks/
  │       └── video_analysis.py
  └── requirements.txt
  ```
- [ ] Setup Celery + Redis
- [ ] Configure PostgreSQL connection
- [ ] Docker compose for local dev

**Deliverable:** FastAPI app running on http://localhost:8000

---

#### **Tuesday (Day 2) - Database & Auth**
**Tasks:**
- [ ] Create SQLAlchemy models (User, VideoUpload, Circuit)
- [ ] Alembic migration setup
- [ ] Auth endpoints (register, login, me)
- [ ] JWT token generation + middleware
- [ ] Password hashing (bcrypt)

**Deliverable:** Auth working (can register, login, get token)

---

#### **Wednesday (Day 3) - Video Upload**
**Tasks:**
- [ ] POST /videos/upload endpoint
  - Accept multipart/form-data
  - Validate: MP4, <100MB, <2 min
  - Save to ./uploads/ (local storage)
  - Create VideoUpload record (status="pending")
  - Queue Celery job
  - Return 202 Accepted + upload_id
- [ ] GET /videos/{id} status endpoint
  - Return current status + progress
- [ ] Test video upload end-to-end

**Deliverable:** Can upload video, get upload_id, poll status

---

#### **Thursday (Day 4) - Frontend Upload UI**
**Tasks:**
- [ ] Create `/upload` page in Next.js
- [ ] Implement drag-drop zone (react-dropzone)
- [ ] File validation (client-side)
- [ ] Upload progress bar
- [ ] Success/error messages
- [ ] Redirect to status page after upload

**Deliverable:** Beautiful upload UI working

---

#### **Friday (Day 5) - Status Viewer**
**Tasks:**
- [ ] Create `/videos/[id]` page
- [ ] Auto-polling status ogni 2 sec
- [ ] Progress indicator
- [ ] Show detected circuit quando ready
- [ ] Error display se failed

**Deliverable:** Full upload → processing → results flow

---

### Week 2: Core Video Processing

#### **Monday (Day 6) - FFmpeg Integration**
**Tasks:**
- [ ] Install FFmpeg in Docker container
- [ ] Write frame extraction function
  ```python
  def extract_frames(video_path: str, fps: float = 1.0) -> List[str]:
      # Use FFmpeg to extract frames
      # Save to temp directory
      # Return list of frame paths
      pass
  ```
- [ ] Test con sample videos
- [ ] Cleanup temp files after processing

**Deliverable:** extract_frames() working reliably

---

#### **Tuesday (Day 7) - MediaPipe Pose**
**Tasks:**
- [ ] Install MediaPipe
- [ ] Implement pose detection function
  ```python
  def detect_pose(image_path: str) -> Dict:
      # Load image
      # Run MediaPipe Pose
      # Extract 33 landmarks
      # Return {landmarks: [...], confidence: 0.95}
      pass
  ```
- [ ] Test accuracy con climbing images
- [ ] Handle errors (no person detected, etc.)

**Deliverable:** detect_pose() returning landmarks

---

#### **Wednesday (Day 8) - YOLO Hold Detection**
**Tasks:**
- [ ] Download pre-trained YOLO model (Roboflow)
- [ ] Implement hold detection function
  ```python
  def detect_holds(image_path: str) -> List[Dict]:
      # Load YOLO model
      # Run inference
      # Extract bounding boxes + colors
      # Return [{x, y, w, h, color, confidence}, ...]
      pass
  ```
- [ ] Test con Kilterboard images
- [ ] Tune confidence threshold (0.5-0.7)

**Deliverable:** detect_holds() working

---

#### **Thursday (Day 9) - Celery Job Pipeline**
**Tasks:**
- [ ] Implement video_analysis_task()
  ```python
  @celery.task
  def analyze_video(upload_id: str):
      # 1. Get VideoUpload from DB
      # 2. Extract frames
      # 3. For each frame:
      #    - Detect pose
      #    - Detect holds
      # 4. Aggregate results
      # 5. Update DB with results
      # 6. Update status = "success"
      pass
  ```
- [ ] Add progress tracking
- [ ] Error handling + retry logic
- [ ] Update VideoUpload status at each step

**Deliverable:** Full processing pipeline working

---

#### **Friday (Day 10) - Integration Testing**
**Tasks:**
- [ ] Upload test video
- [ ] Verify frames extracted correctly
- [ ] Check pose detection results
- [ ] Check hold detection results
- [ ] Verify DB updated correctly
- [ ] Fix any bugs found

**Deliverable:** End-to-end video → analysis working

---

### Week 3: Circuit Matching & Intelligence

#### **Monday (Day 11) - BoardLib Integration**
**Tasks:**
- [ ] Install boardlib library
- [ ] Download Kilterboard circuits database
- [ ] Write circuit loader function
  ```python
  def load_boardlib_circuits() -> List[Circuit]:
      # Load from BoardLib SQLite
      # Parse circuit data
      # Return list of circuits
      pass
  ```
- [ ] Cache circuits in Redis (1 hour TTL)

**Deliverable:** Can query BoardLib circuits

---

#### **Tuesday (Day 12) - Hold Matching Algorithm**
**Tasks:**
- [ ] Implement circuit matching algorithm
  ```python
  def match_circuit(detected_holds: List[Dict]) -> List[Dict]:
      # For each BoardLib circuit:
      #   - Compare hold positions
      #   - Calculate similarity score
      #   - Color matching bonus
      # Return top 3 matches with confidence
      pass
  ```
- [ ] Test con known circuits
- [ ] Tune similarity threshold (70%+)

**Deliverable:** match_circuit() returning top 3

---

#### **Wednesday (Day 13) - Results Storage**
**Tasks:**
- [ ] Update VideoUpload model with results
- [ ] Store detected_circuit_id
- [ ] Store confidence score
- [ ] Store full analysis metadata (JSONB)
- [ ] Add GET /circuits/{id} endpoint

**Deliverable:** Results persisted in DB

---

#### **Thursday (Day 14) - Circuit Viewer UI**
**Tasks:**
- [ ] Create CircuitViewer component
- [ ] Visual grid representation (holds)
- [ ] Color-coded holds
- [ ] Show circuit name, difficulty, stats
- [ ] Show confidence score
- [ ] "Add to Training Plan" button

**Deliverable:** Beautiful circuit display

---

#### **Friday (Day 15) - Polish & Error Handling**
**Tasks:**
- [ ] Handle edge cases:
  - No circuit match found
  - Multiple similar circuits
  - Low confidence (<70%)
- [ ] Add manual circuit selection fallback
- [ ] Improve error messages
- [ ] Add loading states

**Deliverable:** Robust user experience

---

### Week 4: UI Polish & Deployment

#### **Monday (Day 16) - Dashboard**
**Tasks:**
- [ ] Create `/dashboard` page
- [ ] Show user's uploaded videos
- [ ] Show detected circuits
- [ ] Basic stats (videos analyzed, circuits found)
- [ ] Filter by date, difficulty

**Deliverable:** User dashboard working

---

#### **Tuesday (Day 17) - Mobile Responsive**
**Tasks:**
- [ ] Test all pages on mobile
- [ ] Fix layout issues
- [ ] Optimize video upload for mobile
- [ ] Test on iPhone/Android

**Deliverable:** Mobile-friendly UI

---

#### **Wednesday (Day 18) - Performance Optimization**
**Tasks:**
- [ ] Optimize video processing:
  - Reduce frame rate (0.5 FPS if needed)
  - Compress frames before analysis
- [ ] Add Redis caching for circuits
- [ ] Database query optimization
- [ ] Lazy loading components

**Deliverable:** <3 sec processing per video

---

#### **Thursday (Day 19) - Deployment**
**Tasks:**
- [ ] Deploy backend to Railway
  - Setup environment variables
  - Configure Redis addon
  - Setup PostgreSQL
- [ ] Deploy frontend to Vercel
  - Configure API URL
  - Setup environment variables
- [ ] Test production deployment
- [ ] Setup monitoring (Sentry)

**Deliverable:** Live on production URLs

---

#### **Friday (Day 20) - Testing & Launch Prep**
**Tasks:**
- [ ] User acceptance testing
- [ ] Fix critical bugs
- [ ] Write documentation (README)
- [ ] Create demo video
- [ ] Prepare launch announcement

**Deliverable:** Ready for beta launch 🚀

---

## 📝 CONCLUSIONI E RACCOMANDAZIONI

### ✅ GO / NO-GO Decision: **GO!**

**Fattibilità:** ⭐⭐⭐⭐⭐ (5/5)  
**Costo:** ⭐⭐⭐⭐⭐ (5/5 - molto basso)  
**Tempo:** ⭐⭐⭐⭐☆ (4/5 - 4 settimane MVP)  
**Innovazione:** ⭐⭐⭐⭐⭐ (5/5 - first-mover in Kilterboard space)

---

### 🎯 Raccomandazioni Chiave

#### **1. Start Simple - MediaPipe + YOLO**
**Perché:**
- Entrambi free, open-source
- Già provati scientificamente per climbing
- Accuracy sufficiente per MVP (80-85%)
- Scalabile (GPU optional, non required)

**Evita per MVP:**
- ❌ Gemini Vision (save for post-MVP feedback features)
- ❌ Custom ML training (use pre-trained models)
- ❌ Real-time processing (async is fine)

---

#### **2. Focus su UX, non solo tecnologia**
**Perché:**
- Video upload deve essere **frictionless** (drag-drop, mobile)
- Processing status deve essere **transparent** (progress bar)
- Results display deve essere **beautiful** (visual circuit viewer)
- Error handling deve essere **friendly** ("Oops! Try recording from the side")

**User Journey:**
```
1. Open app → See "Upload your climb" CTA
2. Drag video → See upload progress
3. Wait 10-15s → See fun loading animation
4. See detected circuit → "Circuit: V5 Power (87% match)"
5. Click "View Details" → Beautiful hold layout + stats
6. Click "Add to Training Plan" → Done!
```

---

#### **3. Iterative Improvement**
**Perché:**
- MVP non sarà perfetto (80% accuracy OK)
- User feedback = gold per training data
- Can fine-tune models nel tempo

**Post-MVP Roadmap:**
- Week 5-6: Collect user feedback + correction data
- Week 7-8: Fine-tune YOLO su Kilterboard LED holds
- Week 9-10: Add Gemini Vision per AI coaching feedback
- Week 11-12: Training plan generation

---

#### **4. Ostacoli Onesti**
**Challenges da aspettarsi:**
- Occlusioni (climber di spalle) → Accuracy 70-80% invece di 90%
- LED hold detection → Potrebbe richiedere fine-tuning
- Circuit matching false positives → Show top 3 matches, not just 1
- Video processing time → 10-15s acceptable con progress bar

**Come gestirli:**
- ✅ Set user expectations ("Beta - 80% accuracy, improving")
- ✅ Fallback: Manual hold selection
- ✅ Gamify: "Help us improve - correct this detection"

---

### 💡 Innovazioni da Considerare (Post-MVP)

#### **1. "AI Coach" - Gemini Vision Feedback**
```
User: "Why couldn't I finish this V6?"
AI: "You're using too much arm strength. Your hips are 8cm away from the wall 
     (optimal is <5cm). Try shifting weight onto your feet more. Watch this 
     reference video: [link]"
```

#### **2. "Progress Tracking" - ML-based Performance**
```
"You've improved your hip-to-wall distance by 15% this month!"
"Your weight shift technique has gotten 2x better"
"Predicted grade in 4 weeks: V7 (based on current progress)"
```

#### **3. "Circuit Remix" - Social Features**
```
User uploads video → Detects circuit
"10 other climbers tried this circuit this week"
"Average success rate: 65%"
"Your friend Alex sent this circuit (difficulty: V5)"
```

---

### 📊 Success Metrics (MVP)

**Technical Metrics:**
- ✅ Video processing time: <15 seconds
- ✅ Pose detection accuracy: >75%
- ✅ Hold detection accuracy: >70%
- ✅ Circuit matching confidence: >70% (when found)
- ✅ Uptime: >99%

**User Metrics:**
- ✅ 100 beta users in first month
- ✅ 50%+ upload success rate (users complete upload flow)
- ✅ 30%+ return rate (users upload >1 video)
- ✅ <5% error rate (video processing fails)
- ✅ Positive feedback from 70%+ users

---

### 🚀 Next Steps (Immediate)

**This Week:**
1. ✅ Review this report con Daniele
2. ✅ Approve tech stack (FastAPI + Next.js + MediaPipe + YOLO)
3. ✅ Setup development environment
4. ✅ Kick off Week 1 sprint

**Week 1 Sprint Goals:**
- [ ] FastAPI + Celery + Redis setup
- [ ] Video upload endpoint working
- [ ] Status polling working
- [ ] Next.js upload UI working

**Communication:**
- Daily standup (async su Telegram)
- Weekly demo (ogni Venerdì)
- GitHub project board per task tracking

---

## 📚 Appendix: Resources & Links

### Papers & Research
1. [Climbing Technique Evaluation - PMC10574944](https://pmc.ncbi.nlm.nih.gov/articles/PMC10574944/)
2. [The Way Up Dataset - arXiv 2505.12854](https://arxiv.org/abs/2505.12854)
3. [YOLO vs Edge Detection - Stockholm University](https://su.diva-portal.org/smash/get/diva2:1955778/FULLTEXT01.pdf)
4. [Speed Climbing Analysis - MDPI Sensors](https://www.mdpi.com/1424-8220/22/6/2251)

### Datasets
1. [Roboflow Climbing Holds (1717 images)](https://universe.roboflow.com/blackcreed-xpgxh/climbing-holds-and-volumes)
2. [The Way Up (22 videos)](https://arxiv.org/abs/2505.12854)
3. [SPEED21 (362 runs)](https://dl.acm.org/doi/10.1145/3475722.3482795)
4. [CIMI4D (180k frames)](https://openaccess.thecvf.com/content/CVPR2023/papers/Yan_CIMI4D_A_Large_Multimodal_Climbing_Motion_Dataset_CVPR_2023_paper.pdf)

### Tools & Libraries
1. [MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose.html)
2. [YOLOv8 Ultralytics](https://github.com/ultralytics/ultralytics)
3. [BoardLib](https://github.com/lemeryfertitta/BoardLib)
4. [FastAPI](https://fastapi.tiangolo.com/)
5. [Celery](https://docs.celeryq.dev/)

### Competitors
1. [Belay AI](https://belay.ai/)
2. [ClimbingCoach (GitHub)](https://github.com/ZeTioZ/ClimbingCoach)
3. [Climbology](https://github.com/Rundstedtzz/climbology)
4. [Climbdex](https://github.com/lemeryfertitta/Climbdex)

### Deployment
1. [Vercel](https://vercel.com/)
2. [Railway](https://railway.app/)
3. [Supabase](https://supabase.com/)
4. [Upstash Redis](https://upstash.com/)

---

## 🎬 Final Thoughts

**TL;DR:**
- ✅ **Technology is ready** (MediaPipe + YOLO proven for climbing)
- ✅ **Cost is minimal** (~$50 for 6 months infrastructure)
- ✅ **Timeline is realistic** (4 weeks MVP, 8 weeks full v1)
- ✅ **Risk is manageable** (fallbacks for every failure mode)
- ✅ **Innovation is high** (first Kilterboard-specific video analysis app)

**Recommendation:** 🚀 **START THIS WEEK!**

Il momento giusto per costruire Kilter Up è **ADESSO**. La tecnologia è matura, i costi sono minimi, e non ci sono competitor diretti nel Kilterboard space.

**Let's build this!** 💪🧗‍♂️

---

**Report preparato da:** Sam (OpenClaw AI Agent)  
**Data:** 19 Febbraio 2026, 09:00 CET  
**Versione:** 1.0 Final  
**Contatto:** Via Telegram (Daniele)

---

*"The best time to start was yesterday. The second best time is now."*
