import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCategory } from '@/lib/categories'
import { getWedding, listJobs } from '@/lib/repo'
import type { JobStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATUS: Record<JobStatus, { label: string; tone: string }> = {
  shortlist: { label: 'Pick who to call', tone: 'text-genda' },
  calling: { label: 'On the phone', tone: 'text-genda' },
  compared: { label: 'Needs you', tone: 'text-rani' },
  booked: { label: 'Booked', tone: 'text-mehendi' },
  failed: { label: 'Stopped', tone: 'text-muted' },
}

export default function JobsPage() {
  const wedding = getWedding()
  if (!wedding) redirect('/setup')
  const jobs = listJobs(wedding.id)
  return (
    <main className="mx-auto max-w-xl px-4 pt-6">
      <h1 className="font-display text-4xl text-sindoor">Kaam</h1>
      <p className="text-muted">Everything you&apos;ve asked Milan to do.</p>
      {jobs.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-card p-5">
          No jobs yet.{' '}
          <Link href="/" className="font-semibold text-sindoor underline">
            Ask Milan for a venue or caterer
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {jobs.map((j) => {
            const c = getCategory(j.brief.category)
            const s = STATUS[j.status]
            return (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex gap-3 rounded-2xl bg-card p-4">
                  <span className="font-display w-16 shrink-0 text-center text-lg leading-tight text-sindoor">{c.hindi}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{j.request}</span>
                    <span className={`text-sm font-semibold ${s.tone}`}>{s.label}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
