import * as XLSX from 'xlsx'

/**
 * Template structure extracted from Excel files
 */
export interface TemplateStructure {
  columns: string[]
  dataRows?: string[] // For measurements, the first column values of data rows
  totalRows: number
}

/**
 * Normalize string (trim and remove \r)
 */
const normalizeString = (str: string): string => {
  return str.replace(/\r/g, '').trim()
}

// Cache for loaded templates
let diagnosisTemplateCache: TemplateStructure | null = null
let measurementsTemplateCache: TemplateStructure | null = null

/**
 * Load and parse diagnosis template from public folder
 */
export async function loadDiagnosisTemplate(): Promise<TemplateStructure> {
  // Return cached template if available
  if (diagnosisTemplateCache) {
    return diagnosisTemplateCache
  }

  try {
    const response = await fetch('/excel-templates/diagnosis.xlsx')
    if (!response.ok) {
      throw new Error(
        `템플릿 파일을 불러올 수 없습니다. (${response.status} ${response.statusText})`
      )
    }
    const arrayBuffer = await response.arrayBuffer()

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('템플릿 파일이 비어있습니다.')
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('템플릿 파일에 시트가 없습니다.')
    }

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    if (!worksheet) {
      throw new Error('템플릿 파일의 첫 번째 시트를 읽을 수 없습니다.')
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: ''
    }) as string[][]

    if (!rows || rows.length === 0) {
      throw new Error('템플릿 파일이 비어있습니다.')
    }

    if (!rows[0] || rows[0].length === 0) {
      throw new Error('템플릿 파일의 첫 번째 행이 비어있습니다.')
    }

    const columns = rows[0].map(normalizeString)

    const template: TemplateStructure = {
      columns,
      totalRows: rows.length
    }

    // Cache the template
    diagnosisTemplateCache = template

    return template
  } catch (error) {
    console.error('Error loading diagnosis template:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('템플릿 파일을 로드하는 중 알 수 없는 오류가 발생했습니다.')
  }
}

/**
 * Load and parse measurements template from public folder
 */
export async function loadMeasurementsTemplate(): Promise<TemplateStructure> {
  // Return cached template if available
  if (measurementsTemplateCache) {
    return measurementsTemplateCache
  }

  try {
    const response = await fetch('/excel-templates/measurements.xlsx')
    if (!response.ok) {
      throw new Error(
        `Failed to load measurements template: ${response.statusText}`
      )
    }
    const arrayBuffer = await response.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: ''
    }) as string[][]

    if (!rows || rows.length === 0) {
      throw new Error('Measurements template is empty')
    }

    const columns = rows[0].map(normalizeString)
    const dataRows = rows
      .slice(1)
      .map(row => normalizeString((row[0] || '').toString()))

    const template: TemplateStructure = {
      columns,
      dataRows,
      totalRows: rows.length
    }

    // Cache the template
    measurementsTemplateCache = template

    return template
  } catch (error) {
    console.error('Error loading measurements template:', error)
    throw error
  }
}
