// Client-side impact model — runs instantly on slider change
// Mirrors apps/api/src/services/impact-model.ts

const COEFFICIENTS = {
  classSizeMathImpact: -0.30,
  classSizeElaImpact: -0.22,
  classSizeGradImpact: -0.08,
  classSizeAbsImpact: 0.15,
  staffCutMathImpact: -0.038,
  staffCutElaImpact: -0.028,
  staffCutGradImpact: -0.012,
  staffCutAbsImpact: 0.022,
  programCutMathImpact: -0.045,
  programCutElaImpact: -0.035,
  programCutGradImpact: -0.025,
  programCutAbsImpact: 0.018,
}

interface Inputs {
  staffReductions: number
  classSizeIncrease: number
  programCutPct: number
  siteBudgetCutPct: number
  salaryFreeze: boolean
}

interface Context {
  enrollment: number
  totalStaff: number
  counselorFte: number
  currentDeficit: number
  avgSalaryWithBenefits: number
}

export function computeOutcomes(inputs: Inputs, context: Context) {
  const { staffReductions, classSizeIncrease, programCutPct, siteBudgetCutPct, salaryFreeze } = inputs

  const staffSavings = staffReductions * context.avgSalaryWithBenefits
  const programSavings = Math.round((programCutPct / 100) * context.enrollment * 180_00)
  const siteSavings = Math.round((siteBudgetCutPct / 100) * context.enrollment * 420_00)
  const freezeSavings = salaryFreeze
    ? Math.round(context.totalStaff * context.avgSalaryWithBenefits * 0.025)
    : 0

  const projectedSavings = staffSavings + programSavings + siteSavings + freezeSavings
  const projectedDeficit = context.currentDeficit - projectedSavings

  const mathProficiencyDelta = r2(
    classSizeIncrease * COEFFICIENTS.classSizeMathImpact +
    staffReductions   * COEFFICIENTS.staffCutMathImpact +
    programCutPct     * COEFFICIENTS.programCutMathImpact
  )
  const elaProficiencyDelta = r2(
    classSizeIncrease * COEFFICIENTS.classSizeElaImpact +
    staffReductions   * COEFFICIENTS.staffCutElaImpact +
    programCutPct     * COEFFICIENTS.programCutElaImpact
  )
  const gradRateDelta = r2(
    classSizeIncrease * COEFFICIENTS.classSizeGradImpact +
    staffReductions   * COEFFICIENTS.staffCutGradImpact +
    programCutPct     * COEFFICIENTS.programCutGradImpact
  )
  const absenteeismDelta = r2(
    classSizeIncrease * COEFFICIENTS.classSizeAbsImpact +
    staffReductions   * COEFFICIENTS.staffCutAbsImpact +
    programCutPct     * COEFFICIENTS.programCutAbsImpact
  )

  const counselorCutRatio = staffReductions / Math.max(context.totalStaff, 1)
  const remainingCounselorFte = context.counselorFte * (1 - counselorCutRatio)
  const counselorRatioNew = remainingCounselorFte > 0
    ? r2(context.enrollment / remainingCounselorFte)
    : 9999

  const teacherWorkloadDelta = r2(
    (classSizeIncrease / 28) * 100 +
    (staffReductions / context.totalStaff) * 15
  )

  const projectedReservePct = r2(Math.max(0.5, 3.2 - (staffReductions / 200) * 1.5))

  return {
    projectedSavings,
    projectedDeficit,
    projectedReservePct,
    mathProficiencyDelta,
    elaProficiencyDelta,
    gradRateDelta,
    absenteeismDelta,
    counselorRatioNew,
    teacherWorkloadDelta,
  }
}

function r2(n: number) {
  return Math.round(n * 100) / 100
}
