-- ============================================================
-- PHASE 2 MIGRATION: AI TUTORING CORE
-- Adds: students, tutor sessions, concept graph, mastery tracking,
--       at-risk scoring, teacher alerts, weekly AI reports
-- ============================================================

-- ============================================================
-- TABLE: students
-- One row per enrolled student. No raw PII sent to Claude API —
-- only anonymized student_id references leave this table.
-- ============================================================
CREATE TABLE students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id     UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  -- PII stored encrypted at rest in Postgres (AES-256 via pg column encryption)
  -- In production use pgcrypto encrypt() — simplified here for clarity
  display_name    TEXT NOT NULL,        -- first name only, for UI display
  grade_level     INTEGER NOT NULL CHECK (grade_level BETWEEN 0 AND 12),
  teacher_id      UUID REFERENCES users(id),
  clever_id       TEXT UNIQUE,          -- Clever SIS identifier
  language_pref   TEXT DEFAULT 'en',    -- for ELL support
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY students_district_isolation ON students
  USING (district_id = current_setting('app.current_district_id')::UUID);

CREATE INDEX idx_students_district ON students(district_id);
CREATE INDEX idx_students_teacher  ON students(teacher_id);

-- ============================================================
-- TABLE: concept_nodes
-- Directed graph of K-12 academic concepts.
-- Each node = one teachable concept (e.g. "fraction division").
-- Seeded with CA Common Core math and ELA standards.
-- ============================================================
CREATE TABLE concept_nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject       TEXT NOT NULL CHECK (subject IN ('math', 'ela', 'science')),
  grade_band    TEXT NOT NULL,     -- 'K-2', '3-5', '6-8', '9-12'
  code          TEXT NOT NULL,     -- e.g. '5.NF.3' (CA Common Core code)
  name          TEXT NOT NULL,     -- e.g. 'Fraction division'
  description   TEXT,
  difficulty    INTEGER DEFAULT 5 CHECK (difficulty BETWEEN 1 AND 10),
  UNIQUE(subject, code)
);

-- Prerequisite edges: "must master A before B"
CREATE TABLE concept_edges (
  prerequisite_id UUID NOT NULL REFERENCES concept_nodes(id),
  dependent_id    UUID NOT NULL REFERENCES concept_nodes(id),
  strength        DECIMAL(3,2) DEFAULT 0.8, -- 0-1: how critical is the prereq
  PRIMARY KEY (prerequisite_id, dependent_id)
);

CREATE INDEX idx_concept_by_subject ON concept_nodes(subject, grade_band);

-- ============================================================
-- TABLE: student_mastery
-- Per-student mastery score for each concept node.
-- Updated after every tutoring session via Bayesian update.
-- Range: 0.0 (no mastery) to 1.0 (full mastery).
-- ============================================================
CREATE TABLE student_mastery (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id     UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  concept_id      UUID NOT NULL REFERENCES concept_nodes(id),
  mastery_score   DECIMAL(4,3) NOT NULL DEFAULT 0.0
                  CHECK (mastery_score BETWEEN 0 AND 1),
  attempts        INTEGER DEFAULT 0,
  correct         INTEGER DEFAULT 0,
  last_practiced  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, concept_id)
);

ALTER TABLE student_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY mastery_district_isolation ON student_mastery
  USING (district_id = current_setting('app.current_district_id')::UUID);

CREATE INDEX idx_mastery_student   ON student_mastery(student_id, mastery_score);
CREATE INDEX idx_mastery_concept   ON student_mastery(concept_id);

-- ============================================================
-- TABLE: tutor_sessions
-- One row per tutoring session (student + subject + date).
-- ============================================================
CREATE TABLE tutor_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id     UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL CHECK (subject IN ('math', 'ela', 'science')),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_secs   INTEGER,          -- computed on session end
  message_count   INTEGER DEFAULT 0,
  -- Concept focus for this session (the "current" concept being practiced)
  current_concept_id UUID REFERENCES concept_nodes(id),
  -- Session-level outcomes
  concepts_attempted INTEGER DEFAULT 0,
  concepts_improved  INTEGER DEFAULT 0,
  -- Behavioral signals (computed during session)
  avg_response_time_secs DECIMAL(6,1),
  exit_reason     TEXT,             -- 'completed', 'timeout', 'manual_exit'
  engagement_score DECIMAL(3,2)     -- 0-1, computed from response times + completion
);

