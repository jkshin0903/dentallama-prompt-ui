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
    const gatewayUrl = process.env.CHAT_GATEWAY_URL
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
        let base64String: string

        // Check if content is already base64 string or number array
        if (typeof fileData.content === 'string') {
          // Already base64 encoded
          base64String = fileData.content
        } else if (Array.isArray(fileData.content)) {
          // Convert number array back to ArrayBuffer
          const uint8Array = new Uint8Array(fileData.content)
          const arrayBuffer = uint8Array.buffer

          // Convert ArrayBuffer to base64 for JSON serialization
          base64String = Buffer.from(arrayBuffer).toString('base64')
        } else {
          // Fallback: try to convert to base64
          base64String = Buffer.from(fileData.content).toString('base64')
        }

        return {
          name: fileData.name,
          type: fileData.type,
          size: fileData.size || 0,
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

    // If upstream returns JSON, convert to SSE format expected by useChat.
    const upstreamContentType = upstream.headers.get('content-type') || ''
    if (upstreamContentType.includes('application/json')) {
      const responseText = await upstream.text()

      try {
        const jsonResponse = JSON.parse(responseText)
        const stream = new ReadableStream({
          start(controller) {
            let response =
              jsonResponse.response ||
              jsonResponse.message ||
              jsonResponse.content ||
              responseText

            // Clean up response: remove JSON data and extract only text content
            if (typeof response === 'string') {
              // Remove "0:" prefix if present (SSE format artifact)
              response = response.replace(/^0:\s*"?/, '').replace(/"$/, '')
              
              // Try to parse as JSON if it looks like JSON
              try {
                const parsed = JSON.parse(response)
                // If it's a JSON object, extract only the text content
                if (typeof parsed === 'object' && parsed !== null) {
                  // If response field exists and is a string, use it
                  if (typeof parsed.response === 'string') {
                    response = parsed.response
                  } else {
                    // Remove diagnosis and measurements fields, keep the rest
                    const { diagnosis, measurements, ...rest } = parsed
                    // If there's a text or content field, use it
                    if (rest.text || rest.content || rest.message) {
                      response = rest.text || rest.content || rest.message || ''
                    } else {
                      // Otherwise, stringify the rest (excluding diagnosis/measurements)
                      response = JSON.stringify(rest, null, 2)
                    }
                  }
                }
              } catch {
                // Not valid JSON, continue with string cleaning
                // Remove embedded JSON objects using more robust regex
                // Match "diagnosis": {...} including nested objects
                response = response.replace(
                  /"diagnosis"\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
                  ''
                )
                // Match "measurements": {...} including nested objects
                response = response.replace(
                  /"measurements"\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
                  ''
                )
              }
              
              // Remove any remaining JSON-like structures (large objects)
              response = response.replace(/\{[^{}]{50,}\}/g, '')
              
              // Clean up extra whitespace and newlines
              response = response
                .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double
                .trim()
            }

            const chunk = `0:"${response.replace(/\"/g, '\\\"').replace(/\n/g, '\\n')}"\n`
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
      } catch (err) {
        // Fallback: send raw text as one SSE chunk
        const stream = new ReadableStream({
          start(controller) {
            const chunk = `0:"${responseText.replace(/\"/g, '\\\"').replace(/\n/g, '\\n')}"\n`
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
      }
    }

    // Otherwise, stream response through unchanged (supports text/event-stream, etc.)
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        'content-type': upstreamContentType || 'text/plain; charset=utf-8'
      }
    })
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
