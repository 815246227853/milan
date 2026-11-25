/**
 * Creates (or updates) the Milan vendor agent on Bolna from bolna/vendor.json.
 * Usage: npm run sync-agent   (reads .env; writes BOLNA_AGENT_VENDOR back to .env on first run)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(here, '../.env')

const apiKey = process.env.BOLNA_API_KEY
if (!apiKey) throw new Error('BOLNA_API_KEY is not set in .env')

const payload = JSON.parse(readFileSync(resolve(here, 'vendor.json'), 'utf8'))
for (const prompt of Object.values<{ system_prompt: string }>(payload.agent_prompts)) {
  if (prompt.system_prompt.startsWith('@file:')) {
    prompt.system_prompt = readFileSync(resolve(here, prompt.system_prompt.slice(6)), 'utf8').trim()
  }
}

async function bolna(method: string, path: string, body: unknown): Promise<{ agent_id?: string }> {
  const res = await fetch(`https://api.bolna.ai${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`)
  return text ? JSON.parse(text) : {}
}

const existing = process.env.BOLNA_AGENT_VENDOR
if (existing) {
  await bolna('PUT', `/v2/agent/${existing}`, payload)
  console.log(`Updated milan-vendor (${existing})`)
} else {
  const { agent_id } = await bolna('POST', '/v2/agent', payload)
  if (!agent_id) throw new Error('Bolna did not return an agent_id')
  const env = readFileSync(envPath, 'utf8')
  const line = `BOLNA_AGENT_VENDOR=${agent_id}`
  writeFileSync(envPath, /^BOLNA_AGENT_VENDOR=.*$/m.test(env) ? env.replace(/^BOLNA_AGENT_VENDOR=.*$/m, line) : `${env.trimEnd()}\n${line}\n`)
  console.log(`Created milan-vendor (${agent_id}) and saved BOLNA_AGENT_VENDOR to .env`)
}
