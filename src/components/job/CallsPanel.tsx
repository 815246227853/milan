'use client'

import { useState } from 'react'
import type { JobView } from '@/lib/agent/runner'
import type { Call, CallStatus, Vendor } from '@/lib/types'

const STATUS: Record<CallStatus, { label: string; tone: string }> = {
  queued: { label: 'Waiting', tone: 'bg-line text-muted' },
  ringing: { label: 'Ringing', tone: 'bg-genda/15 text-genda' },
  live: { label: 'On the call', tone: 'bg-genda text-white' },
  done: { label: 'Done', tone: 'bg-mehendi/15 text-mehendi' },
  no_answer: { label: 'No answer', tone: 'bg-line text-muted' },
  failed: { label: "Couldn't connect", tone: 'bg-rani/10 text-rani' },
}

function CallRow({ call, vendor }: { call: Call; vendor: Vendor | undefined }) {
  const live = call.status === 'live'
  const [open, setOpen] = useState(false)
  const showTranscript = (open || live) && call.transcript.length > 0
  const s = STATUS[call.status]
  return (
    <li className="rounded-2xl bg-card p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sindoor text-lg text-paper ${
            call.status === 'ringing' ? 'ringing' : ''
          }`}
          aria-hidden
        >
          {live ? (
            <span className="wave text-haldi">
              <span />
              <span />
              <span />
            </span>
          ) : (
            '☎'
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {vendor?.name ?? 'Vendor'}
            {call.purpose === 'confirm' && <span className="font-normal text-muted"> · confirming booking</span>}
          </p>
          <span className={`inline-block rounded-md px-2 py-0.5 text-sm ${s.tone}`}>{s.label}</span>
        </div>
        {call.transcript.length > 0 && !live && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-sm text-sindoor underline"
          >
            {open ? 'Hide call' : 'Read call'}
          </button>
        )}
      </div>
      {showTranscript && (
        <ol className="mt-3 space-y-2" aria-live={live ? 'polite' : undefined}>
          {call.transcript.map((line, i) => (
            <li
              key={i}
              className={`line-in max-w-[88%] rounded-2xl px-3.5 py-2 text-[0.97rem] leading-snug ${
                line.speaker === 'milan'
                  ? 'rounded-tl-sm bg-sindoor/8 text-ink'
                  : 'ml-auto rounded-tr-sm bg-haldi/25 text-ink'
              }`}
            >
              <span className="block text-xs font-semibold text-muted">
                {line.speaker === 'milan' ? 'Milan' : vendor?.name ?? 'Vendor'}
              </span>
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}

export function CallsPanel({ view }: { view: JobView }) {
  const byVendor = new Map(view.vendors.map((v) => [v.id, v]))
  // The booking confirmation goes on top; enquiries stay in the order they were dialled.
  const calls = [...view.calls].sort((a, b) => Number(b.purpose === 'confirm') - Number(a.purpose === 'confirm'))
  return (
    <section aria-labelledby="calls">
      <h2 id="calls" className="font-display text-2xl text-sindoor">
        Phone calls
      </h2>
      <ul className="mt-3 space-y-3">
        {calls.map((c) => (
          <CallRow key={c.id} call={c} vendor={byVendor.get(c.vendorId)} />
        ))}
      </ul>
    </section>
  )
}
