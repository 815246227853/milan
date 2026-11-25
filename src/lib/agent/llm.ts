import OpenAI from 'openai'
import { env } from '../env'

let client: OpenAI | null = null

export const llmAvailable = (): boolean => Boolean(env.openaiApiKey)

/** One JSON-mode completion. Callers validate the result with zod. */
export async function askJson(system: string, user: string): Promise<unknown> {
  if (!llmAvailable()) throw new Error('OPENAI_API_KEY is not set')
  client ??= new OpenAI({ apiKey: env.openaiApiKey })
  const res = await client.chat.completions.create({
    model: env.openaiModel,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  const text = res.choices[0]?.message?.content
  if (!text) throw new Error('LLM returned an empty reply')
  return JSON.parse(text)
}
