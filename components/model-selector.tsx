'use client'

import {
  DEFAULT_TREATMENT_PLAN_MODEL,
  TREATMENT_PLAN_MODELS
} from '@/lib/config/treatment-plan'
import { TreatmentPlanModelId } from '@/lib/types/treatment-plan'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'

interface ModelSelectorProps {
  models?: any[] // Keep for backward compatibility but not used
  value?: string
  onModelChange?: (model: string) => void
}

export function ModelSelector({ value, onModelChange }: ModelSelectorProps) {
  const selectedModel = (value ||
    DEFAULT_TREATMENT_PLAN_MODEL) as TreatmentPlanModelId

  const handleChange = (nextValue: string) => {
    onModelChange?.(nextValue)
  }

  return (
    <Select value={selectedModel} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-[200px] text-xs rounded-full shadow-none focus:ring-0 border-input">
        <SelectValue placeholder="모델 선택" />
      </SelectTrigger>
      <SelectContent>
        {TREATMENT_PLAN_MODELS.map(model => (
          <SelectItem key={model.id} value={model.id}>
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
