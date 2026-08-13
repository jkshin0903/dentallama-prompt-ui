import {
  INFERENCE_TIMEOUT_MS,
  resolveTreatmentPlanModel,
  TREATMENT_PLAN_ENDPOINTS
} from '@/lib/config/treatment-plan'
import {
  GemmaFilePayload,
  GemmaTreatmentPlanRequest,
  OrthoPlannerTreatmentPlanRequest,
  OrthoPlannerTreatmentPlanResponse,
  TreatmentPlanClientPayload
} from '@/lib/types/treatment-plan'
import { toOrthoPlannerAnalysisChart } from '@/lib/utils/orthoplanner-measurements'

const LEGACY_GATEWAY_PATHS = [
  '/api/chat',
  '/api/v1/treatment-plan',
  '/api/v1/gemma/treatment-plan',
  '/api/v1/orthoplanner/treatment-plan'
]

export function getDentalLamaApiBaseUrl(): string {
  const raw =
    process.env.DENTALLAMA_API_BASE_URL?.trim() ||
    process.env.CHAT_GATEWAY_URL?.trim()

  if (!raw) {
    throw new Error('DentalLama API base URL is not configured')
  }

  const url = new URL(raw)
  const pathname = url.pathname.replace(/\/$/, '') || '/'

  if (pathname === '/' || LEGACY_GATEWAY_PATHS.includes(pathname)) {
    return url.origin
  }

  return `${url.origin}${pathname}`
}

function isImageFile(file: { name: string; type?: string }): boolean {
  if (file.type?.startsWith('image/')) return true
  return /\.(jpe?g|png|webp)$/i.test(file.name)
}

function imageMimeType(file: { name: string; type?: string }): string {
  if (file.type?.startsWith('image/')) return file.type
  if (/\.png$/i.test(file.name)) return 'image/png'
  return 'image/jpeg'
}

function fileToGemmaPayload(file: {
  name: string
  type: string
  size?: number
  content: string | number[]
}): GemmaFilePayload {
  let content: string
  if (typeof file.content === 'string') {
    content = file.content.includes(',')
      ? file.content.split(',').pop() || file.content
      : file.content
  } else if (Array.isArray(file.content)) {
    content = Buffer.from(new Uint8Array(file.content)).toString('base64')
  } else {
    content = Buffer.from(file.content as ArrayBuffer).toString('base64')
  }

  return {
    name: file.name,
    type: imageMimeType(file),
    size: file.size || 0,
    content
  }
}

function formatOrthoPlannerDiagnosis(diagnosis: {
  chiefComplain?: string
  diagnosis?: string
  treatmentPlan?: string
  etc?: string
}): string {
  return JSON.stringify(
    {
      ChiefComplain: diagnosis.chiefComplain || '',
      Diagnosis: diagnosis.diagnosis || '',
      TreatmentPlan: diagnosis.treatmentPlan || '',
      etc: diagnosis.etc || ''
    },
    null,
    2
  )
}

function parseMessageContent(content?: string): {
  diagnosisText: string
  measurements?: Record<string, number | null>
  structuredContent?: string
} {
  if (!content?.trim()) {
    return { diagnosisText: '' }
  }

  try {
    const parsed = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object') {
      return { diagnosisText: content, structuredContent: content }
    }

    const diagnosis = parsed.diagnosis
    let diagnosisText = ''
    if (typeof diagnosis === 'string') {
      diagnosisText = diagnosis
    } else if (diagnosis && typeof diagnosis === 'object') {
      diagnosisText = formatOrthoPlannerDiagnosis({
        chiefComplain: diagnosis.chiefComplain || '',
        diagnosis: diagnosis.diagnosis || '',
        treatmentPlan: diagnosis.treatmentPlan || '',
        etc: diagnosis.etc || ''
      })
    } else {
      diagnosisText =
        parsed.diagnosis_text || parsed.text || parsed.prompt || ''
    }

    return {
      diagnosisText,
      measurements: parsed.measurements || parsed.measurements_results,
      structuredContent: JSON.stringify(parsed)
    }
  } catch {
    return { diagnosisText: content }
  }
}

function buildGemmaPayload(
  payload: TreatmentPlanClientPayload
): GemmaTreatmentPlanRequest {
  const lastMessage = payload.messages?.[payload.messages.length - 1]
  const parsed = parseMessageContent(lastMessage?.content)
  const files = (payload.files || [])
    .filter(isImageFile)
    .map(fileToGemmaPayload)

  return {
    id: payload.id,
    model: 'gemma-3',
    messages: [
      {
        role: lastMessage?.role || 'user',
        content: parsed.structuredContent || lastMessage?.content || ''
      }
    ],
    files
  }
}

