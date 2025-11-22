'use client'

import { useRef, useState } from 'react'

import { FileIcon, X, FileSpreadsheet, Image as ImageIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'

interface DiagnosisFileUploadProps {
  files: {
    diagnosis?: File
    measurements?: File
    images: File[]
  }
  onFilesChange: (files: {
    diagnosis?: File
    measurements?: File
    images: File[]
  }) => void
  disabled?: boolean
}

// Allowed file extensions
const EXCEL_CSV_EXTENSIONS = ['.xlsx', '.xls', '.csv']
const EXCEL_CSV_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv'
]

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png']
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png']

const isExcelCsvFile = (file: File): boolean => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  return (
    EXCEL_CSV_EXTENSIONS.includes(extension) ||
    EXCEL_CSV_MIME_TYPES.includes(file.type)
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
  const diagnosisInputRef = useRef<HTMLInputElement>(null)
  const measurementsInputRef = useRef<HTMLInputElement>(null)
  const imagesInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleDiagnosisSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const file = selectedFiles[0]
    if (!isExcelCsvFile(file)) {
      setErrorMessage(
        `Diagnosis file must be Excel (.xlsx, .xls) or CSV (.csv) format`
      )
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }

    onFilesChange({
      ...files,
      diagnosis: file
    })
  }

  const handleMeasurementsSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const file = selectedFiles[0]
    if (!isExcelCsvFile(file)) {
      setErrorMessage(
        `Measurements file must be Excel (.xlsx, .xls) or CSV (.csv) format`
      )
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }

    onFilesChange({
      ...files,
      measurements: file
    })
  }

  const handleImagesSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const [allowedFiles, rejectedFiles] = Array.from(selectedFiles).reduce(
      ([allowed, rejected], file) => {
        if (isImageFile(file)) {
          allowed.push(file)
        } else {
          rejected.push(file.name)
        }
        return [allowed, rejected]
      },
      [[], []] as [File[], string[]]
    )

    if (rejectedFiles.length > 0) {
      setErrorMessage(
        `These files are not supported: ${rejectedFiles.join(', ')}. Only images (JPG, PNG) are allowed.`
      )
      setTimeout(() => setErrorMessage(null), 5000)
    }

    if (allowedFiles.length > 0) {
      onFilesChange({
        ...files,
        images: [...files.images, ...allowedFiles]
      })
    }
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    const excelCsvFiles = droppedFiles.filter(isExcelCsvFile)
    const imageFiles = droppedFiles.filter(isImageFile)

    // Try to assign Excel/CSV files to diagnosis or measurements if empty
    if (excelCsvFiles.length > 0) {
      if (!files.diagnosis && excelCsvFiles.length > 0) {
        onFilesChange({
          ...files,
          diagnosis: excelCsvFiles[0]
        })
        excelCsvFiles.shift()
      }
      if (!files.measurements && excelCsvFiles.length > 0) {
        onFilesChange({
          ...files,
          measurements: excelCsvFiles[0]
        })
      }
    }

    // Add image files
    if (imageFiles.length > 0) {
      onFilesChange({
        ...files,
        images: [...files.images, ...imageFiles]
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const hasAnyFiles =
    files.diagnosis || files.measurements || files.images.length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Diagnosis file upload */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          Diagnosis 파일 (Excel/CSV)
        </label>
        {files.diagnosis ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-md text-sm">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate max-w-[200px] font-medium">
                {files.diagnosis.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(files.diagnosis.size)}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onFilesChange({
                  ...files,
                  diagnosis: undefined
                })
              }
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
              onClick={() => diagnosisInputRef.current?.click()}
              disabled={disabled}
              className="text-xs"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Diagnosis 파일 선택
            </Button>
            <input
              ref={diagnosisInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={e => handleDiagnosisSelect(e.target.files)}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Measurements file upload */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          Measurements 파일 (Excel/CSV)
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
              onClick={() =>
                onFilesChange({
                  ...files,
                  measurements: undefined
                })
              }
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
              accept=".xlsx,.xls,.csv"
              onChange={e => handleMeasurementsSelect(e.target.files)}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Images upload */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          이미지 파일 (JPG, PNG)
        </label>
        {files.images.length === 0 && !hasAnyFiles && (
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
            <p className="text-xs text-muted-foreground">
              JPG, PNG 형식 지원
            </p>
            <input
              ref={imagesInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".jpg,.jpeg,.png"
              onChange={e => handleImagesSelect(e.target.files)}
              disabled={disabled}
            />
          </div>
        )}

        {files.images.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
              {files.images.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-md text-sm"
                >
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate max-w-[200px] font-medium">
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImageRemove(index)}
                    className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors"
                    disabled={disabled}
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imagesInputRef.current?.click()}
                disabled={disabled}
                className="text-xs"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                이미지 추가
              </Button>
              <input
                ref={imagesInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".jpg,.jpeg,.png"
                onChange={e => handleImagesSelect(e.target.files)}
                disabled={disabled}
              />
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

