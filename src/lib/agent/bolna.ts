import { z } from 'zod'
import { env } from '../env'
import type { CallStatus, TranscriptLine } from '../types'

const BASE = 'https://api.bolna.ai'

const callResponse = z.object({ execution_id: z.string() }).passthrough()
const executionSchema = z
  .object({
    id: z.string().optional(),
    status: z.string(),
    transcript: z.string().nullish(),
    extracted_data: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough()

export type Execution = z.infer<typeof executionSchema>

async function bolna(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.bolnaApiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const text = await res.text()
  // Keep the body short: it can echo call data and ends up in logs.
  if (!res.ok) throw new Error(`Bolna ${init.method ?? 'GET'} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

/** Starts an outbound call with the vendor agent. Variables fill the {{...}} slots in its prompt. */
export async function placeCall(to: string, variables: Record<string, string>): Promise<string> {
  const json = await bolna('/call', {
    method: 'POST',
    body: JSON.stringify({
      agent_id: env.bolnaAgentVendor,
      recipient_phone_number: to,
      ...(env.bolnaFromNumber ? { from_phone_number: env.bolnaFromNumber } : {}),
      user_data: variables,
    }),
  })
  return callResponse.parse(json).execution_id
}

export async function getExecution(executionId: string): Promise<Execution> {
  return executionSchema.parse(await bolna(`/executions/${executionId}`, { method: 'GET' }))
}

/** Maps Bolna's execution status onto Milan's call status. */
export function toCallStatus(bolnaStatus: string): CallStatus {
  switch (bolnaStatus) {
    case 'queued':
    case 'scheduled':
    case 'initiated':
      return 'queued'
    case 'ringing':
      return 'ringing'
    case 'in-progress':
      return 'live'
    case 'completed':
    case 'call-disconnected':
      return 'done'
    case 'busy':
    case 'no-answer':
    case 'canceled':
      return 'no_answer'
    default:
      return 'failed' // failed, error, stopped, balance-low
  }
}

/** Bolna transcripts are "assistant: ..." / "user: ..." lines. */
export function parseTranscript(raw: string | null | undefined): TranscriptLine[] {
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): TranscriptLine | null => {
      const m = line.match(/^(assistant|user|agent|bot|human)\s*:\s*(.*)$/i)
      if (!m) return null
      const speaker = /^(assistant|agent|bot)$/i.test(m[1]) ? 'milan' : 'vendor'
      return { speaker, text: m[2] }
    })
    .filter((l): l is TranscriptLine => l !== null && l.text.length > 0)
}
