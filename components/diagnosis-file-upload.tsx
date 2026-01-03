'use client'

import { useRef, useState } from 'react'

import { FileSpreadsheet, Image as ImageIcon, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DiagnosisFiles,
  validateMeasurementsFile
} from '@/lib/utils/diagnosis-validation'

import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'

interface DiagnosisFileUploadProps {
  files: DiagnosisFiles
  onFilesChange: (files: DiagnosisFiles) => void
  disabled?: boolean
}

// Allowed file extensions
const EXCEL_EXTENSIONS = ['.xlsx']
const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png']
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png']

const isExcelFile = (file: File): boolean => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  return (
    EXCEL_EXTENSIONS.includes(extension) || EXCEL_MIME_TYPES.includes(file.type)
  )
}

const isImageFile = (file: File): boolean => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  return (
    IMAGE_EXTENSIONS.includes(extension) || IMAGE_MIME_TYPES.includes(file.type)
  )
}

export function DiagnosisFileUpload({
  files,
  onFilesChange,
  disabled
}: DiagnosisFileUploadProps) {
  const measurementsInputRef = useRef<HTMLInputElement>(null)
  const imagesInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [diagnosisErrors, setDiagnosisErrors] = useState<{
    chiefComplain?: string
    diagnosis?: string
    treatmentPlan?: string
    etc?: string
  }>({})
  const [measurementsError, setMeasurementsError] = useState<string | null>(
    null
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null) // For image errors

  const handleDiagnosisChange = (
    field: 'chiefComplain' | 'diagnosis' | 'treatmentPlan' | 'etc',
    value: string
  ) => {
    const currentDiagnosis = files.diagnosis || {
      chiefComplain: '',
      diagnosis: '',
      treatmentPlan: '',
      etc: ''
    }

    const updatedDiagnosis = {
      ...currentDiagnosis,
      [field]: value
    }

    // Clear error for this specific field when user starts typing
    if (diagnosisErrors[field]) {
      setDiagnosisErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }

    onFilesChange({
      ...files,
      diagnosis: updatedDiagnosis
    })
  }

  const handleDiagnosisClear = () => {
    setDiagnosisErrors({})
    onFilesChange({
      ...files,
      diagnosis: undefined
    })
  }

  const validateDiagnosisField = (
    field: 'chiefComplain' | 'diagnosis' | 'treatmentPlan' | 'etc',
    value: string
  ) => {
    // Clear error for this field when user starts typing
    if (diagnosisErrors[field]) {
      setDiagnosisErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleMeasurementsSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const file = selectedFiles[0]
    if (!isExcelFile(file)) {
      setMeasurementsError(`Measurements file must be Excel (.xlsx) format`)
      return
    }

    try {
      // Validate file columns and rows
      const validation = await validateMeasurementsFile(file)
      if (!validation.valid) {
        setMeasurementsError(validation.error || '파일 검증에 실패했습니다.')
        return
      }

      // Clear error message on successful upload
      setMeasurementsError(null)
      onFilesChange({
        ...files,
        measurements: file
      })
    } catch (error) {
      console.error('Error in handleMeasurementsSelect:', error)
      setMeasurementsError(
        error instanceof Error
          ? `파일 업로드 중 오류: ${error.message}`
          : '파일 업로드 중 알 수 없는 오류가 발생했습니다.'
      )
    }
  }

  const handleImagesSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    // Only allow single image upload
    const file = selectedFiles[0]
    if (!file) return

    if (!isImageFile(file)) {
      setErrorMessage(
        `This file is not supported: ${file.name}. Only images (JPG, PNG) are allowed.`
      )
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }

    // Replace existing image with new one
    onFilesChange({
      ...files,
      images: [file]
    })
    setErrorMessage(null)
  }

  const handleImageRemove = (index: number) => {
    onFilesChange({
      ...files,
      images: files.images.filter((_, i) => i !== index)
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    const excelFiles = droppedFiles.filter(isExcelFile)
    const imageFiles = droppedFiles.filter(isImageFile)

    // Try to assign Excel files to measurements if empty
    if (excelFiles.length > 0) {
      if (!files.measurements && excelFiles.length > 0) {
        const measurementsFile = excelFiles[0]
        const validation = await validateMeasurementsFile(measurementsFile)
        if (!validation.valid) {
          setMeasurementsError(validation.error || '파일 검증에 실패했습니다.')
        } else {
          // Clear error message on successful upload
          setMeasurementsError(null)
          onFilesChange({
            ...files,
            measurements: measurementsFile
          })
        }
      }
    }

    // Replace existing image with new one (single image only)
    if (imageFiles.length > 0) {
      onFilesChange({
        ...files,
        images: [imageFiles[0]]
      })
      setErrorMessage(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Diagnosis input fields */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            1. Diagnosis 정보 <span className="text-destructive">*</span>
          </label>
          {files.diagnosis && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDiagnosisClear}
              disabled={disabled}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              초기화
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="chief-complain" className="text-xs">
              Chief Complain
            </Label>
            <Textarea
              id="chief-complain"
              value={files.diagnosis?.chiefComplain || ''}
              onChange={e =>
                handleDiagnosisChange('chiefComplain', e.target.value)
              }
              onBlur={e =>
                validateDiagnosisField('chiefComplain', e.target.value)
              }
              disabled={disabled}
              placeholder="Chief Complain을 입력하세요"
              className={cn(
                'min-h-[80px] resize-none',
                diagnosisErrors.chiefComplain && 'border-destructive'
              )}
            />
            {diagnosisErrors.chiefComplain && (
              <p className="text-xs text-destructive">
                {diagnosisErrors.chiefComplain}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="diagnosis" className="text-xs">
              Diagnosis
            </Label>
            <Textarea
              id="diagnosis"
              value={files.diagnosis?.diagnosis || ''}
              onChange={e => handleDiagnosisChange('diagnosis', e.target.value)}
              onBlur={e => validateDiagnosisField('diagnosis', e.target.value)}
              disabled={disabled}
              placeholder="Diagnosis를 입력하세요"
              className={cn(
                'min-h-[80px] resize-none',
                diagnosisErrors.diagnosis && 'border-destructive'
              )}
            />
            {diagnosisErrors.diagnosis && (
              <p className="text-xs text-destructive">
                {diagnosisErrors.diagnosis}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="treatment-plan" className="text-xs">
              Treatment Plan
            </Label>
            <Textarea
              id="treatment-plan"
              value={files.diagnosis?.treatmentPlan || ''}
              onChange={e =>
                handleDiagnosisChange('treatmentPlan', e.target.value)
              }
              onBlur={e =>
                validateDiagnosisField('treatmentPlan', e.target.value)
              }
              disabled={disabled}
              placeholder="Treatment Plan을 입력하세요"
              className={cn(
                'min-h-[80px] resize-none',
                diagnosisErrors.treatmentPlan && 'border-destructive'
              )}
            />
            {diagnosisErrors.treatmentPlan && (
              <p className="text-xs text-destructive">
                {diagnosisErrors.treatmentPlan}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="etc" className="text-xs">
              Etc
            </Label>
            <Textarea
              id="etc"
              value={files.diagnosis?.etc || ''}
              onChange={e => handleDiagnosisChange('etc', e.target.value)}
              onBlur={e => validateDiagnosisField('etc', e.target.value)}
              disabled={disabled}
              placeholder="기타 정보를 입력하세요"
              className={cn(
                'min-h-[80px] resize-none',
                diagnosisErrors.etc && 'border-destructive'
              )}
            />
            {diagnosisErrors.etc && (
              <p className="text-xs text-destructive">{diagnosisErrors.etc}</p>
            )}
          </div>
        </div>
      </div>

      {/* Measurements file upload */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          2. Measurements 파일 (Excel){' '}
          <span className="text-destructive">*</span>
        </label>
        {files.measurements ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-md text-sm">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate max-w-[200px] font-medium">
                {files.measurements.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(files.measurements.size)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMeasurementsError(null)
                onFilesChange({
                  ...files,
                  measurements: undefined
                })
              }}
              className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors"
              disabled={disabled}
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => measurementsInputRef.current?.click()}
              disabled={disabled}
              className="text-xs"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Measurements 파일 선택
            </Button>
            <input
              ref={measurementsInputRef}
              type="file"
              className="hidden"
              accept=".xlsx"
              onChange={e => handleMeasurementsSelect(e.target.files)}
              disabled={disabled}
            />
          </div>
        )}
        {/* Measurements error message */}
        {measurementsError && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {measurementsError}
          </div>
        )}
      </div>

      {/* Images upload */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          3. 이미지 파일 (JPG, PNG) <span className="text-destructive">*</span>
        </label>
        {files.images.length === 0 && (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
              isDragging && !disabled
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              이미지를 드래그하거나{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => imagesInputRef.current?.click()}
                disabled={disabled}
              >
                선택
              </button>
            </p>
            <p className="text-xs text-muted-foreground">JPG, PNG 형식 지원</p>
            <input
              ref={imagesInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png"
              onChange={e => handleImagesSelect(e.target.files)}
              disabled={disabled}
            />
          </div>
        )}

        {files.images.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-md text-sm">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate max-w-[200px] font-medium">
                  {files.images[0].name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(files.images[0].size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleImageRemove(0)}
                className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors"
                disabled={disabled}
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
