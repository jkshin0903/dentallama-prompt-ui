'use client'

import { useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'

interface ModelSelectorProps {
  models?: any[] // Keep for backward compatibility but not used
  onModelChange?: (model: string) => void
}

export function ModelSelector({ models, onModelChange }: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState('treatment-plan-gen')

  const handleChange = (value: string) => {
    setSelectedModel(value)
    onModelChange?.(value)
  }

  return (
    <Select value={selectedModel} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-[140px] text-xs rounded-full shadow-none focus:ring-0 border-input">
        <SelectValue placeholder="Custom Model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="treatment-plan-gen">진단 생성</SelectItem>
        <SelectItem value="model-b">Model B</SelectItem>
        <SelectItem value="model-c">Model C</SelectItem>
      </SelectContent>
    </Select>
  )
}
