'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ApiResponse } from '@/lib/http'

export interface Suggestion {
  readonly label: string
  readonly hindi: string
  readonly text: string
}

export function PromptBox({ suggestions, placeholder }: { suggestions: readonly Suggestion[]; placeholder: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || text.trim().length < 5) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: text }),
      })
      const body = (await res.json()) as ApiResponse<{ id: string }>
      if (!body.ok) throw new Error(body.error)
      router.push(`/jobs/${body.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the job.')
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto mt-8 max-w-xl px-4" aria-labelledby="ask">
      <h2 id="ask" className="font-display text-2xl text-sindoor">
        Kya karwana hai?
      </h2>
      <p className="text-muted">Tell Milan what you need. It finds vendors near you and calls them for quotes.</p>
      <form onSubmit={submit} className="mt-3">
        <label htmlFor="request" className="sr-only">
          What you need
        </label>
        <textarea
          id="request"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
          }}
          rows={3}
          maxLength={500}
          placeholder={placeholder}
          className="w-full resize-none rounded-2xl border-2 border-line bg-card px-4 py-3 text-lg leading-snug shadow-[inset_0_2px_0_rgba(43,26,20,0.03)] placeholder:text-muted/70 focus:border-genda focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p role="alert" className="min-h-5 text-sm text-rani">
            {error}
          </p>
          <button
            type="submit"
            disabled={busy || text.trim().length < 5}
            className="shrink-0 rounded-full bg-sindoor px-6 py-3 text-lg font-semibold text-paper shadow-[0_6px_0_#5e0f1c] transition active:translate-y-1 active:shadow-[0_2px_0_#5e0f1c] disabled:opacity-50"
          >
            {busy ? 'Finding vendors…' : 'Find vendors'}
          </button>
        </div>
      </form>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Quick picks">
        {suggestions.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => setText(s.text)}
              className="rounded-full border border-genda/50 bg-genda/10 px-3.5 py-1.5 text-[0.95rem] text-ink hover:bg-genda/20"
            >
              <span className="font-display mr-1.5 text-sindoor">{s.hindi}</span>
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
