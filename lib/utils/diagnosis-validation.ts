import * as XLSX from 'xlsx'
import { z } from 'zod'

// Required columns for diagnosis files
const REQUIRED_COLUMNS = ['Patient ID', 'Diagnosis', 'ETC']

// Zod schema for diagnosis file columns
const diagnosisColumnsSchema = z.object({
  columns: z.array(z.string()).refine(
    cols => {
      const normalizedCols = cols.map(col => col.trim())
      return REQUIRED_COLUMNS.every(col => normalizedCols.includes(col))
    },
    {
      message: `Excel 파일의 첫 번째 행에 "${REQUIRED_COLUMNS.join('", "')}" 컬럼이 필요합니다.`
    }
  )
})

// Validate diagnosis file columns
export const validateDiagnosisFile = async (
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

    // Get first row as headers
    const firstRow = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: ''
    })[0] as string[]

    if (!firstRow || firstRow.length === 0) {
      return {
        valid: false,
        error: 'Excel 파일의 첫 번째 행이 비어있습니다.'
      }
    }

    const result = diagnosisColumnsSchema.safeParse({ columns: firstRow })
    if (!result.success) {
      return {
        valid: false,
        error: result.error.errors[0]?.message || '컬럼 검증에 실패했습니다.'
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: 'Excel 파일을 읽는 중 오류가 발생했습니다.'
    }
  }
}
