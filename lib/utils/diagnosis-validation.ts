import * as XLSX from 'xlsx'

import { resolveTreatmentPlanModel } from '@/lib/config/treatment-plan'
import { TreatmentPlanModelId } from '@/lib/types/treatment-plan'

import {
  loadAnalysisChartTemplate,
  loadDiagnosisTemplate,
  loadMeasurementsTemplate,
  TemplateStructure
} from './template-loader'

export interface StructuredDiagnosis {
  chiefComplain: string
  diagnosis: string
  treatmentPlan: string
  etc: string
}

// Diagnosis files interface
export interface DiagnosisFiles {
  diagnosis?: StructuredDiagnosis
  measurements?: File
  analysisChart?: File
  images: File[]
}

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

// Validate diagnosis input fields and return field-specific errors
export const validateDiagnosisFields = (diagnosis?: {
  chiefComplain: string
  diagnosis: string
  treatmentPlan: string
  etc: string
}): {
  valid: boolean
  errors: {
    chiefComplain?: string
    diagnosis?: string
    treatmentPlan?: string
    etc?: string
  }
} => {
  const errors: {
    chiefComplain?: string
    diagnosis?: string
    treatmentPlan?: string
    etc?: string
  } = {}

  if (!diagnosis) {
    // If no diagnosis object, set error on required fields (excluding etc)
    errors.chiefComplain = 'Chief Complain을 입력해주세요.'
    errors.diagnosis = 'Diagnosis를 입력해주세요.'
    errors.treatmentPlan = 'Treatment Plan을 입력해주세요.'
    return { valid: false, errors }
  }

  const {
    chiefComplain,
    diagnosis: diagnosisValue,
    treatmentPlan,
    etc
  } = diagnosis

  // Check if required fields are filled (etc is optional)
  if (!chiefComplain.trim()) {
    errors.chiefComplain = 'Chief Complain을 입력해주세요.'
  }
  if (!diagnosisValue.trim()) {
    errors.diagnosis = 'Diagnosis를 입력해주세요.'
  }
  if (!treatmentPlan.trim()) {
    errors.treatmentPlan = 'Treatment Plan을 입력해주세요.'
  }
  // etc field is optional, no validation needed

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, errors: {} }
}

// Validate all required fields for diagnosis submission
export const validateAllFields = (
  files: DiagnosisFiles,
  model?: string
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  const resolvedModel: TreatmentPlanModelId = resolveTreatmentPlanModel(model)

  const diagnosisValidation = validateDiagnosisFields(files.diagnosis)
  if (!diagnosisValidation.valid) {
    const diagnosisErrors = Object.values(diagnosisValidation.errors).filter(
      Boolean
    )
    if (diagnosisErrors.length > 0) {
      errors.push(...diagnosisErrors)
    }
  }

  if (resolvedModel === 'orthoplanner') {
    if (!files.analysisChart) {
      errors.push('AnalysisChart 파일을 업로드해주세요.')
    }
  } else if (!files.measurements) {
    errors.push('Measurements 파일을 업로드해주세요.')
  }

  // Validate Images
  if (!files.images || files.images.length === 0) {
    errors.push('Ceph 이미지 파일을 업로드해주세요.')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

async function validateExcelAgainstTemplate(
  file: File,
  template: TemplateStructure,
  preferredSheet?: string
): Promise<{ valid: boolean; error?: string }> {
  if (!template.dataRows) {
    return {
      valid: false,
      error: '템플릿 파일에서 측정 항목 데이터를 읽을 수 없습니다.'
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName =
    preferredSheet && workbook.SheetNames.includes(preferredSheet)
      ? preferredSheet
      : workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

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

  const firstRow = allRows[0]
  if (!firstRow || firstRow.length === 0) {
    return {
      valid: false,
      error: 'Excel 파일의 첫 번째 행이 비어있습니다.'
    }
  }

  const normalizedFirstRow = firstRow.map(normalizeString)
  const normalizedTemplateColumns = template.columns.map(normalizeString)

  if (normalizedFirstRow.length !== normalizedTemplateColumns.length) {
    return {
      valid: false,
      error: `첫 번째 행의 컬럼 개수가 템플릿과 일치하지 않습니다. (템플릿: ${normalizedTemplateColumns.length}개, 현재: ${normalizedFirstRow.length}개)`
    }
  }

  for (let i = 0; i < normalizedTemplateColumns.length; i++) {
    if (normalizedFirstRow[i] !== normalizedTemplateColumns[i]) {
      return {
        valid: false,
        error: `첫 번째 행의 ${i + 1}번째 컬럼이 템플릿과 일치하지 않습니다. (템플릿: "${normalizedTemplateColumns[i]}", 현재: "${normalizedFirstRow[i]}")`
      }
    }
  }

  const expectedTotalRows = template.totalRows
  if (allRows.length < expectedTotalRows) {
    return {
      valid: false,
      error: `Excel 파일에 최소 ${expectedTotalRows}개의 행이 필요합니다. (템플릿: ${expectedTotalRows}개, 현재: ${allRows.length}개)`
    }
  }

  const measurementRows = allRows
    .slice(1, expectedTotalRows)
    .map(row => normalizeString((row[0] || '').toString()))

  if (measurementRows.length !== template.dataRows.length) {
    return {
      valid: false,
      error: `측정 항목 행의 개수가 템플릿과 일치하지 않습니다. (템플릿: ${template.dataRows.length}개, 현재: ${measurementRows.length}개)`
    }
  }

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
}

// Validate measurements file against template
export const validateMeasurementsFile = async (
  file: File
): Promise<{
  valid: boolean
  error?: string
}> => {
  try {
    const template = await loadMeasurementsTemplate()
    return await validateExcelAgainstTemplate(file, template)
  } catch (error) {
    console.error('Error validating measurements file:', error)
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Excel 파일을 읽는 중 오류가 발생했습니다.'
    }
  }
}

export const validateAnalysisChartFile = async (
  file: File
): Promise<{
  valid: boolean
  error?: string
}> => {
  try {
    const template = await loadAnalysisChartTemplate()
    return await validateExcelAgainstTemplate(file, template, 'AnalysisChart')
  } catch (error) {
    console.error('Error validating AnalysisChart file:', error)
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Excel 파일을 읽는 중 오류가 발생했습니다.'
    }
  }
}
