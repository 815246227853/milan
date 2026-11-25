'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ApiResponse } from '@/lib/http'
import type { FunctionName, Wedding } from '@/lib/types'

const FUNCTIONS: readonly { id: FunctionName; label: string }[] = [
  { id: 'haldi', label: 'Haldi' },
  { id: 'mehendi', label: 'Mehendi' },
  { id: 'sangeet', label: 'Sangeet' },
  { id: 'shaadi', label: 'Shaadi' },
  { id: 'reception', label: 'Reception' },
]

const LANGUAGES = [
  { id: 'hi', label: 'Hindi' },
  { id: 'mr', label: 'Marathi' },
  { id: 'gu', label: 'Gujarati' },
  { id: 'ta', label: 'Tamil' },
  { id: 'te', label: 'Telugu' },
  { id: 'kn', label: 'Kannada' },
  { id: 'bn', label: 'Bengali' },
  { id: 'pa', label: 'Punjabi' },
  { id: 'en', label: 'English' },
]

const field =
  'mt-1 w-full rounded-xl border-2 border-line bg-card px-3.5 py-2.5 text-lg focus:border-genda focus:outline-none'

export function SetupForm({ initial }: { initial: Wedding | null }) {
  const router = useRouter()
  const [functions, setFunctions] = useState<readonly FunctionName[]>(
    initial?.functions ?? ['haldi', 'mehendi', 'sangeet', 'shaadi'],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: FunctionName) =>
    setFunctions((cur) => (cur.includes(id) ? cur.filter((f) => f !== id) : [...cur, id]))

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const lakh = Number(form.get('budgetLakh'))
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/wedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupleA: form.get('coupleA'),
          coupleB: form.get('coupleB'),
          city: form.get('city'),
          locality: form.get('locality'),
          date: form.get('date'),
          guests: Number(form.get('guests')),
          totalBudget: Math.round(lakh * 1_00_000),
          functions,
          language: form.get('language'),
        }),
      })
      const body = (await res.json()) as ApiResponse<Wedding>
      if (!body.ok) throw new Error(body.error)
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1 font-semibold">The couple</legend>
        <label className="text-muted">
          Bride
          <input name="coupleA" required maxLength={40} defaultValue={initial?.coupleA ?? ''} placeholder="Riya" className={field} />
        </label>
        <label className="text-muted">
          Groom
          <input name="coupleB" required maxLength={40} defaultValue={initial?.coupleB ?? ''} placeholder="Arjun" className={field} />
        </label>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="font-semibold">
          City
          <input name="city" required defaultValue={initial?.city ?? ''} placeholder="Nagpur" className={field} />
        </label>
        <label className="font-semibold">
          Area
          <input name="locality" defaultValue={initial?.locality ?? ''} placeholder="Dharampeth" className={field} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="font-semibold">
          Shaadi date
          <input name="date" type="date" required defaultValue={initial?.date ?? ''} className={field} />
        </label>
        <label className="font-semibold">
          Guests
          <input
            name="guests"
            type="number"
            inputMode="numeric"
            min={10}
            max={10000}
            required
            defaultValue={initial?.guests ?? 300}
            className={field}
          />
        </label>
      </div>

      <label className="block font-semibold">
        Total budget, in lakh
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 mt-0.5 -translate-y-1/2 text-lg text-muted">₹</span>
          <input
            name="budgetLakh"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={1}
            required
            defaultValue={initial ? initial.totalBudget / 1_00_000 : 25}
            className={`${field} pl-8`}
          />
        </div>
        <span className="text-sm font-normal text-muted">Milan splits it across venue, food, decor and the rest.</span>
      </label>

      <fieldset>
        <legend className="font-semibold">Functions</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FUNCTIONS.map((f) => {
            const on = functions.includes(f.id)
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(f.id)}
                className={`rounded-full border-2 px-4 py-1.5 text-[1rem] ${
                  on ? 'border-genda bg-genda text-white' : 'border-line bg-card text-ink'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="block font-semibold">
        Language for vendor calls
        <select name="language" defaultValue={initial?.language ?? 'hi'} className={field}>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <p role="alert" className="min-h-5 text-rani">
        {error}
      </p>
      <button
        type="submit"
        disabled={busy || functions.length === 0}
        className="w-full rounded-full bg-sindoor py-3.5 text-lg font-semibold text-paper shadow-[0_6px_0_#5e0f1c] active:translate-y-1 active:shadow-[0_2px_0_#5e0f1c] disabled:opacity-50"
      >
        {busy ? 'Saving…' : initial ? 'Save details' : 'Start planning'}
      </button>
    </form>
  )
}
