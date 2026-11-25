import type { JobStatus } from '@/lib/types'

const STEPS = [
  { id: 'shortlist', label: 'Found' },
  { id: 'calling', label: 'Calling' },
  { id: 'compared', label: 'Compared' },
  { id: 'booked', label: 'Booked' },
] as const

/** Where the job is. A real sequence, so it is numbered. */
export function Steps({ status }: { status: JobStatus }) {
  const current = STEPS.findIndex((s) => s.id === status)
  return (
    <ol className="mt-6 flex items-center justify-between gap-1 sm:justify-start" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current
        const here = i === current
        return (
          <li key={s.id} className="flex items-center gap-1 sm:flex-1" aria-current={here ? 'step' : undefined}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                done ? 'bg-mehendi text-white' : here ? 'bg-genda text-white' : 'bg-line text-muted'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={`text-[0.8rem] sm:text-sm ${here ? 'font-semibold text-ink' : 'text-muted'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <span className={`mx-1 hidden h-0.5 flex-1 sm:block ${done ? 'bg-mehendi' : 'bg-line'}`} />}
          </li>
        )
      })}
    </ol>
  )
}
