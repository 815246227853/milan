import type { Wedding } from '@/lib/types'

function daysUntil(date: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((Date.parse(`${date}T00:00:00`) - today.getTime()) / 86_400_000)
}

/** The mandap arch: the couple, and how many days are left. The one loud thing on the home screen. */
export function ArchHero({ wedding }: { wedding: Wedding }) {
  const days = daysUntil(wedding.date)
  const dateText = new Date(`${wedding.date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (
    <section className="relative mx-auto -mt-3 w-full max-w-[22rem] px-4" aria-label="Your wedding">
      <svg viewBox="0 0 300 360" className="block h-auto w-full drop-shadow-[0_18px_30px_rgba(94,15,28,0.25)]" aria-hidden>
        <path
          d="M0,360 V150 C0,95 38,66 82,54 C114,45 134,24 150,2 C166,24 186,45 218,54 C262,66 300,95 300,150 V360 Z"
          fill="#8e1b2c"
        />
        <path
          d="M14,360 V154 C14,104 48,80 88,69 C118,61 137,42 150,24 C163,42 182,61 212,69 C252,80 286,104 286,154 V360"
          fill="none"
          stroke="#f2b705"
          strokeWidth="1.6"
        />
        <path
          d="M22,360 V157 C22,110 54,87 91,77 C120,69 138,52 150,37 C162,52 180,69 209,77 C246,87 278,110 278,157 V360"
          fill="none"
          stroke="#f2b705"
          strokeWidth="0.6"
          strokeDasharray="2 3"
        />
        <circle cx="150" cy="58" r="7" fill="#f2b705" />
        <circle cx="150" cy="58" r="3" fill="#8e1b2c" />
      </svg>
      <div className="absolute inset-x-4 top-[26%] flex flex-col items-center px-8 text-center text-paper">
        <p className="font-display text-[2rem] leading-tight">{wedding.coupleA}</p>
        <p className="font-display text-base text-haldi">संग</p>
        <p className="font-display text-[2rem] leading-tight">{wedding.coupleB}</p>
        <div className="mt-5 h-px w-16 bg-haldi/60" />
        {days > 0 ? (
          <p className="mt-4">
            <span className="font-display block text-6xl leading-none text-haldi">{days}</span>
            <span className="mt-1 block text-lg">{days === 1 ? 'din baaki' : 'din baaki hain'}</span>
          </p>
        ) : (
          <p className="font-display mt-4 text-3xl text-haldi">{days === 0 ? 'Aaj shaadi hai!' : 'Shaadi mubarak!'}</p>
        )}
        <p className="mt-3 text-sm text-paper/85">
          {dateText}
          <br />
          {wedding.city}
        </p>
      </div>
    </section>
  )
}
