'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useChat } from '@ai-sdk/react'
import { User } from '@supabase/supabase-js'
import { ChatRequestOptions } from 'ai'
import { Message } from 'ai/react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { parseDiagnosisFile } from '@/lib/utils/parse-diagnosis-file'
import { parseMeasurementsFile } from '@/lib/utils/parse-measurements-file'

import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

// Define section structure
interface ChatSection {
  id: string // User message ID
  userMessage: Message
  assistantMessages: Message[]
}

type FileData = {
  name: string
  type: string
  size: number
  content: number[] // ArrayBuffer as number array for JSON serialization
}

export function Chat({
  id,
  savedMessages = [],
  query,
  user
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  user: User | null
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [selectedModel, setSelectedModel] = useState('treatment-plan-gen')
  const [files, setFiles] = useState<File[]>([])
  const [diagnosisFiles, setDiagnosisFiles] = useState<{
    diagnosis?: File
    measurements?: File
    images: File[]
  }>({ images: [] })

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
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

  const isLoading = status === 'submitted' || status === 'streaming'

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

  // Reset files when model changes
  useEffect(() => {
    setFiles([])
    setDiagnosisFiles({ images: [] })
  }, [selectedModel])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // For treatment-plan-gen model, check diagnosis files
    if (selectedModel === 'treatment-plan-gen') {
      const hasDiagnosisFiles =
        diagnosisFiles.diagnosis ||
        diagnosisFiles.measurements ||
        diagnosisFiles.images.length > 0

      if (!hasDiagnosisFiles) {
        handleSubmit(e)
        return
      }

      // Parse diagnosis and measurements files
      let diagnosis: string | null = null
      let measurements: Record<string, number | null> = {}

      if (diagnosisFiles.diagnosis) {
        diagnosis = await parseDiagnosisFile(diagnosisFiles.diagnosis)
      }

      if (diagnosisFiles.measurements) {
        measurements = await parseMeasurementsFile(diagnosisFiles.measurements)
      }

      // Build content as JSON string
      const contentData: {
        diagnosis?: string
        measurements?: Record<string, number | null>
        use_rag: boolean
      } = {
        use_rag: true
      }

      if (diagnosis) {
        contentData.diagnosis = diagnosis
      }

      if (Object.keys(measurements).length > 0) {
        contentData.measurements = measurements
      }

      const userMessageContent = JSON.stringify(contentData)

      // Convert image files to base64
      const imageFiles: Array<{
        name: string
        type: string
        content: string
      }> = []

      for (const image of diagnosisFiles.images) {
        const arrayBuffer = await image.arrayBuffer()
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(arrayBuffer))
        )
        imageFiles.push({
          name: image.name,
          type: image.type,
          content: base64
        })
      }

      // Add user message immediately
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userMessageContent
      }

      // Add the user message to the chat
      const updatedMessages = [...messages, userMessage]

      // Create JSON payload for API
      const payload = {
        messages: updatedMessages,
        id,
        model: selectedModel,
        files: imageFiles.length > 0 ? imageFiles : undefined
      }

      // Clear input and files after handling response
      setDiagnosisFiles({ images: [] })
      handleInputChange({
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>)

      try {
        // Send to API as JSON
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API error: ${response.status} ${errorText}`)
        }

        // Parse JSON response and append assistant message
        // Important: read the body ONCE to avoid "body stream already read"
        const responseText = await response.text()
        let assistantContent = ''
        try {
          const json = JSON.parse(responseText)
          assistantContent =
            json?.response ?? json?.message ?? json?.content ?? ''
        } catch {
          // Not JSON; use raw text
          assistantContent = responseText
        }

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantContent
        }

        setMessages([...updatedMessages, assistantMessage])

        // On finish, update URL if we're on the home page (new chat)
        if (window.location.pathname === '/') {
          window.history.replaceState({}, '', `/search/${id}`)
        }
        window.dispatchEvent(new CustomEvent('chat-history-updated'))
      } catch (error) {
        console.error('Error sending message:', error)
        toast.error(`Error: ${(error as Error).message}`)
      }
      return
    }

    // For other models, use existing file upload logic
    // If no files, use regular handleSubmit
    if (!files || files.length === 0) {
      handleSubmit(e)
      return
    }

    // Capture files before clearing
    const filesToUpload = [...files]

    // Add user message immediately
    const userMessageContent = input

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessageContent
    }

    // Add the user message to the chat
    const updatedMessages = [...messages, userMessage]

    // Create FormData for file upload
    const formData = new FormData()

    // Add files to FormData
    filesToUpload.forEach((file, index) => {
      formData.append(`file_${index}`, file)
    })

    // Add metadata as JSON
    const metadata = {
      messages: updatedMessages,
      id,
      model: selectedModel
    }
    formData.append('metadata', JSON.stringify(metadata))

    // Clear input and files after handling response
    setFiles([])
    handleInputChange({
      target: { value: '' }
    } as React.ChangeEvent<HTMLTextAreaElement>)

    try {
      // Send to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} ${errorText}`)
      }

      // Parse JSON response and append assistant message
      // Important: read the body ONCE to avoid "body stream already read"
      const responseText = await response.text()
      let assistantContent = ''
      try {
        const json = JSON.parse(responseText)
        assistantContent =
          json?.response ?? json?.message ?? json?.content ?? ''
      } catch {
        // Not JSON; use raw text
        assistantContent = responseText
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent
      }

      setMessages([...updatedMessages, assistantMessage])

      // On finish, update URL if we're on the home page (new chat)
      if (window.location.pathname === '/') {
        window.history.replaceState({}, '', `/search/${id}`)
      }
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(`Error: ${(error as Error).message}`)
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
        stop={stop}
        query={query}
        append={append}
        models={[]}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        files={files}
        onFilesChange={setFiles}
        diagnosisFiles={diagnosisFiles}
        onDiagnosisFilesChange={setDiagnosisFiles}
        showScrollToBottomButton={!isAtBottom}
        scrollContainerRef={scrollContainerRef}
        user={user}
      />
    </div>
  )
}
