import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 30

type ParsedFile = {
  name: string
  type: string
  size: number
  content: string // Base64 encoded file content
}

export async function POST(req: Request) {
  try {
    const gatewayUrl = process.env.NEXT_PUBLIC_CHAT_GATEWAY_URL
    const contentType = req.headers.get('content-type') || ''

    let messages, chatId, model, files

    // Check if FormData or JSON
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()

      // Extract metadata
      const metadataStr = formData.get('metadata') as string
      const metadata = JSON.parse(metadataStr)
      messages = metadata.messages
      chatId = metadata.id
      model = metadata.model

      // Extract files from FormData
      const filesArray: any[] = []
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file_')) {
          const file = value as File
          const arrayBuffer = await file.arrayBuffer()
          const uint8Array = new Uint8Array(arrayBuffer)
          filesArray.push({
            name: file.name,
            type: file.type,
            size: file.size,
            content: Array.from(uint8Array)
          })
        }
      }
      files = filesArray.length > 0 ? filesArray : undefined
    } else {
      const payload = await req.json()
      messages = payload.messages
      chatId = payload.id
      model = payload.model
      files = payload.files
    }

    // Parse file contents if files are present
    let parsedFiles: ParsedFile[] | undefined = undefined
    if (files && files.length > 0) {
      parsedFiles = files.map((fileData: any): ParsedFile => {
        // Convert number array back to ArrayBuffer
        const uint8Array = new Uint8Array(fileData.content)
        const arrayBuffer = uint8Array.buffer

        // Convert ArrayBuffer to base64 for JSON serialization
        const base64String = Buffer.from(arrayBuffer).toString('base64')

        return {
          name: fileData.name,
          type: fileData.type,
          size: fileData.size,
          content: base64String // Base64 encoded file content for JSON transmission
        }
      })
    }

    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')
    const userId = await getCurrentUserId()

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    // Check if external chat gateway is configured
    if (!gatewayUrl) {
      return new Response('Chat gateway URL is not configured', {
        status: 500,
        statusText: 'Internal Server Error'
      })
    }

    // Transform the request format for the gateway
    const gatewayPayload = {
      message: messages[messages.length - 1]?.content || '',
      id: chatId,
      messages: messages,
      model: model, // Include selected model
      files: parsedFiles || undefined // Include parsed files with actual content if present
    }

    // Proxy the request to the external chat gateway
    const upstream = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(gatewayPayload)
    })

    // Check if the response is streaming or JSON
    const responseContentType = upstream.headers.get('content-type') || ''

    if (
      responseContentType.includes('text/event-stream') ||
      responseContentType.includes('application/x-ndjson')
    ) {
      // Stream response through unchanged
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          'content-type': responseContentType
        }
      })
    } else {
      // Handle JSON response by converting to streaming format
      const responseText = await upstream.text()

      try {
        const jsonResponse = JSON.parse(responseText)

        // Convert JSON response to streaming format
        const stream = new ReadableStream({
          start(controller) {
            // Send the response as a text chunk in Vercel AI SDK format
            const response =
              jsonResponse.response ||
              jsonResponse.message ||
              jsonResponse.content ||
              responseText

            // Use the correct format for Vercel AI SDK
            const chunk = `0:"${response.replace(/"/g, '\\"')}"\n`
            controller.enqueue(new TextEncoder().encode(chunk))
            controller.close()
          }
        })

        return new Response(stream, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive'
          }
        })
      } catch (error) {
        console.error('Failed to parse gateway response:', error)
        return new Response('Error processing gateway response', {
          status: 500,
          statusText: 'Internal Server Error'
        })
      }
    }
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
