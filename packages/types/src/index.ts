// ============================================================
// SHARED TYPES — @district-budget/types
// Used by both the Next.js frontend and FastAPI/Node backend
// ============================================================

export type UserRole =
  | 'superintendent'
  | 'assistant_superintendent'
  | 'finance_director'
  | 'principal'
  | 'board_member'
  | 'viewer'

export type ScenarioStatus = 'draft' | 'under_review' | 'approved' | 'rejected' | 'archived'

export type GrantStatus = 'identified' | 'in_progress' | 'submitted' | 'awarded' | 'declined'

// ─── District ───────────────────────────────────────────────
export interface District {
  id: string
  name: string
  state: string
  ncesId?: string
  enrollment?: number
  highNeedsPct?: number
  createdAt: string
}

// ─── User ───────────────────────────────────────────────────
export interface User {
  id: string
  districtId: string
  email: string
  fullName: string
  role: UserRole
  lastLogin?: string
}

// ─── Budget ─────────────────────────────────────────────────
export interface DistrictBudget {
  id: string
  districtId: string
  fiscalYear: string
  totalRevenue: number        // in cents
  lcffRevenue?: number
  federalRevenue?: number
  localRevenue?: number
  totalExpenditure: number
  salaryExpenditure?: number
  benefitsExpenditure?: number
  servicesExpenditure?: number
  deficit: number             // computed: expenditure - revenue
  reservePct?: number
}

// ─── Staff ──────────────────────────────────────────────────
export type StaffCategory = 'teacher' | 'counselor' | 'administrator' | 'classified' | 'specialist' | 'aide'

export interface StaffPosition {
  id: string
  districtId: string
  title: string
  category: StaffCategory
  fte: number
  avgSalary: number
  benefitsRate: number
  totalCost: number           // computed
  isFilled: boolean
}

// ─── Programs ───────────────────────────────────────────────
export interface Program {
  id: string
  districtId: string
  name: string
  category: string
  annualCost: number
  studentsServed?: number
  costPerStudent?: number
  mathImpactCoeff: number
  elaImpactCoeff: number
  gradImpactCoeff: number
  absImpactCoeff: number
  isMandated: boolean
}

// ─── Budget Scenario ────────────────────────────────────────
export interface ScenarioInputs {
  staffReductions: number         // number of positions to cut
  classSizeIncrease: number       // avg additional students per class
  programCutPct: number           // % reduction across programs
  siteBudgetCutPct: number        // % reduction to site budgets
  salaryFreeze: boolean
}

export interface ScenarioOutputs {
  projectedSavings: number        // in cents
  projectedDeficit: number
  projectedReservePct: number
  mathProficiencyDelta: number    // percentage points
  elaProficiencyDelta: number
  gradRateDelta: number
  absenteeismDelta: number
  counselorRatioNew: number       // students per counselor
  teacherWorkloadDelta: number    // % change
}

export interface BudgetScenario {
  id: string
  districtId: string
  createdBy: string
  fiscalYear: string
  name: string
  description?: string
  status: ScenarioStatus
  inputs: ScenarioInputs
  outputs?: ScenarioOutputs
  boardMemoDraft?: string
  boardResolution?: string
  communityFaq?: string
  createdAt: string
  updatedAt: string
}

// ─── Grants ─────────────────────────────────────────────────
export interface FederalGrant {
  id: string
  name: string
  programCode: string
  fundingSource: 'federal' | 'state_ca' | 'private'
  description?: string
  typicalAmountMin?: number
  typicalAmountMax?: number
  applicationDeadline?: string
  applicationUrl?: string
  eligibilityRules: Record<string, unknown>
  isActive: boolean
}

export interface MatchedGrant {
  id: string
  districtId: string
  grant: FederalGrant
  estimatedAmount?: number
  matchConfidence: number
  applicationNarrative?: string
  status: GrantStatus
  matchedAt: string
}

// ─── API Response shapes ─────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Dashboard summary ───────────────────────────────────────
export interface DashboardSummary {
  district: District
  currentBudget: DistrictBudget
  openDeficit: number
  totalMatchedGrants: number
  matchedGrantsValue: number
  activeScenarios: number
  latestScenario?: BudgetScenario
}