ALTER TABLE tutor_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_district_isolation ON tutor_sessions
  USING (district_id = current_setting('app.current_district_id')::UUID);

CREATE INDEX idx_sessions_student   ON tutor_sessions(student_id, started_at DESC);
CREATE INDEX idx_sessions_district  ON tutor_sessions(district_id, started_at DESC);

-- ============================================================
-- TABLE: session_messages
-- Every message in every tutoring session.
-- Used for error classification and mastery updates.
-- NOT sent to Claude API with PII — student_id only.
-- ============================================================
CREATE TABLE session_messages (
  id              BIGSERIAL PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  district_id     UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('student', 'tutor')),
  content         TEXT NOT NULL,
  concept_id      UUID REFERENCES concept_nodes(id),
  -- Error classification (filled by error analyzer after student messages)
  error_type      TEXT CHECK (error_type IN (
                    'conceptual_gap', 'arithmetic_slip',
                    'reading_difficulty', 'disengagement', 'correct'
                  )),
  is_correct      BOOLEAN,
  response_time_secs DECIMAL(6,1),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_district_isolation ON session_messages
  USING (district_id = current_setting('app.current_district_id')::UUID);

CREATE INDEX idx_messages_session ON session_messages(session_id, created_at);

-- ============================================================
-- TABLE: student_risk_scores
-- Nightly computed risk scores per student × risk dimension.
-- Feeds the teacher alert digest emails.
-- ============================================================
CREATE TABLE student_risk_scores (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id             UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  student_id              UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  scored_at               DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Three independent risk axes (0 = no risk, 100 = high risk)
  academic_regression     INTEGER DEFAULT 0 CHECK (academic_regression BETWEEN 0 AND 100),
  behavioral_disengagement INTEGER DEFAULT 0 CHECK (behavioral_disengagement BETWEEN 0 AND 100),
  persistent_blockage     INTEGER DEFAULT 0 CHECK (persistent_blockage BETWEEN 0 AND 100),
  -- Overall risk (max of three)
  overall_risk            INTEGER GENERATED ALWAYS AS (
                            GREATEST(academic_regression, behavioral_disengagement, persistent_blockage)
                          ) STORED,
  -- Details for teacher alert
  blocking_concept_id     UUID REFERENCES concept_nodes(id),
  alert_reason            TEXT,         -- plain-English reason for teacher
  is_dismissed            BOOLEAN DEFAULT FALSE,
  UNIQUE(student_id, scored_at)
);

ALTER TABLE student_risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_district_isolation ON student_risk_scores
  USING (district_id = current_setting('app.current_district_id')::UUID);

CREATE INDEX idx_risk_teacher  ON student_risk_scores(district_id, scored_at DESC, overall_risk DESC);
CREATE INDEX idx_risk_student  ON student_risk_scores(student_id, scored_at DESC);

-- ============================================================
-- TABLE: weekly_reports
-- AI-generated weekly student progress summaries.
-- Generated every Friday 4pm by scheduled job.
-- ============================================================
CREATE TABLE weekly_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id     UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_ending     DATE NOT NULL,
  summary_text    TEXT NOT NULL,   -- Claude-generated plain-English paragraph
  math_delta      DECIMAL(4,2),    -- mastery change this week
  ela_delta       DECIMAL(4,2),
  sessions_count  INTEGER,
  teacher_edited  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, week_ending)
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_district_isolation ON weekly_reports
  USING (district_id = current_setting('app.current_district_id')::UUID);

