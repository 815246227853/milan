import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArchHero } from '@/components/ArchHero'
import { BudgetBar } from '@/components/BudgetBar'
import { PromptBox, type Suggestion } from '@/components/PromptBox'
import { Toran } from '@/components/Toran'
import { defaultBudget } from '@/lib/agent/parse'
import { getCategory } from '@/lib/categories'
import { shortRupees } from '@/lib/money'
import { getWedding, listActivity, listBookings, listJobs } from '@/lib/repo'
import type { Wedding } from '@/lib/types'

export const dynamic = 'force-dynamic'

function suggestionsFor(w: Wedding): Suggestion[] {
  const picks = ['venue', 'catering', 'decor', 'photography', 'mehendi', 'music'] as const
  return picks.map((id) => {
    const c = getCategory(id)
    const budget = defaultBudget(id, w)
    const money = c.unit === 'plate' ? `₹${budget} a plate` : shortRupees(budget)
    const text =
      id === 'catering'
        ? `Find a pure veg caterer near ${w.locality} for ${w.guests} guests, within ${money}`
        : `Find the best ${c.label.toLowerCase()} near ${w.locality} under ${money}`
    return { label: c.label, hindi: c.hindi, text }
  })
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`)) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours} hr ago` : `${Math.round(hours / 24)} d ago`
}

export default function Home() {
  const wedding = getWedding()
  if (!wedding) redirect('/setup')

  const jobs = listJobs(wedding.id)
  const needsYou = jobs.filter((j) => j.status === 'compared')
  const calling = jobs.filter((j) => j.status === 'calling')
  const bookings = listBookings()
  const activity = listActivity(8)

  return (
    <main>
      <header className="relative">
        <Toran />
        <Link
          href="/setup"
          className="absolute right-3 top-14 rounded-full bg-card/90 px-3 py-1 text-sm text-muted shadow-sm"
        >
          Edit details
        </Link>
      </header>

      <ArchHero wedding={wedding} />

      <PromptBox
        suggestions={suggestionsFor(wedding)}
        placeholder={`Find me the top banquet halls near ${wedding.locality} for ${wedding.guests} guests under ₹5 lakh`}
      />

      {needsYou.length > 0 && (
        <section className="mx-auto mt-10 max-w-xl px-4" aria-labelledby="needs-you">
          <h2 id="needs-you" className="font-display text-2xl text-rani">
            Aapki baari
          </h2>
          <p className="text-muted">Quotes are in. Pick one and Milan books it.</p>
          <ul className="mt-3 space-y-3">
            {needsYou.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="block rounded-2xl border-l-[6px] border-rani bg-card p-4 shadow-[0_2px_0_var(--color-line)]"
                >
                  <p className="font-semibold">{getCategory(j.brief.category).label} near {j.brief.area}</p>
                  <p className="mt-1 text-muted">{j.recommendation}</p>
                  <p className="mt-2 font-semibold text-rani">Compare and book</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {calling.length > 0 && (
        <section className="mx-auto mt-10 max-w-xl px-4" aria-labelledby="on-phone">
          <h2 id="on-phone" className="font-display text-2xl text-sindoor">
            Milan is on the phone
          </h2>
          <ul className="mt-3 space-y-2">
            {calling.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-4">
                  <span className="wave text-genda" aria-hidden>
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>
                    Calling {getCategory(j.brief.category).label.toLowerCase()} vendors near {j.brief.area}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto mt-10 max-w-xl px-4" aria-labelledby="budget">
        <h2 id="budget" className="font-display text-2xl text-sindoor">
          Kharcha
        </h2>
        <BudgetBar total={wedding.totalBudget} bookings={bookings} />
      </section>

      <section className="mx-auto mt-10 max-w-xl px-4" aria-labelledby="activity">
        <h2 id="activity" className="font-display text-2xl text-sindoor">
          What Milan did
        </h2>
        {activity.length === 0 ? (
          <p className="mt-2 text-muted">Nothing yet. Ask for a venue or caterer above to get started.</p>
        ) : (
          <ol className="mt-3 border-l-2 border-dashed border-genda/50 pl-4">
            {activity.map((a) => (
              <li key={a.id} className="relative pb-3">
                <span className="absolute -left-[1.4rem] top-2 h-2.5 w-2.5 rounded-full bg-genda" aria-hidden />
                {a.jobId ? (
                  <Link href={`/jobs/${a.jobId}`} className="hover:underline">
                    {a.text}
                  </Link>
                ) : (
                  <span>{a.text}</span>
                )}
                <span className="block text-sm text-muted">{timeAgo(a.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="mx-auto mt-8 max-w-xl px-4 text-center text-sm text-muted">
        Milan always tells vendors it is an AI assistant calling for your family.
      </p>
    </main>
  )
}
