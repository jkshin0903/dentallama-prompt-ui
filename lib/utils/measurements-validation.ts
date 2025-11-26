import * as XLSX from 'xlsx'
import { loadMeasurementsTemplate } from './template-loader'

// Normalize string (trim and remove \r)
const normalizeString = (str: string): string => {
  return str.replace(/\r/g, '').trim()
}

// Validate measurements file against template
export const validateMeasurementsFile = async (
  file: File
): Promise<{
  valid: boolean
  error?: string
}> => {
  try {
    // Load template structure
    const template = await loadMeasurementsTemplate()

    if (!template.dataRows) {
      return {
        valid: false,
        error: '템플릿 파일에서 측정 항목 데이터를 읽을 수 없습니다.'
      }
    }

    // Parse uploaded file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Get all rows
    const allRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: ''
    }) as string[][]

    if (!allRows || allRows.length === 0) {
      return {
        valid: false,
        error: 'Excel 파일이 비어있습니다.'
      }
    }

    // Validate first row (columns) - must match template exactly
    const firstRow = allRows[0]
    if (!firstRow || firstRow.length === 0) {
      return {
        valid: false,
        error: 'Excel 파일의 첫 번째 행이 비어있습니다.'
      }
    }

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

    // Check if we have enough rows for measurements
    const expectedTotalRows = template.totalRows
    if (allRows.length < expectedTotalRows) {
      return {
        valid: false,
        error: `Excel 파일에 최소 ${expectedTotalRows}개의 행이 필요합니다. (템플릿: ${expectedTotalRows}개, 현재: ${allRows.length}개)`
      }
    }

    // Extract first column values from data rows
    const measurementRows = allRows
      .slice(1, expectedTotalRows)
      .map(row => normalizeString((row[0] || '').toString()))

    // Validate measurement rows - must match template exactly
    if (measurementRows.length !== template.dataRows.length) {
      return {
        valid: false,
        error: `측정 항목 행의 개수가 템플릿과 일치하지 않습니다. (템플릿: ${template.dataRows.length}개, 현재: ${measurementRows.length}개)`
      }
    }

    // Check if each row matches exactly in order
    for (let i = 0; i < template.dataRows.length; i++) {
      const normalizedRow = normalizeString(measurementRows[i] || '')
      const expectedRow = normalizeString(template.dataRows[i])
      if (normalizedRow !== expectedRow) {
        return {
          valid: false,
          error: `${i + 2}번째 행의 첫 번째 컬럼이 템플릿과 일치하지 않습니다. (템플릿: "${expectedRow}", 현재: "${normalizedRow}")`
        }
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('Error validating measurements file:', error)
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Excel 파일을 읽는 중 오류가 발생했습니다.'
    }
  }
}
