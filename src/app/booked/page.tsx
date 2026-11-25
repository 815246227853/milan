import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BudgetBar } from '@/components/BudgetBar'
import { CATEGORIES } from '@/lib/categories'
import { getWedding, listBookings } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export default function BookedPage() {
  const wedding = getWedding()
  if (!wedding) redirect('/setup')
  const bookings = listBookings()
  const bookedIds = new Set(bookings.map((b) => b.category))
  const pending = CATEGORIES.filter((c) => !bookedIds.has(c.id))
  return (
    <main className="mx-auto max-w-xl px-4 pt-6">
      <h1 className="font-display text-4xl text-sindoor">Pakka</h1>
      <p className="text-muted">Vendors Milan has booked, and what&apos;s still open.</p>
      <BudgetBar total={wedding.totalBudget} bookings={bookings} />
      <h2 className="font-display mt-8 text-2xl text-sindoor">Still to book</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {pending.map((c) => (
          <li key={c.id} className="rounded-2xl border border-dashed border-genda/60 bg-card p-3">
            <span className="font-display block text-lg text-sindoor">{c.hindi}</span>
            <span className="text-muted">{c.label}</span>
          </li>
        ))}
      </ul>
      <Link href="/" className="mt-6 inline-block font-semibold text-sindoor underline">
        Ask Milan to find one
      </Link>
    </main>
  )
}
