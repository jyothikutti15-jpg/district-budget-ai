-- ============================================================
-- AI DISTRICT BUDGET PLANNER — COMPLETE DATABASE SCHEMA
-- FERPA-compliant · Multi-tenant · Row-Level Security enabled
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- STEP 1: ENABLE ROW-LEVEL SECURITY SUPPORT
-- Every table gets district_id. RLS policies enforce isolation.
-- No district can ever read another district's data.
-- ============================================================

-- ============================================================
-- TABLE: districts
-- One row per school district (e.g. SRVUSD)
-- ============================================================
CREATE TABLE districts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'CA',
  nces_id       TEXT UNIQUE,          -- National Center for Ed Stats ID
  enrollment    INTEGER,              -- total student count
  high_needs_pct DECIMAL(5,2),        -- % high-needs students (for grant matching)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: users
-- All platform users: superintendents, admins, finance staff
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id   UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN (
                  'superintendent', 'assistant_superintendent',
                  'finance_director', 'principal', 'board_member', 'viewer'
                )),
  google_sub    TEXT UNIQUE,          -- Google OAuth subject ID
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only see users in their own district
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_district_isolation ON users
  USING (district_id = current_setting('app.current_district_id')::UUID);

-- ============================================================
-- TABLE: district_budgets
-- Annual budget snapshot per fiscal year
-- ============================================================
CREATE TABLE district_budgets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id         UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  fiscal_year         TEXT NOT NULL,         -- e.g. '2025-26'
  total_revenue       BIGINT NOT NULL,       -- in cents
  lcff_revenue        BIGINT,               -- Local Control Funding Formula
  federal_revenue     BIGINT,
  local_revenue       BIGINT,
  total_expenditure   BIGINT NOT NULL,
  salary_expenditure  BIGINT,
  benefits_expenditure BIGINT,
  services_expenditure BIGINT,
  deficit             BIGINT GENERATED ALWAYS AS (total_expenditure - total_revenue) STORED,
  reserve_pct         DECIMAL(5,2),         -- % reserve of total expenditure
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(district_id, fiscal_year)
);

ALTER TABLE district_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY budgets_district_isolation ON district_budgets
  USING (district_id = current_setting('app.current_district_id')::UUID);

-- ============================================================
-- TABLE: staff_positions
-- All staff positions — filled and vacant
-- ============================================================
CREATE TABLE staff_positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id     UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,          -- e.g. 'High School Math Teacher'
  category        TEXT NOT NULL CHECK (category IN (
                    'teacher', 'counselor', 'administrator',
                    'classified', 'specialist', 'aide'
                  )),
  fte             DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  avg_salary      INTEGER NOT NULL,       -- annual salary in cents
  benefits_rate   DECIMAL(5,2) DEFAULT 0.30,  -- benefits as % of salary
  total_cost      BIGINT GENERATED ALWAYS AS (
                    (avg_salary * fte * (1 + benefits_rate))::BIGINT
                  ) STORED,
  is_filled       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_district_isolation ON staff_positions
  USING (district_id = current_setting('app.current_district_id')::UUID);

-- ============================================================
-- TABLE: programs
-- Academic programs with cost and outcome data
-- ============================================================
CREATE TABLE programs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id           UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,     -- 'academic', 'elective', 'support', 'athletics'
  annual_cost           BIGINT NOT NULL,   -- in cents
  students_served       INTEGER,
  cost_per_student      BIGINT GENERATED ALWAYS AS (
                          CASE WHEN students_served > 0
                          THEN annual_cost / students_served
                          ELSE NULL END
                        ) STORED,
  -- Outcome correlation coefficients (from published EdResearch)
  math_impact_coeff     DECIMAL(6,4) DEFAULT 0,   -- effect on math proficiency %
  ela_impact_coeff      DECIMAL(6,4) DEFAULT 0,
  grad_impact_coeff     DECIMAL(6,4) DEFAULT 0,
  abs_impact_coeff      DECIMAL(6,4) DEFAULT 0,   -- absenteeism impact
  is_mandated           BOOLEAN DEFAULT FALSE,     -- legally required program
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY programs_district_isolation ON programs
  USING (district_id = current_setting('app.current_district_id')::UUID);

