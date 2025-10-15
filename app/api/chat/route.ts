import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const gatewayUrl = process.env.CHAT_GATEWAY_URL
    const payload = await req.json()
    const { messages, id: chatId } = payload
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
      // Include any additional fields the gateway might need
      ...payload
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
    const contentType = upstream.headers.get('content-type') || ''

    if (
      contentType.includes('text/event-stream') ||
      contentType.includes('application/x-ndjson')
    ) {
      // Stream response through unchanged
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          'content-type': contentType
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
