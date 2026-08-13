import { TreatmentPlanModelId } from '@/lib/types/treatment-plan'

export const DEFAULT_TREATMENT_PLAN_MODEL: TreatmentPlanModelId = 'gemma'

export const INFERENCE_TIMEOUT_MS = 600_000
export const INFERENCE_MAX_DURATION_SEC = 600

export const TREATMENT_PLAN_ENDPOINTS = {
  gemma: '/api/v1/gemma/treatment-plan',
  orthoplanner: '/api/v1/orthoplanner/treatment-plan'
} as const

const MODEL_ALIASES: Record<string, TreatmentPlanModelId> = {
  gemma: 'gemma',
  'gemma-3': 'gemma',
  'treatment-plan-gen': 'gemma',
  orthoplanner: 'orthoplanner',
  'model-b': 'orthoplanner'
}

export const TREATMENT_PLAN_MODELS: Array<{
  id: TreatmentPlanModelId
  label: string
}> = [
  { id: 'gemma', label: 'Gemma (DentalLama)' },
  { id: 'orthoplanner', label: 'OrthoPlanner' }
]

export function resolveTreatmentPlanModel(
  model?: string | null
): TreatmentPlanModelId {
  if (!model) return DEFAULT_TREATMENT_PLAN_MODEL
  return MODEL_ALIASES[model] ?? DEFAULT_TREATMENT_PLAN_MODEL
}

export function isTreatmentPlanModel(model?: string | null): boolean {
  if (!model) return false
  return model in MODEL_ALIASES
}
