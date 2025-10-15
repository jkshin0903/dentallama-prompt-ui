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

    // Proxy the request to the external chat gateway
    const upstream = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    // Stream response through unchanged (supports text/event-stream, etc.)
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        'content-type':
          upstream.headers.get('content-type') || 'text/plain; charset=utf-8'
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
