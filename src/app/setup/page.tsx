import { Toran } from '@/components/Toran'
import { SetupForm } from '@/components/SetupForm'
import { getWedding } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export default function SetupPage() {
  const wedding = getWedding()
  return (
    <main>
      <Toran />
      <div className="mx-auto max-w-xl px-4 pt-4">
        <h1 className="font-display text-4xl leading-tight text-sindoor">
          {wedding ? 'Shaadi ki details' : 'Shubh aarambh'}
        </h1>
        <p className="mt-1 text-lg text-muted">
          {wedding
            ? 'Change anything here. New jobs use the updated details.'
            : 'A few details about the wedding, so Milan knows what to ask vendors.'}
        </p>
        <SetupForm initial={wedding} />
      </div>
    </main>
  )
}
