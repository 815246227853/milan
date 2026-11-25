import type { ApiResponse } from '@/lib/http'

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = (await res.json()) as ApiResponse<T>
  if (!json.ok) throw new Error(json.error)
  return json.data
}
