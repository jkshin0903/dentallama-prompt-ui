import * as XLSX from 'xlsx'

import { loadAnalysisChartTemplate } from './template-loader'

/**
 * Parse AnalysisChart `normal` cell values like `78.42 *` or `34.52 **`
 */
export function parseAnalysisChartValue(
  raw: string | number | null | undefined
): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return raw
  }

  if (typeof raw !== 'string') return null

  const cleaned = raw.replace(/\*/g, '').replace(/,/g, '').trim()
  if (!cleaned) return null

  const parsed = parseFloat(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Parse OrthoPlanner AnalysisChart.xlsx
 * Patient values live in the 4th column (`normal`).
 */
export async function parseAnalysisChartFile(
  file: File
): Promise<Record<string, number | null>> {
  try {
    const template = await loadAnalysisChartTemplate()
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames.includes('AnalysisChart')
      ? 'AnalysisChart'
      : workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: template.columns,
      defval: ''
    }) as Array<Record<string, string | number>>

    const measurements: Record<string, number | null> = {}
    const nameColumn = template.columns[0]
    const valueColumn = template.columns[3] || 'normal'

    for (const row of data) {
      const measurementName = String(row[nameColumn] || '')
        .replace(/\r/g, '')
        .trim()

      if (!measurementName || measurementName === nameColumn) continue

      measurements[measurementName] = parseAnalysisChartValue(row[valueColumn])
    }

    return measurements
  } catch (error) {
    console.error('Error parsing AnalysisChart file:', error)
    return {}
  }
}
