import * as XLSX from 'xlsx'

/**
 * Parse measurements file and extract measurements as key-value pairs
 * @param file Measurements Excel file
 * @returns Object with measurement names as keys and Result values as values
 */
export async function parseMeasurementsFile(
  file: File
): Promise<Record<string, number | null>> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Parse as JSON with header row
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: ['Measurements', 'Result', 'Mean', 'S.D.', 'Severity'],
      defval: ''
    }) as Array<{
      Measurements: string
      Result: string | number
      Mean: string | number
      'S.D.': string | number
      Severity: string
    }>

    // Convert to object with measurement name as key and Result as value
    const measurements: Record<string, number | null> = {}

    // Skip header row and process data rows
    for (const row of data) {
      const measurementName = row.Measurements?.trim()

      // Skip empty rows and header row (where Measurements equals "Measurements")
      if (!measurementName || measurementName === 'Measurements') continue

      // Convert Result to number if possible
      let resultValue: number | null = null
      if (typeof row.Result === 'number') {
        resultValue = row.Result
      } else if (typeof row.Result === 'string') {
        const trimmed = row.Result.trim()
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
