# 🔌 KILTER UP - API Specification

> 📋 STATO IMPLEMENTAZIONE (marzo 2026):
> - ✅ Implementati: /auth/register, /auth/login, /auth/me, /videos/upload, /videos/{id}
> - ⏳ Phase 2/3 (non ancora implementati): /circuits/*, /training-logs/*, /training-plans/*, /statistics

**Version:** 1.0
**Base URL:** `/api/v1`  
**Content-Type:** `application/json`  
**Auth:** JWT tokens in `Authorization: Bearer <token>` header

---

## 📋 Endpoints Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | ❌ |
| POST | `/auth/login` | Login user | ❌ |
| GET | `/auth/me` | Get current user | ✅ |
| POST | `/videos/upload` | Upload climbing video | ✅ |
| GET | `/videos/{id}` | Get video details | ✅ |
| GET | `/videos` | List user's videos | ✅ |
| POST | `/circuits` | Create custom circuit | ✅ |
| GET | `/circuits/{id}` | Get circuit details | ✅ |
| GET | `/circuits` | Search circuits | ✅ |
| POST | `/circuits/generate` | Generate AI circuits | ✅ |
| POST | `/training-logs` | Log a climb session | ✅ |
| GET | `/training-logs` | Get training history | ✅ |
| POST | `/training-plans` | Generate weekly plan | ✅ |
| GET | `/training-plans/{week}` | Get plan for week | ✅ |
| GET | `/statistics` | Get user statistics | ✅ |

---

## 🔐 Authentication

### POST `/auth/register`
**Description:** Create new user account

**Request:**
```json
{
  "username": "daniele_climbs",
  "email": "daniele@example.com",
  "password": "secure_password_123",
  "skill_level": "V5"
}
```

**Response (201):**
```json
{
  "user_id": 1,
  "username": "daniele_climbs",
  "email": "daniele@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "created_at": "2026-02-18T10:00:00Z"
}
```

---

### POST `/auth/login`
**Description:** Login user

**Request:**
```json
{
  "email": "daniele@example.com",
  "password": "secure_password_123"
}
```

**Response (200):**
```json
{
  "user_id": 1,
  "username": "daniele_climbs",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

---

### GET `/auth/me`
**Description:** Get current authenticated user

**Response (200):**
```json
{
  "id": 1,
  "username": "daniele_climbs",
  "email": "daniele@example.com",
  "skill_level": "V5",
  "bio": "Climber from Luxembourg",
  "profile_picture_url": "https://...",
  "preferred_gym": "Luxembourg Climbing Gym",
  "training_frequency": 3,
  "created_at": "2026-02-16T15:00:00Z"
}
```

---

## 📹 Video Management

### POST `/videos/upload`
**Description:** Upload climbing video for circuit detection

**Request:** `multipart/form-data`
```
file: [binary video file, max 100MB]
gym_name: "Luxembourg Climbing Gym" (optional)
notes: "Cool power circuit" (optional)
```

**Response (202 - Accepted, processing async):**
```json
{
  "upload_id": 42,
  "status": "processing",
  "file_name": "climbing_video_123.mp4",
  "file_size_bytes": 45000000,
  "duration_seconds": 45,
  "estimated_processing_time_seconds": 30,
  "gym_name": "Luxembourg Climbing Gym",
  "created_at": "2026-02-18T10:05:00Z"
}
```

**Polling for results:**
```
GET /videos/42
→ If processing, returns {"status": "processing", ...}
→ If done, returns {"status": "success", "detected_circuit_id": 123, ...}
```

---

### GET `/videos/{id}`
**Description:** Get video details + detection results

**Response (200):**
```json
{
  "id": 42,
  "user_id": 1,
  "file_name": "climbing_video_123.mp4",
  "file_path": "https://s3.example.com/videos/42.mp4",
  "duration_seconds": 45,
  "detection_status": "success",
  "detected_circuit_id": 123,
  "detected_circuit_name": "Power Circuit V6",
  "detection_confidence": 0.87,
  "total_frames": 450,
  "analyzed_frames": 450,
  "detected_holds": [
    {
      "frame": 10,
      "holds": [
        {"color": "red", "position": "top-left", "grip_type": "jug"},
        {"color": "blue", "position": "mid-right", "grip_type": "sloper"}
      ]
    }
  ],
  "gym_name": "Luxembourg Climbing Gym",
  "notes": "Cool power circuit",
  "created_at": "2026-02-18T10:05:00Z"
}
```

---

### GET `/videos?skip=0&limit=10`
**Description:** List user's uploaded videos

**Response (200):**
```json
{
  "total": 23,
  "skip": 0,
  "limit": 10,
  "videos": [
    {
      "id": 42,
      "file_name": "climbing_video_123.mp4",
      "detection_status": "success",
      "detected_circuit_name": "Power Circuit V6",
      "created_at": "2026-02-18T10:05:00Z"
    },
    ...
  ]
}
```

---

## 🧗 Circuits

### POST `/circuits`
**Description:** Create custom circuit

**Request:**
```json
{
  "name": "My Custom V5",
  "description": "Power-focused route",
  "difficulty_grade": "V5",
  "style": "power",
  "gym_name": "Luxembourg Gym",
  "board_angle": 50,
  "holds": [
    {
      "color": "red",
      "position": "top-left",
      "grip_type": "jug"
    },
    {
      "color": "blue",
      "position": "mid-center",
      "grip_type": "sloper"
    },
    {
      "color": "yellow",
      "position": "bottom-right",
      "grip_type": "crimp"
    }
  ]
}
```

**Response (201):**
```json
{
  "id": 123,
  "name": "My Custom V5",
  "created_by_user_id": 1,
  "difficulty_grade": "V5",
  "style": "power",
  "holds": [...],
  "total_holds": 3,
  "gym_name": "Luxembourg Gym",
  "source": "custom",
  "created_at": "2026-02-18T10:10:00Z"
}
```

---

### GET `/circuits/{id}`
**Description:** Get circuit details

**Response (200):**
```json
{
  "id": 123,
  "name": "Power Circuit V6",
  "created_by_user_id": 1,
  "difficulty_grade": "V6",
  "difficulty_confidence": 0.92,
  "style": "power",
  "estimated_time_minutes": 8,
  "holds": [...],
  "total_holds": 5,
  "gym_name": "Luxembourg Gym",
  "board_angle": 50,
  "source": "kilter",
  "total_ascents": 42,
  "avg_success_rate": 0.68,
  "avg_rating": 4.2,
  "boardlib_id": 9876,
  "boardlib_match_confidence": 0.87,
  "created_at": "2026-02-17T15:00:00Z"
}
```

---

### GET `/circuits?difficulty=V5&style=power&gym=Luxembourg&skip=0&limit=20`
**Description:** Search circuits with filters

**Response (200):**
```json
{
  "total": 47,
  "skip": 0,
  "limit": 20,
  "filters_applied": {
    "difficulty": "V5",
    "style": "power",
    "gym": "Luxembourg"
  },
  "circuits": [
    {
      "id": 123,
      "name": "Power Circuit V5",
      "difficulty_grade": "V5",
      "style": "power",
      "gym_name": "Luxembourg Gym",
      "avg_rating": 4.2,
      "total_ascents": 42
    },
    ...
  ]
}
```

---

### POST `/circuits/generate`
**Description:** Generate AI circuits based on parameters

**Request:**
```json
{
  "difficulty": "V5-V6",
  "muscle_focus": "sloper",
  "duration_type": "moderate",
  "style": "endurance",
  "gym_name": "Luxembourg Gym",
  "num_suggestions": 3
}
```

**Response (200):**
```json
{
  "generated_circuits": [
    {
      "id": null,
      "name": "Generated Circuit #1",
      "difficulty_grade": "V5",
      "difficulty_confidence": 0.89,
      "style": "endurance",
      "estimated_time_minutes": 7,
      "holds": [
        {"color": "red", "position": "...", "grip_type": "..."},
        ...
      ],
      "total_holds": 6,
      "explanation": "Focus on sloper transitions, sustained climbing. Good for endurance.",
      "ml_model_used": "LightGBM v2",
      "generated_at": "2026-02-18T10:15:00Z"
    },
    ...
  ],
  "request_summary": {
    "difficulty": "V5-V6",
    "muscle_focus": "sloper",
    "style": "endurance"
  }
}
```

**Next step:** User can POST one of these circuits to `/circuits` to save it

---

## 📊 Training Logs

### POST `/training-logs`
**Description:** Log a climbing session

**Request:**
```json
{
  "circuit_id": 123,
  "completed": true,
  "attempts": 1,
  "time_taken_seconds": 240,
  "rpe": 8,
  "notes": "Felt strong on slopers",
  "muscled_used": ["slopers", "core"],
  "gym_name": "Luxembourg Gym",
  "session_type": "training"
}
```

**Response (201):**
```json
{
  "id": 5001,
  "user_id": 1,
  "circuit_id": 123,
  "completed": true,
  "attempts": 1,
  "time_taken_seconds": 240,
  "rpe": 8,
  "notes": "Felt strong on slopers",
  "muscled_used": ["slopers", "core"],
  "gym_name": "Luxembourg Gym",
  "session_type": "training",
  "created_at": "2026-02-18T16:30:00Z"
}
```

---

### GET `/training-logs?start_date=2026-02-01&end_date=2026-02-18&skip=0&limit=50`
**Description:** Get training history with filters

**Response (200):**
```json
{
  "total": 15,
  "skip": 0,
  "limit": 50,
  "date_range": {
    "start": "2026-02-01",
    "end": "2026-02-18"
  },
  "logs": [
    {
      "id": 5001,
      "circuit_id": 123,
      "circuit_name": "Power Circuit V6",
      "completed": true,
      "attempts": 1,
      "rpe": 8,
      "gym_name": "Luxembourg Gym",
      "created_at": "2026-02-18T16:30:00Z"
    },
    ...
  ],
  "summary": {
    "total_ascents": 15,
    "completed": 12,
    "failed": 3,
    "avg_rpe": 7.2,
    "muscled_most_used": "jugs"
  }
}
```

---

## 📈 Training Plans

### POST `/training-plans`
**Description:** Generate AI weekly training plan

**Request:**
```json
{
  "week_start_date": "2026-02-18",
  "focus_area": "sloper_weakness",
  "available_days": ["monday", "wednesday", "friday", "saturday"]
}
```

**Response (201):**
```json
{
  "id": 101,
  "user_id": 1,
  "week_start_date": "2026-02-18",
  "week_end_date": "2026-02-24",
  "plan_data": {
    "monday": {
      "rest": false,
      "circuits": [
        {
          "circuit_id": 200,
          "circuit_name": "Sloper Max V6",
          "target_reps": 3,
          "focus": "power"
        }
      ],
      "total_time_minutes": 15
    },
    "tuesday": {"rest": true},
    "wednesday": {
      "rest": false,
      "circuits": [
        {
          "circuit_id": 201,
          "circuit_name": "Endurance Mix V5",
          "target_reps": 2,
          "focus": "endurance"
        }
      ],
      "total_time_minutes": 20
    },
    "thursday": {"rest": true},
    "friday": {
      "rest": false,
      "circuits": [
        {
          "circuit_id": 202,
          "circuit_name": "Sloper Technique V5",
          "target_reps": 4,
          "focus": "technical"
        }
      ],
      "total_time_minutes": 18
    },
    "saturday": {
      "rest": false,
      "circuits": [
        {
          "circuit_id": 203,
          "circuit_name": "Mixed V5-V6",
          "target_reps": 3,
          "focus": "power"
        }
      ],
      "total_time_minutes": 25
    },
    "sunday": {"rest": true}
  },
  "total_recommended_days": 4,
  "total_volume": 12,
  "generated_by_ml_model": true,
  "recommendations": [
    "Focus on sloper sequences this week",
    "Increase volume by 20% next week if you hit all targets",
    "Watch your grip strength on crimps"
  ],
  "created_at": "2026-02-18T10:20:00Z"
}
```

---

### GET `/training-plans/2026-02-18`
**Description:** Get plan for a specific week

**Response (200):**
```json
{
  "id": 101,
  "week_start_date": "2026-02-18",
  "plan_data": {...},
  "completed_sessions": 2,
  "adherence_rate": 0.5,
  "created_at": "2026-02-18T10:20:00Z"
}
```

---

## 📊 Statistics

### GET `/statistics`
**Description:** Get user's aggregated statistics

**Response (200):**
```json
{
  "user_id": 1,
  "total_ascents": 127,
  "total_circuits_climbed": 34,
  "total_sessions": 18,
  "total_hours_trained": 45.5,
  "current_grade": "V6",
  "average_grade_attempted": "V5.2",
  "grade_distribution": {
    "V0": 0,
    "V1": 0,
    "V2": 5,
    "V3": 12,
    "V4": 28,
    "V5": 55,
    "V6": 27,
    "V7": 0
  },
  "worst_muscled": "sloper",
  "worst_muscled_success_rate": 0.35,
  "best_muscled": "jug",
  "best_muscled_success_rate": 0.82,
  "training_streak_days": 5,
  "longest_training_streak": 12,
  "weekly_ascents_trend": [
    8, 9, 7, 10, 11, 12, 9, 8, 10, 11, 10, 7
  ],
  "grade_progression_trend": [
    "V4", "V4", "V4", "V5", "V5", "V5", "V5", "V5", "V5", "V5", "V5", "V6"
  ],
  "updated_at": "2026-02-18T10:30:00Z"
}
```

---

## 🔄 Async Processing

**Video analysis happens in background:**
1. User POSTs video → Get `upload_id`
2. System processes (extracts frames, calls Gemini Vision)
3. User polls `/videos/{id}` for status
4. When ready, `status: "success"` + `detected_circuit_id`

**Example polling flow:**
```
POST /videos/upload → {"upload_id": 42, "status": "processing"}
GET /videos/42 → {"status": "processing", "progress": 45}
[wait 10 sec]
GET /videos/42 → {"status": "processing", "progress": 85}
[wait 5 sec]
GET /videos/42 → {"status": "success", "detected_circuit_id": 123}
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "details": "difficulty_grade must be V0-V15"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "details": "Missing or invalid authentication token"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "details": "Circuit with id 999 does not exist"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "Error processing video. Try again later."
}
```

---

## 🧪 Testing

**Example curl commands:**

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"123","skill_level":"V5"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123"}'

# Get current user
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Upload video
curl -X POST http://localhost:8000/api/v1/videos/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@climbing_video.mp4" \
  -F "gym_name=Luxembourg Gym"

# Generate circuits
curl -X POST http://localhost:8000/api/v1/circuits/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "difficulty": "V5-V6",
    "muscle_focus": "sloper",
    "style": "endurance",
    "num_suggestions": 3
  }'
```

---

**API Version:** 1.0  
**Last Updated:** 18/02/2026  
**Status:** Ready for development

