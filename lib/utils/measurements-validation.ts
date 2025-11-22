import * as XLSX from 'xlsx'

// Expected first row columns (from template)
const EXPECTED_FIRST_ROW = [
  'Measurements',
  'Result',
  'Mean',
  'S.D.',
  'Severity'
]

// Expected measurement row values (35 rows, 2-36 rows in Excel)
const EXPECTED_MEASUREMENT_ROWS = [
  'SKELETON',
  'SNA',
  'SNB',
  'ANB',
  'A to N-Perp.',
  'Pog to N-Perp.',
  'Wits appraisal',
  'APDI',
  'ODI',
  'SN-GoMe',
  'FMA',
  'Facial height ratio(PFH/AFH)',
  'DENTAL',
  'Interincisal angle',
  'U1 to SN',
  'U1 to NA(deg)',
  'U1 to NA(mm)',
  'U1 to A-Pog(mm)',
  'IMPA',
  'L1 to NB(deg)',
  'L1 to NB(mm)',
  'L1 to A-Pog(mm)',
  'Occlusal plane to SN angle',
  'Overjet',
  'Overbite',
  'Growth prediction',
  'Saddle angle',
  'Articular angle',
  'Gonial angle',
  'Bjork sum',
  'Combination factor',
  'Body to Ant. cranial base ratio',
  'Soft tissue',
  'Upper lip to E-plane',
  'Lower lip to E-plane'
]

// Normalize string (trim and remove \r)
const normalizeString = (str: string): string => {
  return str.replace(/\r/g, '').trim()
}

// Validate first row columns match template exactly
const validateFirstRow = (
  firstRow: string[]
): { valid: boolean; error?: string } => {
  if (!firstRow || firstRow.length === 0) {
    return {
      valid: false,
      error: 'Excel 파일의 첫 번째 행이 비어있습니다.'
    }
  }

  const normalizedFirstRow = firstRow.map(normalizeString)
  const normalizedExpected = EXPECTED_FIRST_ROW.map(normalizeString)

  // Check if length matches
  if (normalizedFirstRow.length !== normalizedExpected.length) {
    return {
      valid: false,
      error: `첫 번째 행의 컬럼 개수가 템플릿과 일치하지 않습니다. (템플릿: ${normalizedExpected.length}개, 현재: ${normalizedFirstRow.length}개)`
    }
  }

  // Check if each column matches exactly
  for (let i = 0; i < normalizedExpected.length; i++) {
    if (normalizedFirstRow[i] !== normalizedExpected[i]) {
      return {
        valid: false,
        error: `첫 번째 행의 ${i + 1}번째 컬럼이 템플릿과 일치하지 않습니다. (템플릿: "${normalizedExpected[i]}", 현재: "${normalizedFirstRow[i]}")`
      }
    }
  }

  return { valid: true }
}

// Validate measurement rows match template exactly
const validateMeasurementRows = (
  measurementRows: string[]
): { valid: boolean; error?: string } => {
  // Check if row count matches
  if (measurementRows.length !== EXPECTED_MEASUREMENT_ROWS.length) {
    return {
      valid: false,
      error: `측정 항목 행의 개수가 템플릿과 일치하지 않습니다. (템플릿: ${EXPECTED_MEASUREMENT_ROWS.length}개, 현재: ${measurementRows.length}개)`
    }
  }

  // Check if each row matches exactly in order
  for (let i = 0; i < EXPECTED_MEASUREMENT_ROWS.length; i++) {
    const normalizedRow = normalizeString(measurementRows[i] || '')
    const expectedRow = EXPECTED_MEASUREMENT_ROWS[i]
    if (normalizedRow !== expectedRow) {
      return {
        valid: false,
        error: `${i + 2}번째 행의 첫 번째 컬럼이 템플릿과 일치하지 않습니다. (템플릿: "${expectedRow}", 현재: "${normalizedRow}")`
      }
    }
  }

  return { valid: true }
}

// Validate measurements file
export const validateMeasurementsFile = async (
  file: File
): Promise<{
  valid: boolean
  error?: string
}> => {
  try {
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
    const firstRowValidation = validateFirstRow(firstRow)
    if (!firstRowValidation.valid) {
      return firstRowValidation
    }

    // Check if we have enough rows for measurements
    const expectedTotalRows = EXPECTED_MEASUREMENT_ROWS.length + 1
    if (allRows.length < expectedTotalRows) {
      return {
        valid: false,
        error: `Excel 파일에 최소 ${expectedTotalRows}개의 행이 필요합니다. (템플릿: ${expectedTotalRows}개, 현재: ${allRows.length}개)`
      }
    }

    // Extract first column values from rows 2-36 (indices 1-35)
    const measurementRows = allRows
      .slice(1, expectedTotalRows)
      .map(row => (row[0] || '').toString())

    // Validate measurement rows - must match template exactly
    const rowsValidation = validateMeasurementRows(measurementRows)
    if (!rowsValidation.valid) {
      return rowsValidation
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: 'Excel 파일을 읽는 중 오류가 발생했습니다.'
    }
  }
}