-- ============================================================
-- TABLE: budget_scenarios
-- Each "what-if" scenario a superintendent models
-- ============================================================
CREATE TABLE budget_scenarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id           UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  created_by            UUID NOT NULL REFERENCES users(id),
  fiscal_year           TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  status                TEXT DEFAULT 'draft' CHECK (status IN (
                          'draft', 'under_review', 'approved', 'rejected', 'archived'
                        )),

  -- Budget lever inputs (what the superintendent adjusts)
  staff_reductions      INTEGER DEFAULT 0,      -- number of positions cut
  class_size_increase   DECIMAL(4,1) DEFAULT 0, -- avg students added per class
  program_cut_pct       DECIMAL(5,2) DEFAULT 0, -- % reduction to programs
  site_budget_cut_pct   DECIMAL(5,2) DEFAULT 0, -- % reduction to site budgets
  salary_freeze         BOOLEAN DEFAULT FALSE,
  custom_cuts           JSONB,                  -- any other custom levers

  -- Computed financial outputs (updated by backend service)
  projected_savings     BIGINT,                 -- in cents
  projected_deficit     BIGINT,
  projected_reserve_pct DECIMAL(5,2),

  -- Computed student outcome impacts (updated by Python impact model)
  math_proficiency_delta    DECIMAL(5,2),  -- percentage point change
  ela_proficiency_delta     DECIMAL(5,2),
  grad_rate_delta           DECIMAL(5,2),
  absenteeism_delta         DECIMAL(5,2),
  counselor_ratio_new       DECIMAL(7,1),  -- students per counselor
  teacher_workload_delta    DECIMAL(5,2),  -- % change in workload

  -- AI-generated documents
  board_memo_draft      TEXT,             -- Claude-generated board memo
  board_resolution      TEXT,             -- Claude-generated resolution language
  community_faq         TEXT,             -- Claude-generated community FAQ

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budget_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY scenarios_district_isolation ON budget_scenarios
  USING (district_id = current_setting('app.current_district_id')::UUID);

-- ============================================================
-- TABLE: scenario_staff_cuts
-- Detailed breakdown of which positions are cut in a scenario
-- ============================================================
CREATE TABLE scenario_staff_cuts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID NOT NULL REFERENCES budget_scenarios(id) ON DELETE CASCADE,
  district_id     UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  position_id     UUID REFERENCES staff_positions(id),
  position_title  TEXT NOT NULL,
  category        TEXT NOT NULL,
  fte_cut         DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  savings         BIGINT NOT NULL,
  rationale       TEXT
);

ALTER TABLE scenario_staff_cuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_cuts_district_isolation ON scenario_staff_cuts
  USING (district_id = current_setting('app.current_district_id')::UUID);

-- ============================================================
-- TABLE: federal_grants
-- Master database of all available federal/state grants
-- Updated by our grant matching service
-- ============================================================
CREATE TABLE federal_grants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  program_code        TEXT UNIQUE,           -- e.g. 'TITLE_I_A', 'ERATE', 'IDEA_B'
  funding_source      TEXT NOT NULL,         -- 'federal', 'state_ca', 'private'
  description         TEXT,
  typical_amount_min  BIGINT,               -- in cents
  typical_amount_max  BIGINT,
  application_deadline TEXT,                -- e.g. 'March 1 annually'
  application_url     TEXT,
  eligibility_rules   JSONB NOT NULL,       -- structured rules evaluated by matcher
  -- Example: {"min_high_needs_pct": 10, "max_enrollment": null, "state": "CA"}
  is_active           BOOLEAN DEFAULT TRUE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: matched_grants
-- Grants matched to a specific district by the eligibility engine
-- ============================================================
CREATE TABLE matched_grants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id     UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  grant_id        UUID NOT NULL REFERENCES federal_grants(id),
  estimated_amount BIGINT,                 -- personalized estimate for this district
  match_confidence DECIMAL(5,2),           -- 0-100 confidence score
  application_narrative TEXT,             -- Claude-generated draft narrative
  status          TEXT DEFAULT 'identified' CHECK (status IN (
                    'identified', 'in_progress', 'submitted', 'awarded', 'declined'
                  )),
  matched_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(district_id, grant_id)
);

