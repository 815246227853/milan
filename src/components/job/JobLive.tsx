'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { JobView } from '@/lib/agent/runner'
import { getCategory } from '@/lib/categories'
import type { ApiResponse } from '@/lib/http'
import { rupees, shortRupees } from '@/lib/money'
import { CallsPanel } from './CallsPanel'
import { ComparePanel } from './ComparePanel'
import { ShortlistPanel } from './ShortlistPanel'
import { Steps } from './Steps'

const POLL_MS = 1_500

export function JobLive({ initial }: { initial: JobView }) {
  const [view, setView] = useState<JobView>(initial)
  const [error, setError] = useState<string | null>(null)
  const { job } = view

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { cache: 'no-store' })
      const body = (await res.json()) as ApiResponse<JobView>
      if (!body.ok) throw new Error(body.error)
      setView(body.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lost touch with the server. Retrying.')
    }
  }, [job.id])

  const callsRunning = view.calls.some((c) => c.status === 'queued' || c.status === 'ringing' || c.status === 'live')
  useEffect(() => {
    if (!callsRunning) return
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [callsRunning, load])

  const c = getCategory(job.brief.category)
  const date = new Date(`${job.brief.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <Link href="/" className="text-muted hover:text-sindoor">
        ← Home
      </Link>
      <header className="mt-3">
        <p className="font-display text-lg text-genda">{c.hindi}</p>
        <h1 className="font-display text-2xl leading-snug text-sindoor sm:text-4xl sm:leading-tight">“{job.request}”</h1>
        <ul className="mt-3 flex flex-wrap gap-2 text-[0.95rem]" aria-label="What Milan understood">
          {[
            c.label,
            job.brief.area,
            `${job.brief.guests} guests`,
            date,
            job.brief.budgetUnit === 'plate'
              ? `${rupees(job.brief.budget)} a plate`
              : `up to ${shortRupees(job.brief.budget)}`,
            ...(job.brief.preferences ? [job.brief.preferences] : []),
          ].map((t) => (
            <li key={t} className="rounded-lg bg-haldi/20 px-2.5 py-1">
              {t}
            </li>
          ))}
        </ul>
      </header>

      <Steps status={job.status} />

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-rani/10 px-4 py-3 text-rani">
          {error}
        </p>
      )}

      {view.simulated && (
        <p className="mt-4 rounded-xl border border-dashed border-genda px-4 py-2.5 text-[0.95rem] text-muted">
          Practice mode: calls are simulated because Bolna isn&apos;t connected. Add BOLNA_API_KEY to make real calls.
        </p>
      )}

      {job.status === 'shortlist' ? (
        <ShortlistPanel view={view} onStarted={setView} />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <ComparePanel view={view} onChanged={load} />
          <CallsPanel view={view} />
        </div>
      )}
    </main>
  )
}
