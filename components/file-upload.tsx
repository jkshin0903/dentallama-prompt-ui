'use client'

import { useRef, useState } from 'react'

import { FileIcon, X } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'

interface FileUploadProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  disabled?: boolean
}

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  // Documents
  '.pdf'
]

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  // Documents
  'application/pdf'
]

const isFileAllowed = (file: File): boolean => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  return (
    ALLOWED_EXTENSIONS.includes(extension) ||
    ALLOWED_MIME_TYPES.includes(file.type)
  )
}

export function FileUpload({
  files,
  onFilesChange,
  disabled
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const [allowedFiles, rejectedFiles] = Array.from(selectedFiles).reduce(
      ([allowed, rejected], file) => {
        if (isFileAllowed(file)) {
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
        `These files are not supported: ${rejectedFiles.join(', ')}`
      )
      setTimeout(() => setErrorMessage(null), 5000)
    }

    if (allowedFiles.length > 0) {
      onFilesChange([...files, ...allowedFiles])
    }
  }

  const handleFileRemove = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
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
    handleFileSelect(e.dataTransfer.files)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="flex flex-col gap-2">
      {/* File upload button and drag area */}
      {files.length === 0 && (
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
          <FileIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            Drop files here or{' '}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              browse
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            Images: JPG, PNG • Documents: PDF
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={e => handleFileSelect(e.target.files)}
            disabled={disabled}
          />
        </div>
      )}

      {/* Selected files list */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-md text-sm"
            >
              <FileIcon className="h-4 w-4 text-muted-foreground" />
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
                onClick={() => handleFileRemove(index)}
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
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="text-xs"
          >
            Add Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={e => handleFileSelect(e.target.files)}
            disabled={disabled}
          />
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