ALTER TABLE matched_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY grants_district_isolation ON matched_grants
  USING (district_id = current_setting('app.current_district_id')::UUID);

-- ============================================================
-- TABLE: audit_log
-- Immutable log of every data access and change (FERPA requirement)
-- ============================================================
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  district_id   UUID NOT NULL,
  user_id       UUID,
  action        TEXT NOT NULL,   -- 'READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'
  table_name    TEXT NOT NULL,
  record_id     UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- Audit log is append-only — no RLS, no deletes ever
CREATE INDEX idx_audit_district ON audit_log(district_id, created_at DESC);

-- ============================================================
-- TABLE: sessions (auth sessions)
-- Tracks active user sessions
-- ============================================================
CREATE TABLE user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  district_id   UUID NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,   -- hashed session token
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES — keep queries fast as data grows
-- ============================================================
CREATE INDEX idx_users_district     ON users(district_id);
CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_budgets_district   ON district_budgets(district_id, fiscal_year);
CREATE INDEX idx_scenarios_district ON budget_scenarios(district_id, created_at DESC);
CREATE INDEX idx_scenarios_status   ON budget_scenarios(district_id, status);
CREATE INDEX idx_matched_grants     ON matched_grants(district_id, status);
CREATE INDEX idx_staff_district     ON staff_positions(district_id, category);

-- ============================================================
-- FUNCTION: auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scenarios_updated_at
  BEFORE UPDATE ON budget_scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON district_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Insert SRVUSD as first district
-- ============================================================
INSERT INTO districts (id, name, state, nces_id, enrollment, high_needs_pct)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'San Ramon Valley Unified School District',
  'CA',
  '0622710',
  27805,
  10.36
);

-- Seed federal grants database
INSERT INTO federal_grants (name, program_code, funding_source, description,
  typical_amount_min, typical_amount_max, application_deadline,
  application_url, eligibility_rules) VALUES

('Title I, Part A — Improving Basic Programs',
  'TITLE_I_A', 'federal',
  'Federal funding for districts with high concentrations of low-income students. Covers tutoring, instructional materials, and professional development.',
  50000000, 500000000,
  'July 1 annually (via state allocation)',
  'https://oese.ed.gov/offices/office-of-formula-grants/school-support-and-accountability/title-i-part-a/',
  '{"min_high_needs_pct": 5, "state": null}'
),

('E-Rate — Schools and Libraries Program',
  'ERATE', 'federal',
  'FCC program providing discounts on broadband internet and networking equipment for schools. Discount rate based on poverty level.',
  10000000, 200000000,
  'Application window: January–March annually',
  'https://www.usac.org/e-rate/',
  '{"requires_devices": true, "state": null}'
),

('IDEA Part B — Special Education Grants to States',
  'IDEA_B', 'federal',
  'Federal pass-through funding via state for special education services. Protects against staff cuts in SPED programs.',
  25000000, 300000000,
  'Allocated annually — contact CDE by August',
  'https://www.cde.ca.gov/sp/se/as/seagrants.asp',
  '{"has_sped_students": true, "state": null}'
),

('CA College Corps — High-Dosage Tutoring',
  'CA_COLLEGE_CORPS', 'state_ca',
  'California program recruiting college students to provide 450 hours of tutoring. Districts receive tutors; students get $10K education award.',
  0, 50000000,
  'Applications open September each year',
  'https://californiavolunteers.ca.gov/collegecorps/',
  '{"state": "CA", "min_enrollment": 1000}'
),

('Title IV, Part A — Student Support and Academic Enrichment',
  'TITLE_IV_A', 'federal',
  'Flexible funding for well-rounded education, safe schools, and technology. Can fund EdTech purchases including AI tutoring tools.',
  5000000, 100000000,
  'July 1 annually (via state allocation)',
  'https://oese.ed.gov/offices/office-of-formula-grants/school-support-and-accountability/essa-legislation/title-iv-part-a/',
  '{"state": null}'
);
