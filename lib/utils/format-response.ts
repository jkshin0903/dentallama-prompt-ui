/**
 * Formats API response text to improve readability
 * Handles patterns like: 0:"교정: 전체\n발치: 44/44 발치\n추가시술: null\n치료 기간: 2년~2년 6개월"
 */
export function formatResponseText(text: string): string {
  if (!text) return text

  // Pattern: number:"content" (e.g., 0:"교정: 전체\n발치: ...")
  const indexPattern = /^\d+:"([^"]*(?:\\.[^"]*)*)"/
  const match = text.match(indexPattern)

  if (match && match[1]) {
    // Extract the content inside quotes
    let content = match[1]

    // Unescape escaped characters (e.g., \n -> newline)
    content = content.replace(/\\n/g, '\n')
    content = content.replace(/\\t/g, '\t')
    content = content.replace(/\\"/g, '"')
    content = content.replace(/\\\\/g, '\\')

    // Replace "null" with "-" for better readability
    content = content.replace(/:\s*null/g, ': -')

    // Format key-value pairs for better readability
    // Split by newlines and format each line
    const lines = content.split('\n')
    const formattedLines = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''

      // If line contains ":", format as key-value pair
      if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':')
        const value = valueParts.join(':').trim()
        return `**${key.trim()}**: ${value || '-'}`
      }

      return trimmed
    })

    return formattedLines.filter(line => line).join('\n\n')
  }

  // If pattern doesn't match, check if it contains the specific format
  // Pattern: 교정: 전체\n발치: ... (without the index prefix)
  if (
    text.includes('교정:') ||
    text.includes('발치:') ||
    text.includes('추가시술:') ||
    text.includes('치료 기간:')
  ) {
    let content = text

    // Unescape escaped characters
    content = content.replace(/\\n/g, '\n')
    content = content.replace(/\\t/g, '\t')
    content = content.replace(/\\"/g, '"')
    content = content.replace(/\\\\/g, '\\')

    // Replace "null" with "-"
    content = content.replace(/:\s*null/g, ': -')

    // Format key-value pairs
    const lines = content.split('\n')
    const formattedLines = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''

      if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':')
        const value = valueParts.join(':').trim()
        return `**${key.trim()}**: ${value || '-'}`
      }

      return trimmed
    })

    return formattedLines.filter(line => line).join('\n\n')
  }

  // Return original text if no pattern matches
  return text
}
