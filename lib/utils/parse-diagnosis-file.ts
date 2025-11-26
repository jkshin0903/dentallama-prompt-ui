import * as XLSX from 'xlsx'

/**
 * Parse diagnosis file and extract diagnosis value
 * @param file Diagnosis Excel file
 * @returns Diagnosis string value or null if not found
 */
export async function parseDiagnosisFile(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Parse as JSON with header row (new template structure)
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: [
        '라벨번호',
        'ChiefComplain',
        'Diagnosis',
        'TreatmentPlan',
        'etc'
      ],
      defval: ''
    }) as Array<{
      라벨번호: string
      ChiefComplain: string
      Diagnosis: string
      TreatmentPlan: string
      etc: string
    }>

    // Get first data row's diagnosis value (skip header row)
    // Header row has Diagnosis === "Diagnosis", so skip it
    for (const row of data) {
      const diagnosis = row.Diagnosis?.trim()
      // Skip header row where Diagnosis equals "Diagnosis"
      if (diagnosis && diagnosis !== 'Diagnosis') {
        return diagnosis
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing diagnosis file:', error)
    return null
  }
}
