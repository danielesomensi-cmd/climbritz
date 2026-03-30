-- KILTER UP - Database Schema (PostgreSQL)
-- Created: 18/02/2026
-- ORM: SQLAlchemy with Alembic migrations

-- ============================================
-- USER & AUTHENTICATION
-- ============================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Profile
    skill_level VARCHAR(10), -- V0, V1, V2, ..., V15
    bio TEXT,
    profile_picture_url VARCHAR(255),
    
    -- Preferences
    preferred_gym VARCHAR(100),
    favorite_muscle_groups TEXT[], -- ['jugs', 'slopers', 'crimps']
    training_frequency INT, -- days per week
    
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- ============================================
-- CIRCUITS (Database + Generated + Custom)
-- ============================================

CREATE TABLE circuits (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    name VARCHAR(120),
    description TEXT,
    source VARCHAR(20), -- 'kilter', 'generated', 'custom'
    created_by_user_id INT REFERENCES users(id),
    
    -- Difficulty & Classification
    difficulty_grade VARCHAR(10), -- V0-V15
    difficulty_confidence FLOAT, -- 0-100%, from ML model
    estimated_time_minutes INT,
    style VARCHAR(20), -- 'power', 'endurance', 'technical', 'mixed'
    
    -- Hold Sequence (JSON)
    holds JSONB NOT NULL, -- [{color, position, grip_type}, ...]
    total_holds INT,
    
    -- Statistics
    total_ascents INT DEFAULT 0,
    avg_success_rate FLOAT DEFAULT 0.0, -- % of people who send it
    avg_rating FLOAT DEFAULT 0.0, -- 1-5 stars
    
    -- Gym Info
    gym_name VARCHAR(100),
    board_angle INT, -- 0, 20, 40, 50 degrees
    
    -- Original Circuit (if matched from BoardLib)
    boardlib_id INT,
    boardlib_match_confidence FLOAT,
    
    INDEX idx_source (source),
    INDEX idx_difficulty (difficulty_grade),
    INDEX idx_gym (gym_name),
    INDEX idx_created_by (created_by_user_id)
);

-- ============================================
-- VIDEO UPLOADS & DETECTION
-- ============================================

CREATE TABLE video_uploads (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- File Info
    file_name VARCHAR(255),
    file_path VARCHAR(255), -- S3 URL or local path
    file_size_bytes BIGINT,
    duration_seconds INT,
    
    -- Detection Results
    detected_circuit_id INT REFERENCES circuits(id),
    detection_confidence FLOAT, -- 0-100%
    detection_status VARCHAR(20), -- 'processing', 'success', 'failed'
    
    -- Frames Analysis
    total_frames INT,
    analyzed_frames INT,
    detected_holds JSONB, -- Hold detection results per frame
    
    -- Metadata
    gym_name VARCHAR(100),
    notes TEXT,
    
    INDEX idx_user (user_id),
    INDEX idx_circuit (detected_circuit_id),
    INDEX idx_status (detection_status)
);

-- ============================================
-- TRAINING LOG (User Ascents)
-- ============================================

CREATE TABLE training_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    circuit_id INT NOT NULL REFERENCES circuits(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Climb Details
    completed BOOLEAN, -- Did user send it?
    attempts INT DEFAULT 1,
    time_taken_seconds INT,
    
    -- Feedback
    rpe INT, -- Rate of Perceived Exertion (1-10)
    notes TEXT,
    muscled_used TEXT[], -- ['jugs', 'slopers', ...]
    
    -- Video Reference
    session_video_url VARCHAR(255), -- Optional: user recorded themselves
    
    -- Metadata
    gym_name VARCHAR(100),
    session_type VARCHAR(20), -- 'training', 'comp', 'casual'
    
    INDEX idx_user (user_id),
    INDEX idx_circuit (circuit_id),
    INDEX idx_date (created_at),
    INDEX idx_completed (completed)
);

-- ============================================
-- TRAINING PLANS (AI Generated)
-- ============================================

CREATE TABLE training_plans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Week Info
    week_start_date DATE,
    week_end_date DATE,
    
    -- Plan Details
    plan_data JSONB NOT NULL, -- {
                              --   "monday": [{circuit_id, target_reps, focus}],
                              --   "tuesday": null (rest day),
                              --   ...
                              -- }
    total_recommended_days INT,
    total_volume INT, -- Total circuits recommended
    
    -- AI Metadata
    generated_by_ml_model BOOLEAN,
    based_on_weakness_analysis TEXT,
    recommendations TEXT[], -- ["Focus on slopers", "Increase volume"]
    
    -- User Adherence
    completed_sessions INT DEFAULT 0,
    adherence_rate FLOAT DEFAULT 0.0,
    
    INDEX idx_user (user_id),
    INDEX idx_week (week_start_date)
);

-- ============================================
-- USER STATISTICS & CACHE
-- ============================================

