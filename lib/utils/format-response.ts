/**
 * Formats API response text to improve readability
 * Handles Gemma 4-line plans and legacy `0:"..."` SSE artifacts
 */
export function formatResponseText(text: string): string {
  if (!text) return text

  // Pattern: number:"content" (e.g., 0:"교정: 전체\n발치: ...")
  const indexPattern = /^\d+:"([^"]*(?:\\.[^"]*)*)"/
  const match = text.match(indexPattern)

  if (match && match[1]) {
    let content = match[1]
    content = unescapeText(content)
    return formatTreatmentPlanLines(content)
  }

  const unescaped = unescapeText(text)
  if (looksLikeTreatmentPlan(unescaped)) {
    return formatTreatmentPlanLines(unescaped)
  }

  return text
}

function unescapeText(content: string): string {
  return content
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function looksLikeTreatmentPlan(text: string): boolean {
  return /교정|발치|추가시술|치료\s*기간/.test(text)
}

function formatValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'null') return '-'
  return trimmed
}

function formatTreatmentPlanLines(content: string): string {
  const lines = content.split('\n')
  const formattedLines = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''

    if (trimmed.startsWith('**')) return trimmed

    const parenMatch = trimmed.match(/^(.+?)\s*\((.*)\)\s*$/)
    if (parenMatch) {
      return `**${parenMatch[1].trim()}**: ${formatValue(parenMatch[2])}`
    }

    if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':')
      const value = valueParts.join(':').trim()
      return `**${key.trim()}**: ${formatValue(value)}`
    }

    if (trimmed === 'null') return '-'
    return trimmed
  })

  return formattedLines.filter(line => line).join('\n\n')
}