-- ============================================================
-- SEED: Core K-8 Math concept graph (CA Common Core)
-- 20 foundational concepts with prerequisite relationships
-- ============================================================
INSERT INTO concept_nodes (id, subject, grade_band, code, name, description, difficulty) VALUES
  ('cn-001', 'math', 'K-2',  '1.OA.1',  'Addition within 20',       'Add and subtract within 20', 1),
  ('cn-002', 'math', 'K-2',  '2.NBT.5', 'Addition within 100',      'Fluently add within 100', 2),
  ('cn-003', 'math', '3-5',  '3.NBT.2', 'Addition within 1000',     'Fluently add and subtract within 1000', 3),
  ('cn-004', 'math', '3-5',  '3.OA.1',  'Multiplication concept',   'Interpret products of whole numbers', 3),
  ('cn-005', 'math', '3-5',  '3.OA.7',  'Multiplication fluency',   'Fluently multiply within 100', 4),
  ('cn-006', 'math', '3-5',  '4.NBT.5', 'Multi-digit multiplication','Multiply multi-digit numbers', 5),
  ('cn-007', 'math', '3-5',  '3.NF.1',  'Fraction concept',         'Understanding fractions as parts', 4),
  ('cn-008', 'math', '3-5',  '4.NF.1',  'Equivalent fractions',     'Explain equivalent fractions', 5),
  ('cn-009', 'math', '3-5',  '4.NF.3',  'Fraction addition',        'Add and subtract fractions', 5),
  ('cn-010', 'math', '3-5',  '5.NF.3',  'Fraction division',        'Interpret division of fractions', 7),
  ('cn-011', 'math', '3-5',  '4.OA.1',  'Division concept',         'Interpret division as sharing', 4),
  ('cn-012', 'math', '3-5',  '4.NBT.6', 'Long division',            'Find quotients with remainders', 6),
  ('cn-013', 'math', '6-8',  '6.RP.1',  'Ratio concepts',           'Understand ratio language', 6),
  ('cn-014', 'math', '6-8',  '6.NS.1',  'Dividing fractions',       'Divide fractions by fractions', 7),
  ('cn-015', 'math', '6-8',  '7.EE.1',  'Linear expressions',       'Add and factor linear expressions', 7),
  ('cn-016', 'math', '6-8',  '8.EE.7',  'Linear equations',         'Solve linear equations in one variable', 8),
  ('cn-017', 'math', '6-8',  '8.F.1',   'Functions concept',        'Understand function as rule', 7),
  ('cn-018', 'math', '6-8',  '8.G.7',   'Pythagorean theorem',      'Apply the Pythagorean theorem', 7),
  ('cn-019', 'math', '9-12', 'A-SSE.1', 'Algebraic expressions',    'Interpret expressions', 7),
  ('cn-020', 'math', '9-12', 'A-CED.1', 'Creating equations',       'Create equations in one variable', 8);

-- Prerequisite edges (must master A before B)
INSERT INTO concept_edges (prerequisite_id, dependent_id, strength) VALUES
  ('cn-001', 'cn-002', 0.9),   -- addition-20 → addition-100
  ('cn-002', 'cn-003', 0.9),   -- addition-100 → addition-1000
  ('cn-003', 'cn-004', 0.7),   -- addition → multiplication concept
  ('cn-004', 'cn-005', 0.95),  -- multiplication concept → fluency
  ('cn-005', 'cn-006', 0.85),  -- fluency → multi-digit
  ('cn-004', 'cn-011', 0.8),   -- multiplication concept → division concept
  ('cn-011', 'cn-012', 0.9),   -- division concept → long division
  ('cn-007', 'cn-008', 0.9),   -- fraction concept → equivalent fractions
  ('cn-008', 'cn-009', 0.85),  -- equivalent fractions → fraction addition
  ('cn-009', 'cn-010', 0.9),   -- fraction addition → fraction division
  ('cn-012', 'cn-014', 0.7),   -- long division → dividing fractions
  ('cn-010', 'cn-014', 0.85),  -- fraction division → dividing fractions
  ('cn-013', 'cn-015', 0.7),   -- ratios → linear expressions
  ('cn-014', 'cn-015', 0.6),   -- dividing fractions → linear expressions
  ('cn-015', 'cn-016', 0.9),   -- linear expressions → linear equations
  ('cn-016', 'cn-017', 0.7),   -- linear equations → functions
  ('cn-016', 'cn-019', 0.8),   -- linear equations → algebraic expressions
  ('cn-019', 'cn-020', 0.9),   -- algebraic expressions → creating equations
  ('cn-005', 'cn-013', 0.7);   -- multiplication fluency → ratios
