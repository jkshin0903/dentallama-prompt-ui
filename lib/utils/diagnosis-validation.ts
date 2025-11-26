import * as XLSX from 'xlsx'
import { loadDiagnosisTemplate } from './template-loader'

// Normalize string (trim and remove \r)
const normalizeString = (str: string): string => {
  return str.replace(/\r/g, '').trim()
}

// Validate diagnosis file against template
export const validateDiagnosisFile = async (
  file: File
): Promise<{
  valid: boolean
  error?: string
}> => {
  try {
    // Load template structure
    const template = await loadDiagnosisTemplate()

    if (!template || !template.columns || template.columns.length === 0) {
      return {
        valid: false,
        error: '템플릿 파일을 로드할 수 없습니다.'
      }
    }

    // Parse uploaded file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Get first row as headers
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: ''
    }) as string[][]

    if (!rows || rows.length === 0) {
      return {
        valid: false,
        error: 'Excel 파일이 비어있습니다.'
      }
    }

    const firstRow = rows[0]
    if (!firstRow || firstRow.length === 0) {
      return {
        valid: false,
        error: 'Excel 파일의 첫 번째 행이 비어있습니다.'
      }
    }

    // Normalize columns (template.columns is already normalized, but normalize again for safety)
    const normalizedFirstRow = firstRow.map(normalizeString)
    const normalizedTemplateColumns = template.columns.map(normalizeString)

    // Check if column count matches
    if (normalizedFirstRow.length !== normalizedTemplateColumns.length) {
      return {
        valid: false,
        error: `첫 번째 행의 컬럼 개수가 템플릿과 일치하지 않습니다. (템플릿: ${normalizedTemplateColumns.length}개, 현재: ${normalizedFirstRow.length}개)`
      }
    }

    // Check if each column matches exactly in order
    for (let i = 0; i < normalizedTemplateColumns.length; i++) {
      if (normalizedFirstRow[i] !== normalizedTemplateColumns[i]) {
        return {
          valid: false,
          error: `첫 번째 행의 ${i + 1}번째 컬럼이 템플릿과 일치하지 않습니다. (템플릿: "${normalizedTemplateColumns[i]}", 현재: "${normalizedFirstRow[i]}")`
        }
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('Error validating diagnosis file:', error)
    const errorMessage =
      error instanceof Error ? error.message : '알 수 없는 오류'
    return {
      valid: false,
      error: `파일 검증 중 오류가 발생했습니다: ${errorMessage}`
    }
  }
}