CREATE TABLE user_statistics (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Totals
    total_ascents INT DEFAULT 0,
    total_circuits_climbed INT DEFAULT 0,
    total_sessions INT DEFAULT 0,
    total_hours_trained FLOAT DEFAULT 0.0,
    
    -- Grade Statistics
    current_grade VARCHAR(10), -- Highest V grade sent
    average_grade_attempted FLOAT,
    grade_distribution JSONB, -- {V0: 10, V1: 15, V2: 5, ...}
    
    -- Weakness Analysis
    worst_muscled VARCHAR(50), -- e.g., 'slopers'
    worst_muscled_success_rate FLOAT,
    best_muscled VARCHAR(50),
    best_muscled_success_rate FLOAT,
    
    -- Trends
    weekly_ascents_trend INT[], -- Last 12 weeks
    grade_progression_trend VARCHAR(10)[], -- V-grade trend
    
    -- Streak
    training_streak_days INT DEFAULT 0,
    longest_training_streak INT DEFAULT 0,
    
    INDEX idx_user (user_id)
);

-- ============================================
-- LEADERBOARDS (for future gamification)
-- ============================================

CREATE TABLE leaderboards (
    id SERIAL PRIMARY KEY,
    period VARCHAR(20), -- 'weekly', 'monthly', 'alltime'
    period_start DATE,
    period_end DATE,
    
    -- Rankings Data (denormalized for performance)
    rankings JSONB NOT NULL, -- [
                              --   {user_id, username, score, rank},
                              --   ...
                              -- ]
    metric VARCHAR(50), -- 'ascents', 'grade_reached', 'consistency'
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_period (period, period_start)
);

-- ============================================
-- CIRCUIT VARIANTS (CircuitRemix feature)
-- ============================================

CREATE TABLE circuit_variants (
    id SERIAL PRIMARY KEY,
    original_circuit_id INT NOT NULL REFERENCES circuits(id),
    variant_circuit_id INT NOT NULL REFERENCES circuits(id),
    created_by_user_id INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Variant Info
    changes_description TEXT, -- "Removed 1 crimp, added 1 sloper"
    changed_holds JSONB, -- {removed: [...], added: [...]}
    
    -- Ratings
    total_ascents INT DEFAULT 0,
    success_rate FLOAT DEFAULT 0.0,
    
    INDEX idx_original (original_circuit_id),
    INDEX idx_variant (variant_circuit_id)
);

-- ============================================
-- NOTIFICATIONS & ACHIEVEMENTS
-- ============================================

CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50), -- 'first_video', 'grade_jump', 'streak'
    achievement_data JSONB, -- {grade_reached, previous_grade, ...}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id),
    INDEX idx_type (achievement_type)
);

-- ============================================
-- API KEYS (for future third-party integration)
-- ============================================

CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    
    INDEX idx_user (user_id),
    INDEX idx_key (key)
);

-- ============================================
-- INDEXES FOR COMMON QUERIES
-- ============================================

-- Get user's training history for a date range
CREATE INDEX idx_training_logs_user_date ON training_logs(user_id, created_at DESC);

-- Get all circuits for a gym
CREATE INDEX idx_circuits_gym_difficulty ON circuits(gym_name, difficulty_grade);

-- Find similar circuits for recommendations
CREATE INDEX idx_circuits_style_difficulty ON circuits(style, difficulty_grade);

-- Video uploads timeline
CREATE INDEX idx_videos_user_date ON video_uploads(user_id, created_at DESC);

-- Training plans lookup
CREATE INDEX idx_plans_user_date ON training_plans(user_id, week_start_date DESC);

-- ============================================
-- VIEWS (for common queries)
-- ============================================

-- User's current stats (summary)
CREATE VIEW user_current_stats AS
SELECT 
    u.id,
    u.username,
    u.skill_level,
    us.total_ascents,
    us.current_grade,
    us.training_streak_days,
    us.worst_muscled,
    us.best_muscled,
    us.updated_at
FROM users u
LEFT JOIN user_statistics us ON u.id = us.user_id;

-- Circuit popularity (for recommendations)
CREATE VIEW circuit_popularity AS
SELECT 
    c.id,
    c.name,
    c.difficulty_grade,
    c.total_ascents,
    c.avg_success_rate,
    c.avg_rating,
    COUNT(tl.id) as ascents_last_30_days
FROM circuits c
LEFT JOIN training_logs tl ON c.id = tl.circuit_id 
    AND tl.created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.id
ORDER BY ascents_last_30_days DESC;

-- ============================================
-- INITIAL DATA
-- ============================================

-- No initial data needed; app is user-generated from day 1

-- ============================================
-- NOTES FOR ALEMBIC MIGRATION
-- ============================================

/*
Migration Strategy:
1. Create baseline schema (this file)
2. Use Alembic for version control
3. Each feature = new migration script
4. Example: 001_create_users.py, 002_create_circuits.py, etc.

Development:
- SQLAlchemy ORM models in backend/models/
- Relationships defined at ORM level
- Alembic auto-generates migrations: alembic revision --autogenerate -m "description"

Production:
- Run migrations on deploy: alembic upgrade head
- Keep migration history in Git
- Never manually edit applied migrations
*/
