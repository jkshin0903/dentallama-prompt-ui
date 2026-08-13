import * as XLSX from 'xlsx'

import { loadMeasurementsTemplate } from './template-loader'

/**
 * Parse measurements file and extract measurements as key-value pairs
 * @param file Measurements Excel file
 * @returns Object with measurement names as keys and Result values as values
 */
export async function parseMeasurementsFile(
  file: File
): Promise<Record<string, number | null>> {
  try {
    // Load template to get exact column names
    const template = await loadMeasurementsTemplate()

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Parse as JSON with header row using template columns
    // XLSX will match headers case-insensitively and handle whitespace
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: template.columns,
      defval: ''
    }) as Array<Record<string, string | number>>

    // Convert to object with measurement name as key and Result as value
    const measurements: Record<string, number | null> = {}

    // Get the column name for measurements (first column) and result (second column)
    const measurementsColumn = template.columns[0]
    const resultColumn = template.columns[1]

    // Skip header row and process data rows
    for (const row of data) {
      const measurementName = (row[measurementsColumn] as string)
        ?.replace(/\r/g, '')
        .trim()

      // Skip empty rows and header row (where measurement name equals the column header)
      if (!measurementName || measurementName === measurementsColumn) continue

      // Convert Result to number if possible
      let resultValue: number | null = null
      const result = row[resultColumn]
      if (typeof result === 'number') {
        resultValue = result
      } else if (typeof result === 'string') {
        const trimmed = result.trim()
        if (trimmed) {
          const parsed = parseFloat(trimmed)
          if (!isNaN(parsed)) {
            resultValue = parsed
          }
        }
      }

      measurements[measurementName] = resultValue
    }

    return measurements
  } catch (error) {
    console.error('Error parsing measurements file:', error)
    return {}
  }
}
