# AI District Budget Planner

AI-powered budget scenario planning tool for K-12 school districts.
Built for San Ramon Valley USD (SRVUSD) — works for any US public school district.

---

## Quick Start (Windows)

### 1. Prerequisites
Make sure you have these installed:
- Node.js v20+ → https://nodejs.org
- Git → https://git-scm.com

### 2. Clone & install dependencies
```bash
git clone https://github.com/<your-org>/district-budget-ai.git
cd district-budget-ai
npm install
```

### 3. Set up your .env file
Copy `.env.example` to `.env` and fill in:

```env
# From supabase.com → your project → Settings → API
SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# From supabase.com → Settings → Database → URI
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres

# From console.anthropic.com → API Keys
ANTHROPIC_API_KEY=sk-ant-...

# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-64-char-hex

NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Run the database migration
1. Go to supabase.com → your project → SQL Editor
2. Click "New query"
3. Paste the contents of `packages/db/migrations/001_initial_schema.sql`
4. Click Run → should show "Success"
5. Repeat for `packages/db/migrations/002_tutor_schema.sql`

### 5. Start the development servers

Open TWO PowerShell windows:

**Window 1 — API server:**
```bash
cd apps/api
npm install
npm run dev
# Runs on http://localhost:3001
```

**Window 2 — Frontend:**
```bash
cd apps/web
npm install
npm run dev
# Runs on http://localhost:3000
```

### 6. Create your first user
Go to supabase.com → Authentication → Users → Add user
Enter your email and password → Save

Then open http://localhost:3000 and log in!

---

## Project Structure

```
district-budget-ai/
├── apps/
│   ├── api/                    # Node.js/Express backend (port 3001)
│   │   └── src/
│   │       ├── index.ts        # Server entry point
│   │       ├── auth.ts         # Supabase JWT verification
│   │       ├── db.ts           # PostgreSQL connection + RLS
│   │       ├── routes/         # API endpoints
│   │       │   ├── scenarios.ts    # Budget scenarios + AI memo
│   │       │   ├── grants.ts       # Grant matching
│   │       │   ├── districts.ts    # Dashboard data
│   │       │   └── tutor.ts        # AI tutoring
│   │       └── services/       # Business logic
│   │           ├── impact-model.ts     # Outcome projections
│   │           ├── grant-matcher.ts    # Grant eligibility
│   │           └── tutor/              # AI tutor services
│   └── web/                    # Next.js 14 frontend (port 3000)
│       └── src/
│           ├── app/            # Pages (App Router)
│           │   ├── page.tsx            # Login page
│           │   └── dashboard/          # All dashboard pages
│           ├── components/     # React components
│           └── lib/            # API client, auth store
├── packages/
│   ├── db/migrations/          # SQL migration files
│   └── types/                  # Shared TypeScript types
└── docs/                       # Build guides
```

---

## Features

- **Budget scenario planner** — model staff cuts, class size changes, program reductions
- **Student outcome projections** — see impact on math scores, graduation rates, absenteeism
- **Grant matcher** — automatically matches district to Title I, E-Rate, IDEA, and more
- **AI board memo generator** — Claude drafts board resolutions and community FAQs
- **AI tutoring** — Socratic student tutor with mastery tracking
- **Teacher dashboard** — at-risk alerts, mastery heatmap, weekly AI reports

---

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Recharts
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Supabase) with Row-Level Security
- **Auth**: Supabase Auth (email/password)
- **AI**: Anthropic Claude API (Sonnet + Haiku)