function buildOrthoPlannerPayload(
  payload: TreatmentPlanClientPayload
): OrthoPlannerTreatmentPlanRequest {
  const lastMessage = payload.messages?.[payload.messages.length - 1]
  const parsed = parseMessageContent(lastMessage?.content)
  const image = (payload.files || []).find(isImageFile)

  if (!image) {
    throw new Error('이미지 파일이 필요합니다.')
  }

  const gemmaFile = fileToGemmaPayload(image)
  const analysischart = toOrthoPlannerAnalysisChart(
    payload.measurements || parsed.measurements
  )

  if (Object.keys(analysischart).length === 0) {
    throw new Error('계측 데이터가 필요합니다.')
  }

  return {
    ceph: `data:${gemmaFile.type};base64,${gemmaFile.content}`,
    analysischart,
    diagnosis: payload.diagnosis || parsed.diagnosisText || '',
    ...(payload.age ? { age: payload.age } : {}),
    ...(payload.gender ? { gender: payload.gender } : {})
  }
}

export function extractUpstreamError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') {
    return typeof body === 'string' && body.trim() ? body : fallback
  }

  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }
  if (detail && typeof detail === 'object') {
    const response = (detail as { response?: unknown }).response
    if (typeof response === 'string' && response.trim()) {
      return response
    }
  }

  const response = (body as { response?: unknown }).response
  if (typeof response === 'string' && response.trim()) {
    return response
  }

  const error = (body as { error?: unknown }).error
  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return fallback
}

export function formatOrthoPlannerResponse(
  result: OrthoPlannerTreatmentPlanResponse
): string {
  const lines: string[] = []
  if (result.treatment_plan) {
    lines.push(result.treatment_plan)
  }

  const details: string[] = []
  const scope = result.parsed?.scope
  if (scope) {
    details.push(`**교정 범위**: ${scope}`)
  }

  if (typeof result.parsed?.extraction === 'number') {
    details.push(
      `**발치**: ${result.parsed.extraction === 1 ? '발치' : '비발치'}`
    )
  }

  const duration =
    result.parsed?.duration ??
    (typeof result.duration_months_est === 'number'
      ? Math.round(result.duration_months_est)
      : undefined)
  if (typeof duration === 'number') {
    details.push(`**치료 기간**: ${duration}개월`)
  }

  const surgery = result.decision_head?.surgery
  if (surgery?.label) {
    const confidence =
      typeof surgery.confidence === 'number'
        ? ` (${Math.round(surgery.confidence * 100)}%)`
        : ''
    details.push(`**수술**: ${surgery.label}${confidence}`)
  }

  if (typeof result.hedge === 'number') {
    details.push(`**불확실성 (hedge)**: ${result.hedge.toFixed(2)}`)
  }

  const confidences = [
    result.decision_head?.scope,
    result.decision_head?.extraction
  ]
    .filter(Boolean)
    .map(head => {
      const label = head!.label
      const confidence =
        typeof head!.confidence === 'number'
          ? `${Math.round(head!.confidence * 100)}%`
          : '-'
      return `${label} ${confidence}`
    })
  if (confidences.length > 0) {
    details.push(`**신뢰도**: ${confidences.join(', ')}`)
  }

  if (details.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(...details)
  }

  return lines.join('\n')
}

export async function proxyTreatmentPlan(
  payload: TreatmentPlanClientPayload
): Promise<{ status: number; body: Record<string, unknown> }> {
  const model = resolveTreatmentPlanModel(payload.model)
  const baseUrl = getDentalLamaApiBaseUrl()
  const endpoint = `${baseUrl}${TREATMENT_PLAN_ENDPOINTS[model]}`
  const upstreamPayload =
    model === 'orthoplanner'
      ? buildOrthoPlannerPayload(payload)
      : buildGemmaPayload(payload)

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(upstreamPayload),
    signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS)
  })

  const responseText = await upstream.text()
  let json: unknown = null
  if (responseText) {
    try {
      json = JSON.parse(responseText)
    } catch {
      json = responseText
    }
  }

  if (!upstream.ok) {
    return {
      status: upstream.status,
      body: {
        error: extractUpstreamError(
          json,
          `API error: ${upstream.status} ${upstream.statusText}`
        )
      }
    }
  }

  if (model === 'orthoplanner') {
    const result = (json || {}) as OrthoPlannerTreatmentPlanResponse
    return {
      status: 200,
      body: {
        response: formatOrthoPlannerResponse(result),
        orthoplanner: result
      }
    }
  }

  const gemma = (json || {}) as { response?: string }
  return {
    status: 200,
    body: {
      response:
        gemma.response ??
        (typeof json === 'string' ? json : JSON.stringify(json ?? ''))
    }
  }
}
