'use client'

import { Button } from './ui/button'

interface ModelSelectorProps {
  models?: any[] // Keep for backward compatibility but not used
}

export function ModelSelector({ models }: ModelSelectorProps) {
  return (
    <Button
      variant="outline"
      className="text-sm rounded-full shadow-none focus:ring-0"
      disabled
    >
      <span className="text-xs font-medium">Custom Model</span>
    </Button>
  )
}
