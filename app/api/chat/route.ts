import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { proxyTreatmentPlan } from '@/lib/dentallama-api'
import { TreatmentPlanClientPayload } from '@/lib/types/treatment-plan'

// Must be a numeric literal so Next.js can statically analyze the route config.
export const maxDuration = 600

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')

    if (isSharePage) {
      return NextResponse.json(
        { error: 'Chat API is not available on share pages' },
        { status: 403 }
      )
    }

    await getCurrentUserId()

    let payload: TreatmentPlanClientPayload

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const metadataStr = formData.get('metadata') as string
      const metadata = JSON.parse(metadataStr || '{}')
      const filesArray: TreatmentPlanClientPayload['files'] = []

      for (const [key, value] of formData.entries()) {
        if (!key.startsWith('file_') || typeof value === 'string') continue
        const file = value as File
        const arrayBuffer = await file.arrayBuffer()
        filesArray.push({
          name: file.name,
          type: file.type,
          size: file.size,
          content: Array.from(new Uint8Array(arrayBuffer))
        })
      }

      payload = {
        id: metadata.id,
        model: metadata.model,
        messages: metadata.messages,
        files: filesArray.length > 0 ? filesArray : undefined,
        diagnosis: metadata.diagnosis,
        age: metadata.age,
        gender: metadata.gender,
        measurements: metadata.measurements
      }
    } else {
      const body = await req.json()
      payload = {
        id: body.id,
        model: body.model,
        messages: body.messages,
        files: body.files,
        diagnosis: body.diagnosis,
        age: body.age,
        gender: body.gender,
        measurements: body.measurements
      }
    }

    const result = await proxyTreatmentPlan(payload)
    const wantsStream = req.headers.get('accept')?.includes('text/event-stream')

    if (wantsStream) {
      const text =
        typeof result.body.response === 'string'
          ? result.body.response
          : typeof result.body.error === 'string'
            ? result.body.error
            : JSON.stringify(result.body)
      const chunk = `0:"${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`
      return new Response(chunk, {
        status: result.status,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive'
        }
      })
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('API route error:', error)

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: '추론 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.' },
        { status: 504 }
      )
    }

    const message =
      error instanceof Error ? error.message : 'Error processing your request'

    let status = 500
    if (message.includes('not configured')) status = 500
    else if (message.includes('이미지') || message.includes('계측'))
      status = 400

    return NextResponse.json({ error: message }, { status })
  }
}
