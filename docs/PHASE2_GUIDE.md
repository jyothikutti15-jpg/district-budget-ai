## Phase 2: AI Tutoring Core (Weeks 5–10)

Built on top of Phase 1 foundation.

---

### Step 1 — Run the Phase 2 database migration

```bash
psql $DATABASE_URL -f packages/db/migrations/002_tutor_schema.sql

# Verify new tables:
psql $DATABASE_URL -c "\dt"
# New tables: students, concept_nodes, concept_edges,
#             student_mastery, tutor_sessions, session_messages,
#             student_risk_scores, weekly_reports
```

---

### Step 2 — Seed a test student

```bash
psql $DATABASE_URL << 'EOF'
INSERT INTO students (id, district_id, display_name, grade_level, language_pref)
VALUES (
  'demo-student-001',
  '00000000-0000-0000-0000-000000000001',
  'Arjun',
  5,
  'en'
);
EOF
```

---

### Step 3 — Test the tutor API

```bash
# Start a session
curl -X POST http://localhost:3001/api/tutor/sessions/start \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "demo-student-001", "subject": "math"}'

# Send a message (streaming)
curl -X POST http://localhost:3001/api/tutor/sessions/SESSION_ID/message \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentMessage": "Is it 3/8?", "studentId": "demo-student-001"}'
```

---

### Step 4 — Test nightly scoring (no need to wait overnight)

```bash
curl -X POST http://localhost:3001/api/tutor/admin/run-scoring \
  -H "Authorization: Bearer $JWT_TOKEN"

# View at-risk students
curl http://localhost:3001/api/tutor/teacher/at-risk \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Step 5 — Generate weekly reports

```bash
curl -X POST http://localhost:3001/api/tutor/admin/generate-reports \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Phase 2 file summary

**New backend files:**
- `apps/api/src/routes/tutor.ts` — All tutor endpoints
- `apps/api/src/services/tutor/session-orchestrator.ts` — Claude conversation manager
- `apps/api/src/services/tutor/error-classifier.ts` — Error type classification (Haiku)
- `apps/api/src/services/tutor/mastery-engine.ts` — Bayesian mastery updates + next concept selection
- `apps/api/src/services/tutor/risk-scorer.ts` — Nightly at-risk scoring + weekly AI reports

**New frontend files:**
- `apps/web/src/app/dashboard/tutor/page.tsx` — Student-facing chat with SSE streaming + read aloud
- `apps/web/src/app/dashboard/teacher/page.tsx` — Teacher alerts, mastery heatmap, weekly reports

**New database:**
- `packages/db/migrations/002_tutor_schema.sql` — 8 new tables, 20 concept nodes, prerequisite graph

---

### Phase 3 coming next

- Infinite Campus SIS roster sync
- SendGrid morning alert emails to teachers
- District admin portal for managing students and teachers
- Parent portal (multilingual, push notifications)
- Absenteeism detection + automated outreach
