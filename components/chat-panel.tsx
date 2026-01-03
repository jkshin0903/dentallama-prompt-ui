'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'

import { User } from '@supabase/supabase-js'
import { Message } from 'ai'
import {
  ArrowUp,
  ChevronDown,
  LogIn,
  MessageCirclePlus,
  Paperclip,
  Square
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { DiagnosisFiles } from '@/lib/utils/diagnosis-validation'

import { useArtifact } from './artifact/artifact-context'
import { DiagnosisFileUpload } from './diagnosis-file-upload'
import { ModelSelector } from './model-selector'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { IconLogo } from './ui/icons'

interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void
  models?: any[]
  selectedModel?: string
  onModelChange?: (model: string) => void
  files?: File[]
  onFilesChange?: (files: File[]) => void
  diagnosisFiles?: DiagnosisFiles
  onDiagnosisFilesChange?: (files: DiagnosisFiles) => void
  /** Whether to show the scroll to bottom button */
  showScrollToBottomButton: boolean
  /** Reference to the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  /** Current user (null if not logged in) */
  user: User | null
}

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  setMessages,
  query,
  stop,
  append,
  models,
  selectedModel,
  onModelChange,
  files = [],
  onFilesChange,
  diagnosisFiles = { images: [] },
  onDiagnosisFilesChange,
  showScrollToBottomButton,
  scrollContainerRef,
  user
}: ChatPanelProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const [isFileUploadDialogOpen, setIsFileUploadDialogOpen] = useState(false)
  const { close: closeArtifact } = useArtifact()

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const handleNewChat = () => {
    setMessages([])
    closeArtifact()
    router.push('/')
  }

  const isToolInvocationInProgress = () => {
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    return (
      lastPart?.type === 'tool-invocation' &&
      lastPart?.toolInvocation?.state === 'call'
    )
  }

  const isInputDisabled = isLoading || isToolInvocationInProgress() || !user

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        role: 'user',
        content: query
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Scroll to the bottom of the container
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div
      className={cn(
        'w-full bg-background group/form-container shrink-0',
        messages.length > 0 ? 'sticky bottom-0 px-2 pb-4' : 'px-6'
      )}
    >
      {messages.length === 0 && (
        <div className="mb-10 flex flex-col items-center gap-4">
          <IconLogo className="size-12 text-muted-foreground" />
          <p className="text-center text-3xl font-semibold">
            How can I help you today?
          </p>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className={cn('max-w-3xl w-full mx-auto relative')}
      >
        {/* Scroll to bottom button - only shown when showScrollToBottomButton is true */}
        {showScrollToBottomButton && messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
            onClick={handleScrollToBottom}
            title="Scroll to bottom"
          >
            <ChevronDown size={16} />
          </Button>
        )}

        <div className="relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input">
          {!user && (
            <div className="px-4 pt-2 pb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 rounded-lg p-3 border border-dashed">
                <LogIn className="size-4" />
                <span>Please sign in to start chatting</span>
                <Link
                  href="/auth/login"
                  className="ml-auto text-primary hover:underline font-medium"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}

          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={
              user ? 'Ask a question...' : 'Sign in to ask a question...'
            }
            spellCheck={false}
            value={input}
            disabled={isInputDisabled}
            className="resize-none w-full min-h-12 bg-transparent border-0 p-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            onChange={e => {
              if (user) {
                handleInputChange(e)
              }
            }}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (input.trim().length === 0 || !user) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
              }
            }}
            onFocus={() => {
              if (!user) {
                inputRef.current?.blur()
                router.push('/auth/login')
              }
            }}
          />

          {/* Bottom menu area */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <ModelSelector models={[]} onModelChange={onModelChange} />
              {/* <SearchModeToggle /> */}
              {/* File upload button - only show for treatment-plan-gen model */}
              {selectedModel === 'treatment-plan-gen' &&
                onDiagnosisFilesChange && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsFileUploadDialogOpen(true)}
                    className="shrink-0 rounded-full"
                    disabled={isInputDisabled}
                    title="파일 업로드"
                  >
                    <Paperclip className="size-4" />
                  </Button>
                )}
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNewChat}
                  className="shrink-0 rounded-full group"
                  type="button"
                  disabled={isLoading || isToolInvocationInProgress()}
                >
                  <MessageCirclePlus className="size-4 group-hover:rotate-12 transition-all" />
                </Button>
              )}
              <Button
                type={isLoading ? 'button' : 'submit'}
                size={'icon'}
                variant={'outline'}
                className={cn(isLoading && 'animate-pulse', 'rounded-full')}
                disabled={
                  (input.length === 0 && !isLoading) ||
                  isToolInvocationInProgress() ||
                  !user
                }
                onClick={
                  isLoading
                    ? stop
                    : !user
                      ? () => router.push('/auth/login')
                      : undefined
                }
              >
                {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* File upload dialog */}
      {selectedModel === 'treatment-plan-gen' && onDiagnosisFilesChange && (
        <Dialog
          open={isFileUploadDialogOpen}
          onOpenChange={open => {
            // Only close dialog when explicitly requested (not from validation)
            if (!open) {
              setIsFileUploadDialogOpen(false)
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>진단 정보 입력</DialogTitle>
              <DialogDescription>
                진단 생성에 필요한 정보를 입력하고 파일을 업로드하세요.
              </DialogDescription>
            </DialogHeader>
            <DiagnosisFileUpload
              files={diagnosisFiles}
              onFilesChange={onDiagnosisFilesChange}
              disabled={isInputDisabled}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFileUploadDialogOpen(false)
                }}
              >
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
