'use client'

import { useState } from 'react'
import type { JobView } from '@/lib/agent/runner'
import { postJson } from './api'

function Stars({ rating, reviews }: { rating: number | null; reviews: number | null }) {
  if (rating === null) return <span className="text-muted">No ratings</span>
  return (
    <span>
      <span className="text-genda" aria-hidden>
        ★
      </span>{' '}
      <span className="font-semibold">{rating.toFixed(1)}</span>
      {reviews !== null && <span className="text-muted"> ({reviews} reviews)</span>}
    </span>
  )
}

export function ShortlistPanel({ view, onStarted }: { view: JobView; onStarted: (v: JobView) => void }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set(view.vendors.map((v) => v.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function call() {
    setBusy(true)
    setError(null)
    try {
      onStarted(await postJson<JobView>(`/api/jobs/${view.job.id}/call`, { vendorIds: [...picked] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the calls.')
      setBusy(false)
    }
  }

  const fromGoogle = view.vendors.some((v) => v.source === 'google')

  return (
    <section className="mt-6 max-w-2xl" aria-labelledby="shortlist">
      <h2 id="shortlist" className="font-display text-2xl text-sindoor">
        Who should Milan call?
      </h2>
      <p className="text-muted">
        {fromGoogle ? 'Top rated on Google Maps near you.' : 'Sample vendors. Add a Google Places key to search real ones.'}{' '}
        Untick anyone you don&apos;t want called.
      </p>
      <ul className="mt-4 space-y-3">
        {view.vendors.map((v) => {
          const on = picked.has(v.id)
          return (
            <li key={v.id}>
              <label
                className={`flex cursor-pointer gap-3 rounded-2xl border-2 bg-card p-4 transition ${
                  on ? 'border-genda' : 'border-line opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(v.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#8e1b2c]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold">{v.name}</span>
                  <span className="block text-[0.95rem]">
                    <Stars rating={v.rating} reviews={v.reviews} />
                  </span>
                  <span className="block truncate text-sm text-muted">{v.address}</span>
                  {v.mapsUrl && (
                    <a href={v.mapsUrl} target="_blank" rel="noreferrer" className="text-sm text-sindoor underline">
                      Open in Maps
                    </a>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {view.demoRouting && (
        <p className="mt-4 text-sm text-muted">Demo mode: each call rings one of your team&apos;s phones instead of the vendor.</p>
      )}
      <p role="alert" className="mt-2 min-h-5 text-rani">
        {error}
      </p>
      <button
        type="button"
        onClick={call}
        disabled={busy || picked.size === 0}
        className="mt-1 w-full rounded-full bg-sindoor py-3.5 text-lg font-semibold text-paper shadow-[0_6px_0_#5e0f1c] active:translate-y-1 active:shadow-[0_2px_0_#5e0f1c] disabled:opacity-50 sm:w-auto sm:px-10"
      >
        {busy ? 'Dialling…' : `Call ${picked.size} ${picked.size === 1 ? 'vendor' : 'vendors'}`}
      </button>
    </section>
  )
}
