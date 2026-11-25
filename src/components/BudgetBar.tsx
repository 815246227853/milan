import { getCategory } from '@/lib/categories'
import { rupees, shortRupees } from '@/lib/money'
import type { Booking } from '@/lib/types'

const SEGMENT_COLORS = ['#8e1b2c', '#e9731c', '#f2b705', '#3f5a2a', '#c2255c', '#5e0f1c', '#b8860b', '#6b8e23']

/** Booked spend against the total budget, one coloured segment per booking. */
export function BudgetBar({ total, bookings }: { total: number; bookings: readonly Booking[] }) {
  const spent = bookings.reduce((sum, b) => sum + b.amount, 0)
  const left = total - spent
  return (
    <div className="mt-3 rounded-2xl bg-card p-4">
      <p className="flex items-baseline justify-between">
        <span>
          <span className="font-display text-2xl text-ink">{shortRupees(spent)}</span>
          <span className="text-muted"> booked of {shortRupees(total)}</span>
        </span>
        <span className={left < 0 ? 'font-semibold text-rani' : 'text-mehendi'}>
          {left < 0 ? `${shortRupees(-left)} over` : `${shortRupees(left)} left`}
        </span>
      </p>
      <div
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`${rupees(spent)} booked of ${rupees(total)}`}
      >
        {bookings.map((b, i) => (
          <span
            key={b.jobId}
            style={{ width: `${Math.min(100, (b.amount / total) * 100)}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
          />
        ))}
      </div>
      {bookings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[0.95rem]">
          {bookings.map((b, i) => (
            <li key={b.jobId} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
              <span className="flex-1">
                {getCategory(b.category).label}: {b.vendorName}
              </span>
              <span className="tabular-nums">{rupees(b.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nothing booked yet. Bookings show up here as Milan closes them.</p>
      )}
    </div>
  )
}
