# AI District Budget Planner — Build Guide

## Phase 1: Foundation Setup (Weeks 1–4)

---

## Prerequisites

Install these before starting:

```bash
# Node.js 20+
node --version  # should show v20+

# Install nvm if needed:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20 && nvm use 20

# Git
git --version
```

---

## Step 1 — Clone and install dependencies

```bash
git clone https://github.com/YOUR-ORG/district-budget-ai.git
cd district-budget-ai

# Install all workspace dependencies at once
npm install

# Verify turbo is working
npx turbo --version
```

---

## Step 2 — Set up your database (Supabase)

1. Go to **supabase.com** → New Project
2. Name it `district-budget-ai` → Choose region `us-west-2`
3. Copy the **connection string** from Settings → Database
4. Run the schema migration:

```bash
# Copy env template
cp .env.example .env

# Fill in DATABASE_URL in .env, then run:
psql $DATABASE_URL -f packages/db/migrations/001_initial_schema.sql

# Verify tables were created:
psql $DATABASE_URL -c "\dt"
# Should show: districts, users, district_budgets, budget_scenarios,
#              staff_positions, programs, federal_grants, matched_grants,
#              audit_log, user_sessions
```

---

## Step 3 — Set up Google OAuth

1. Go to **console.cloud.google.com**
2. Create a new project: `District Budget AI`
3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
4. Application type: **Web application**
5. Authorized redirect URIs:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)
6. Copy **Client ID** and **Client Secret** → paste into `.env`

---

## Step 4 — Get your Anthropic API key

1. Go to **console.anthropic.com**
2. API Keys → Create Key → name it `district-budget-dev`
3. Copy the key → paste into `.env` as `ANTHROPIC_API_KEY`

---

## Step 5 — Generate JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy the output → paste into .env as JWT_SECRET
```

---

## Step 6 — Create your first admin user

```bash
# After running the schema, add your first superintendent user:
psql $DATABASE_URL << 'EOF'
INSERT INTO users (district_id, email, full_name, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',  -- SRVUSD (seeded)
  'superintendent@srvusd.net',
  'CJ Cammack',
  'superintendent'
);
EOF
```

---

## Step 7 — Start development servers

```bash
# Start everything at once (frontend + API)
npm run dev

# Or start individually:
cd apps/api && npm run dev     # API on http://localhost:3001
cd apps/web && npm run dev     # Frontend on http://localhost:3000
```

---

## Step 8 — Verify everything works

```bash
# Test the API health endpoint
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}

# Test database connection
curl http://localhost:3001/health/db
# Should return: {"status":"ok","tables":["districts","users",...]}

# Open the frontend
open http://localhost:3000
# Should show the login page
```

---

## Step 9 — Seed SRVUSD budget data

```bash
psql $DATABASE_URL << 'EOF'
-- Add SRVUSD FY 2025-26 budget data
INSERT INTO district_budgets (
  district_id, fiscal_year,
  total_revenue, lcff_revenue, federal_revenue, local_revenue,
  total_expenditure, salary_expenditure, benefits_expenditure,
  reserve_pct
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '2025-26',
  35500000000,   -- $355M total revenue (in cents)
  26625000000,   -- $266.25M LCFF
  5325000000,    -- $53.25M federal
  3550000000,    -- $35.5M local
  38100000000,   -- $381M expenditure
  27832000000,   -- $278.32M salaries
  8349600000,    -- $83.5M benefits
  3.2            -- 3.2% reserve
);

-- Add sample staff positions
INSERT INTO staff_positions (district_id, title, category, fte, avg_salary, benefits_rate)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Classroom Teacher', 'teacher', 1.0, 9500000, 0.30),
  ('00000000-0000-0000-0000-000000000001', 'School Counselor', 'counselor', 1.0, 8200000, 0.30),
  ('00000000-0000-0000-0000-000000000001', 'Assistant Principal', 'administrator', 1.0, 11000000, 0.32),
  ('00000000-0000-0000-0000-000000000001', 'Instructional Aide', 'aide', 1.0, 4200000, 0.25),
  ('00000000-0000-0000-0000-000000000001', 'Librarian', 'specialist', 1.0, 7800000, 0.30);
EOF
```

---

## Step 10 — Run the grant matcher

```bash
# This populates matched_grants for SRVUSD
curl -X POST http://localhost:3001/api/admin/run-grant-match \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"districtId": "00000000-0000-0000-0000-000000000001"}'
```

---

## Project structure (after Phase 1)

```
district-budget-ai/
├── apps/
│   ├── api/                    # Node.js/Express backend
│   │   └── src/
│   │       ├── index.ts        # Server entry point
│   │       ├── auth.ts         # Google OAuth + JWT
│   │       ├── db.ts           # Postgres connection + RLS
│   │       ├── routes/
│   │       │   ├── scenarios.ts    # Budget scenario CRUD + AI memo
│   │       │   ├── grants.ts       # Grant matching endpoints
│   │       │   └── districts.ts    # District profile endpoints
│   │       └── services/
│   │           ├── impact-model.ts # Outcome projection engine
│   │           └── grant-matcher.ts # Grant eligibility engine
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # React components
│           └── lib/            # API client + auth hooks
├── packages/
│   ├── db/
│   │   └── migrations/
│   │       └── 001_initial_schema.sql  # ← THE DATABASE
│   └── types/
│       └── src/index.ts        # Shared TypeScript types
├── .env.example                # Environment variable template
├── package.json                # Monorepo root
└── turbo.json                  # Build pipeline config
```

---

## What's built in Phase 1

- Multi-tenant Postgres database with row-level security (FERPA compliant)
- Google OAuth authentication with role-based access control
- JWT session management
- Complete database schema: districts, users, budgets, scenarios, staff, programs, grants
- Impact model: translates budget cut inputs → student outcome projections
- Grant matching engine: evaluates eligibility for 5 federal/state grants
- Budget scenario CRUD with AI board memo generation
- Audit logging for every data access (FERPA requirement)
- Monorepo structure ready for Phase 2 (AI tutor) and Phase 3 (teacher dashboard)

---

## Next: Phase 2 — AI Tutoring Core

Once Phase 1 is running, Phase 2 adds:
- Student-facing tutoring chat interface
- Claude API session orchestrator
- Concept dependency graph
- Session analytics pipeline
