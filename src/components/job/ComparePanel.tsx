'use client'

import { useState } from 'react'
import type { BookResult, JobView } from '@/lib/agent/runner'
import type { ComparedOption } from '@/lib/agent/compare'
import { rupees, shortRupees } from '@/lib/money'
import { postJson } from './api'

function OptionCard({
  option,
  pick,
  unitPlate,
  guests,
  canBook,
  onBook,
  busy,
}: {
  option: ComparedOption
  pick: boolean
  unitPlate: boolean
  guests: number
  canBook: boolean
  onBook: () => void
  busy: boolean
}) {
  const { vendor, quote, total, overBudgetBy, budgetTotal } = option
  return (
    <li
      className={`relative rounded-2xl bg-card p-4 ${pick ? 'border-2 border-genda shadow-[0_6px_0_rgba(233,115,28,0.25)]' : 'border border-line'}`}
    >
      {pick && (
        <span className="font-display absolute -top-3 left-4 rounded-full bg-genda px-3 py-0.5 text-sm text-white">
          Milan&apos;s pick
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">{vendor.name}</p>
          {vendor.rating !== null && (
            <p className="text-sm text-muted">
              ★ {vendor.rating.toFixed(1)} {vendor.reviews !== null && `(${vendor.reviews})`}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl leading-none text-ink">
            {unitPlate ? rupees(quote.price!) : shortRupees(total)}
          </p>
          <p className="text-sm text-muted">{unitPlate ? `a plate, ${shortRupees(total)} for ${guests}` : 'total'}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.95rem]">
        {quote.includes && (
          <>
            <dt className="text-muted">Includes</dt>
            <dd>{quote.includes}</dd>
          </>
        )}
        {quote.advance && (
          <>
            <dt className="text-muted">Advance</dt>
            <dd>{quote.advance}</dd>
          </>
        )}
        {quote.notes && (
          <>
            <dt className="text-muted">Note</dt>
            <dd>{quote.notes}</dd>
          </>
        )}
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={`text-sm font-semibold ${overBudgetBy > 0 ? 'text-rani' : 'text-mehendi'}`}>
          {overBudgetBy > 0 ? `${shortRupees(overBudgetBy)} over budget` : `${shortRupees(budgetTotal - total)} under budget`}
        </span>
        {canBook && (
          <button
            type="button"
            onClick={onBook}
            disabled={busy}
            className={`rounded-full px-5 py-2 font-semibold disabled:opacity-50 ${
              pick ? 'bg-sindoor text-paper' : 'border-2 border-sindoor text-sindoor'
            }`}
          >
            Book
          </button>
        )}
      </div>
    </li>
  )
}

export function ComparePanel({ view, onChanged }: { view: JobView; onChanged: () => Promise<void> }) {
  const { job, options } = view
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approval, setApproval] = useState<{ vendorId: string; name: string; overBy: number } | null>(null)

  async function book(vendorId: string, approvedOverBudget = false) {
    setBusy(true)
    setError(null)
    try {
      const result = await postJson<BookResult>(`/api/jobs/${job.id}/book`, { vendorId, approvedOverBudget })
      if (result.status === 'needs_approval') {
        const name = options.find((o) => o.vendor.id === vendorId)?.vendor.name ?? 'This vendor'
        setApproval({ vendorId, name, overBy: result.overBy })
      } else {
        setApproval(null)
        await onChanged()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book.')
    } finally {
      setBusy(false)
    }
  }

  if (job.status === 'calling') {
    const done = view.calls.filter((c) => c.purpose === 'enquiry' && ['done', 'no_answer', 'failed'].includes(c.status)).length
    const total = view.calls.filter((c) => c.purpose === 'enquiry').length
    return (
      <section aria-labelledby="quotes">
        <h2 id="quotes" className="font-display text-2xl text-sindoor">
          Quotes
        </h2>
        <p className="mt-2 rounded-2xl bg-card p-4 text-muted">
          {done} of {total} calls finished. Milan compares the quotes once everyone has been called.
        </p>
        {options.length > 0 && (
          <ul className="mt-4 space-y-4">
            {options.map((o) => (
              <OptionCard key={o.vendor.id} option={o} pick={false} unitPlate={job.brief.budgetUnit === 'plate'} guests={job.brief.guests} canBook={false} onBook={() => {}} busy />
            ))}
          </ul>
        )}
      </section>
    )
  }

  const booked = options.find((o) => o.vendor.id === job.bookedVendorId)
  const confirmCall = view.calls.find((c) => c.purpose === 'confirm')
  const confirmText =
    confirmCall?.status === 'done'
      ? 'They confirmed on the phone.'
      : confirmCall?.status === 'no_answer' || confirmCall?.status === 'failed'
        ? "They didn't pick up the confirmation call. Call them once yourself."
        : 'Milan is calling them to confirm.'
  const quotedIds = new Set(options.map((o) => o.vendor.id))
  const notFree = view.vendors.filter((v) => v.status === 'quoted' && !quotedIds.has(v.id))
  const noAnswer = view.vendors.filter((v) => v.status === 'no_answer')

  return (
    <section aria-labelledby="quotes">
      {booked ? (
        <div className="rounded-2xl bg-mehendi p-5 text-paper">
          <p className="font-display text-3xl">Pakka ho gaya!</p>
          <p className="mt-1 text-lg">
            {booked.vendor.name} is booked for {rupees(booked.total)}. {confirmText}
          </p>
        </div>
      ) : (
        <>
          <h2 id="quotes" className="font-display text-2xl text-sindoor">
            Aapki baari
          </h2>
          <p className="mt-1 text-lg">{job.recommendation}</p>
        </>
      )}

      {approval && (
        <div role="alertdialog" aria-labelledby="approve-title" className="mt-4 rounded-2xl border-2 border-rani bg-rani/5 p-4">
          <p id="approve-title" className="font-semibold text-rani">
            {approval.name} is {rupees(approval.overBy)} over your budget.
          </p>
          <p className="mt-1 text-muted">Book anyway? Milan will call them to confirm at the quoted price.</p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => book(approval.vendorId, true)}
              className="rounded-full bg-rani px-5 py-2 font-semibold text-white disabled:opacity-50"
            >
              Book anyway
            </button>
            <button type="button" onClick={() => setApproval(null)} className="rounded-full px-5 py-2 text-muted underline">
              Keep looking
            </button>
          </div>
        </div>
      )}
      <p role="alert" className="mt-2 min-h-5 text-rani">
        {error}
      </p>

      <ul className="mt-4 space-y-5">
        {options.map((o, i) => (
          <OptionCard
            key={o.vendor.id}
            option={o}
            pick={booked ? o === booked : i === 0}
            unitPlate={job.brief.budgetUnit === 'plate'}
            guests={job.brief.guests}
            canBook={job.status === 'compared'}
            onBook={() => book(o.vendor.id)}
            busy={busy}
          />
        ))}
      </ul>
      {(notFree.length > 0 || noAnswer.length > 0) && (
        <p className="mt-4 text-[0.95rem] text-muted">
          {notFree.length > 0 && <>Not free on your date: {notFree.map((v) => v.name).join(', ')}. </>}
          {noAnswer.length > 0 && <>Didn&apos;t pick up: {noAnswer.map((v) => v.name).join(', ')}.</>}
        </p>
      )}
    </section>
  )
}
