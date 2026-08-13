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

function getPreferredSheet(
  workbook: XLSX.WorkBook,
  preferredSheet?: string
): XLSX.WorkSheet {
  const sheetName =
    preferredSheet && workbook.SheetNames.includes(preferredSheet)
      ? preferredSheet
      : workbook.SheetNames[0]

  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error('템플릿 파일의 시트를 읽을 수 없습니다.')
  }

  return workbook.Sheets[sheetName]
}

async function loadExcelTemplate(
  path: string,
  preferredSheet?: string
): Promise<TemplateStructure> {
  const response = await fetch(path)
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

  const worksheet = getPreferredSheet(workbook, preferredSheet)
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
  const dataRows = rows
    .slice(1)
    .map(row => normalizeString((row[0] || '').toString()))

  return {
    columns,
    dataRows,
    totalRows: rows.length
  }
}

// Cache for loaded templates
let diagnosisTemplateCache: TemplateStructure | null = null
let measurementsTemplateCache: TemplateStructure | null = null
let analysisChartTemplateCache: TemplateStructure | null = null

/**
 * Load and parse diagnosis template from public folder
 */
export async function loadDiagnosisTemplate(): Promise<TemplateStructure> {
  if (diagnosisTemplateCache) {
    return diagnosisTemplateCache
  }

  try {
    const template = await loadExcelTemplate('/excel-templates/diagnosis.xlsx')
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
  if (measurementsTemplateCache) {
    return measurementsTemplateCache
  }

  try {
    const template = await loadExcelTemplate(
      '/excel-templates/measurements.xlsx'
    )
    measurementsTemplateCache = template
    return template
  } catch (error) {
    console.error('Error loading measurements template:', error)
    throw error
  }
}

/**
 * Load AnalysisChart template used by OrthoPlanner
 */
export async function loadAnalysisChartTemplate(): Promise<TemplateStructure> {
  if (analysisChartTemplateCache) {
    return analysisChartTemplateCache
  }

  try {
    const template = await loadExcelTemplate(
      '/excel-templates/analysis-chart.xlsx',
      'AnalysisChart'
    )
    analysisChartTemplateCache = template
    return template
  } catch (error) {
    console.error('Error loading AnalysisChart template:', error)
    throw error
  }
}
