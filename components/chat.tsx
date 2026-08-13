'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useChat } from '@ai-sdk/react'
import { User } from '@supabase/supabase-js'
import { ChatRequestOptions } from 'ai'
import { Message } from 'ai/react'
import { toast } from 'sonner'

import {
  DEFAULT_TREATMENT_PLAN_MODEL,
  resolveTreatmentPlanModel
} from '@/lib/config/treatment-plan'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  DiagnosisFiles,
  validateAllFields
} from '@/lib/utils/diagnosis-validation'
import { parseAnalysisChartFile } from '@/lib/utils/parse-analysis-chart-file'
import { parseMeasurementsFile } from '@/lib/utils/parse-measurements-file'

import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

// Define section structure
interface ChatSection {
  id: string // User message ID
  userMessage: Message
  assistantMessages: Message[]
}

export function Chat({
  id,
  savedMessages = [],
  query,
  user: initialUser
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  user?: User | null // Make optional since we'll fetch client-side
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string>(
    DEFAULT_TREATMENT_PLAN_MODEL
  )
  const [diagnosisFiles, setDiagnosisFiles] = useState<DiagnosisFiles>({
    images: []
  })
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch user on client side and listen for auth state changes
  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    const fetchUser = async () => {
      try {
        const {
          data: { user: currentUser }
        } = await supabase.auth.getUser()
        setUser(currentUser)
      } catch (error) {
        console.warn('Failed to fetch user in chat:', error)
        setUser(null)
      }
    }

    // Only fetch if not provided as prop
    if (!initialUser) {
      fetchUser()
    } else {
      setUser(initialUser)
    }

    // Listen for auth state changes (login, logout, etc.)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user)
      }
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [initialUser])

  const {
    messages,
    input,
    handleInputChange,
    status,
    setMessages,
    stop,
    append,
    data,
    setData,
    addToolResult,
    reload
  } = useChat({
    initialMessages: savedMessages,
    id: id, // Use unique chat ID for isolated streaming
    body: {
      id,
      model: selectedModel
    },
    onFinish: () => {
      // Only update URL if we're on the home page (new chat)
      // Don't update if we're already on a search page to avoid hijacking navigation
      if (window.location.pathname === '/') {
        window.history.replaceState({}, '', `/search/${id}`)
      }
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    },
    sendExtraMessageFields: true, // Enable extra message fields to send files
    experimental_throttle: 100
  })

  const isLoading =
    status === 'submitted' || status === 'streaming' || isSubmitting

  // Convert messages array to sections array
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    let currentSection: ChatSection | null = null

    for (const message of messages) {
      if (message.role === 'user') {
        // Start a new section when a user message is found
        if (currentSection) {
          result.push(currentSection)
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        }
      } else if (currentSection && message.role === 'assistant') {
        // Add assistant message to the current section
        currentSection.assistantMessages.push(message)
      }
      // Ignore other role types like 'system' for now
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

  // Detect if scroll container is at the bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50 // threshold in pixels
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        setIsAtBottom(true)
      } else {
        setIsAtBottom(false)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Set initial state

    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to the section when a new user message is sent
  useEffect(() => {
    // Only scroll if this chat is currently visible in the URL
    const isCurrentChat =
      window.location.pathname === `/search/${id}` ||
      (window.location.pathname === '/' && sections.length > 0)

    if (isCurrentChat && sections.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'user') {
        // If the last message is from user, find the corresponding section
        const sectionId = lastMessage.id
        requestAnimationFrame(() => {
          const sectionElement = document.getElementById(`section-${sectionId}`)
          sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [sections, messages, id])

  useEffect(() => {
    setMessages(savedMessages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
  }

  const handleUpdateAndReloadMessage = async (
    messageId: string,
    newContent: string
  ) => {
    setMessages(currentMessages =>
      currentMessages.map(msg =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    )

    try {
      const messageIndex = messages.findIndex(msg => msg.id === messageId)
      if (messageIndex === -1) return

      const messagesUpToEdited = messages.slice(0, messageIndex + 1)

      setMessages(messagesUpToEdited)

      setData(undefined)

      await reload({
        body: {
          chatId: id,
          regenerate: true
        }
      })
    } catch (error) {
      console.error('Failed to reload after message update:', error)
      toast.error(`Failed to reload conversation: ${(error as Error).message}`)
    }
  }

  const handleReloadFrom = async (
    messageId: string,
    options?: ChatRequestOptions
  ) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      const userMessageIndex = messages
        .slice(0, messageIndex)
        .findLastIndex(m => m.role === 'user')
      if (userMessageIndex !== -1) {
        const trimmedMessages = messages.slice(0, userMessageIndex + 1)
        setMessages(trimmedMessages)
        return await reload(options)
      }
    }
    return await reload(options)
  }

  // Reset diagnosis files when model changes
  useEffect(() => {
    setDiagnosisFiles({ images: [] })
  }, [selectedModel])

  const stopGeneration = () => {
    abortControllerRef.current?.abort()
    stop()
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const validation = validateAllFields(diagnosisFiles, selectedModel)
    if (!validation.valid) {
      if (validation.errors.length === 1) {
        toast.error(validation.errors[0])
      } else {
        toast.error(
          `다음 항목을 확인해주세요:\n${validation.errors
            .map((err, idx) => `${idx + 1}. ${err}`)
            .join('\n')}`
        )
      }
      return
    }

    const isOrthoPlanner =
      resolveTreatmentPlanModel(selectedModel) === 'orthoplanner'

    let measurements: Record<string, number | null> = {}
    if (isOrthoPlanner && diagnosisFiles.analysisChart) {
      measurements = await parseAnalysisChartFile(diagnosisFiles.analysisChart)
    } else if (diagnosisFiles.measurements) {
      measurements = await parseMeasurementsFile(diagnosisFiles.measurements)
    }

    const contentData: {
      prompt?: string
      diagnosis?: {
        chiefComplain: string
        diagnosis: string
        treatmentPlan: string
        etc: string
      }
      measurements?: Record<string, number | null>
      use_rag: boolean
    } = {
      use_rag: true
    }

    if (input && input.trim()) {
      contentData.prompt = input.trim()
    }

    if (diagnosisFiles.diagnosis) {
      const hasDiagnosisData =
        diagnosisFiles.diagnosis.chiefComplain.trim() ||
        diagnosisFiles.diagnosis.diagnosis.trim() ||
        diagnosisFiles.diagnosis.treatmentPlan.trim()

      if (hasDiagnosisData) {
        contentData.diagnosis = {
          ...diagnosisFiles.diagnosis,
          etc: diagnosisFiles.diagnosis.etc || ''
        }
      }
    }

    if (Object.keys(measurements).length > 0) {
      const numericMeasurements = Object.fromEntries(
        Object.entries(measurements).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number'
        )
      )
      if (Object.keys(numericMeasurements).length > 0) {
        contentData.measurements = numericMeasurements
      }
    }

    const userMessageContent = JSON.stringify(contentData)

    const imageFiles: Array<{
      name: string
      type: string
      size: number
      content: string
    }> = []

    for (const image of diagnosisFiles.images) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64String = result.split(',')[1] || result
          resolve(base64String)
        }
        reader.onerror = reject
        reader.readAsDataURL(image)
      })

      imageFiles.push({
        name: image.name,
        type: image.type,
        size: image.size,
        content: base64
      })
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessageContent
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    const payload = {
      messages: [
        {
          role: 'user',
          content: userMessageContent
        }
      ],
      id,
      model: selectedModel,
      files: imageFiles,
      measurements
    }

    handleInputChange({
      target: { value: '' }
    } as React.ChangeEvent<HTMLTextAreaElement>)

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      const responseText = await response.text()
      let json: {
        response?: string
        message?: string
        content?: string
        error?: string
      } | null = null
      try {
        json = JSON.parse(responseText)
      } catch {
        json = null
      }

      if (!response.ok) {
        throw new Error(
          json?.error || json?.response || `API error: ${response.status}`
        )
      }

      const assistantContent =
        json?.response ?? json?.message ?? json?.content ?? responseText

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent
      }

      setMessages([...updatedMessages, assistantMessage])

      if (window.location.pathname === '/') {
        window.history.replaceState({}, '', `/search/${id}`)
      }
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error('Error sending message:', error)
      toast.error(`Error: ${(error as Error).message}`)
    } finally {
      setIsSubmitting(false)
      abortControllerRef.current = null
    }
  }

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        messages.length === 0 ? 'items-center justify-center' : ''
      )}
      data-testid="full-chat"
    >
      <ChatMessages
        sections={sections}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        addToolResult={addToolResult}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
        reload={handleReloadFrom}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stopGeneration}
        query={query}
        append={append}
        models={[]}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        diagnosisFiles={diagnosisFiles}
        onDiagnosisFilesChange={setDiagnosisFiles}
        showScrollToBottomButton={!isAtBottom}
        scrollContainerRef={scrollContainerRef}
        user={user}
      />
    </div>
  )
}
