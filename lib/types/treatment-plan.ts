export const TREATMENT_PLAN_MODEL_IDS = ['gemma', 'orthoplanner'] as const

export type TreatmentPlanModelId = (typeof TREATMENT_PLAN_MODEL_IDS)[number]

export type TreatmentPlanGender = 'Male' | 'Female' | 'M' | 'F'

export type OrthoPlannerScope = 'full' | 'partial' | 'surgical'

export interface GemmaFilePayload {
  name: string
  type: string
  size: number
  content: string
}

export interface GemmaTreatmentPlanRequest {
  id?: string
  model: string
  messages: Array<{
    role: string
    content: string
  }>
  files: GemmaFilePayload[]
}

export interface GemmaTreatmentPlanResponse {
  response: string
}

export interface OrthoPlannerTreatmentPlanRequest {
  ceph: string
  analysischart?: Record<string, number>
  analysiscsv?: string
  analysisexcel_b64?: string
  diagnosis?: string
  age?: string
  gender?: string
  model?: string
  fold?: number
  hard_reflect_head?: boolean
  prompt_mode?: 'legacy' | 'promptpp' | 'promptpp_compact'
  gen_select?: 'greedy' | 'head_rerank'
}

export interface OrthoPlannerDecisionHead {
  prediction: number
  label: string
  confidence: number
}

export interface OrthoPlannerTreatmentPlanResponse {
  treatment_plan: string
  parsed?: {
    scope?: OrthoPlannerScope | string
    extraction?: number
    duration?: number
  }
  decision_head?: {
    scope?: OrthoPlannerDecisionHead
    extraction?: OrthoPlannerDecisionHead
    surgery?: OrthoPlannerDecisionHead
  }
  hedge?: number
  duration_months_est?: number
  measurements_used?: Record<string, number>
  model?: string
  model_fold?: number
  model_checkpoint?: string
  prompt_mode?: string
  gen_select?: string
}

export interface TreatmentPlanClientPayload {
  id?: string
  model?: string
  messages?: Array<{
    role: string
    content: string
  }>
  files?: Array<{
    name: string
    type: string
    size?: number
    content: string | number[]
  }>
  diagnosis?: string
  age?: string
  gender?: string
  measurements?: Record<string, number | null>
}
