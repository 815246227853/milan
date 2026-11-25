'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: 'Home', hindi: 'घर' },
  { href: '/jobs', label: 'Jobs', hindi: 'काम' },
  { href: '/booked', label: 'Booked', hindi: 'पक्का' },
] as const

export function BottomNav() {
  const path = usePathname()
  if (path.startsWith('/setup')) return null
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const active = t.href === '/' ? path === '/' : path.startsWith(t.href)
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center py-2.5 text-sm ${active ? 'text-sindoor' : 'text-muted'}`}
              >
                <span className={`font-display text-lg leading-none ${active ? '' : 'opacity-70'}`}>{t.hindi}</span>
                <span className="mt-0.5 font-medium">{t.label}</span>
                <span className={`mt-1 h-1 w-1 rounded-full ${active ? 'bg-genda' : 'bg-transparent'}`} />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
