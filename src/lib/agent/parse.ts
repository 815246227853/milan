import { z } from 'zod'
import { CATEGORIES, getCategory, isCategoryId, type CategoryId } from '../categories'
import { parseAmount } from '../money'
import type { JobBrief, Wedding } from '../types'
import { askJson, llmAvailable } from './llm'

/** Thrown when Milan can't tell what kind of vendor the family wants. */
export class UnclearRequestError extends Error {}

const PREFERENCE_WORDS = [
  'pure veg', 'veg', 'non-veg', 'jain', 'no onion no garlic', 'ac', 'parking', 'lawn', 'outdoor',
  'indoor', 'rooms', 'live counter', 'south indian', 'punjabi', 'gujarati', 'marwari', 'bengali',
  'maharashtrian', 'drone', 'candid', 'dhol', 'shehnai', 'organic',
]

function findCategory(text: string): CategoryId | null {
  const lower = text.toLowerCase()
  let best: { id: CategoryId; at: number } | null = null
  for (const c of CATEGORIES) {
    for (const k of c.keywords) {
      const at = lower.search(new RegExp(`\\b${k}`))
      if (at >= 0 && (!best || at < best.at)) best = { id: c.id, at }
    }
  }
  return best?.id ?? null
}

function findArea(text: string): string | null {
  const m = text.match(/\b(?:in|near|around|at|mein)\s+([A-Za-z][A-Za-z .'-]{2,40}?)(?=\s+(?:for|under|within|below|with|budget|on|by|and)\b|[,.!?]|$)/i)
  return m ? m[1].trim() : null
}

function findGuests(text: string): number | null {
  const m = text.match(/(\d{2,5})\s*(?:guests?|people|pax|log|logon|mehmaan|persons?|plates?\b(?!\s*price))/i)
  return m ? Number(m[1]) : null
}

function findBudget(text: string): { amount: number; perPlate: boolean } | null {
  const m = text.match(
    /(?:under|within|below|upto|up to|max(?:imum)?|budget(?: of| is)?|around|tak|₹|rs\.?|inr)\s*₹?\s*(\d[\d,.]*\s*(?:crore|cr|lakhs?|lacs?|l\b|k\b|thousand|hazaa?r)?)/i,
  )
  if (!m) return null
  const amount = parseAmount(m[1])
  if (!amount) return null
  const tail = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 20)
  return { amount, perPlate: /per\s*plate|\/\s*plate|a plate|plate/i.test(tail) }
}

function findPreferences(text: string): string {
  const lower = ` ${text.toLowerCase()} `
  const found = PREFERENCE_WORDS.filter((w) => lower.includes(` ${w} `) || lower.includes(` ${w},`))
  // "pure veg" already covers "veg".
  return found.filter((w) => !(w === 'veg' && found.includes('pure veg'))).join(', ')
}

/** Per-plate budget for catering (a total is split across guests), a total for everything else. */
function budgetFor(
  unit: 'plate' | 'event',
  budget: { amount: number; perPlate: boolean } | null,
  guests: number,
): number | null {
  if (!budget) return null
  if (unit === 'plate') {
    return budget.perPlate || budget.amount < 10_000 ? budget.amount : Math.round(budget.amount / Math.max(guests, 1))
  }
  return budget.perPlate ? null : budget.amount
}

/** Budget for a job when the family didn't name one: the category's share of the total. */
export function defaultBudget(category: CategoryId, wedding: Wedding): number {
  const c = getCategory(category)
  const share = wedding.totalBudget * c.budgetShare
  return c.unit === 'plate' ? Math.round(share / Math.max(wedding.guests, 1) / 50) * 50 : Math.round(share)
}

/** Rule-based reading of the request. Good enough for the common phrasings, and works offline. */
export function parseRequestByRules(request: string, wedding: Wedding): JobBrief {
  const category = findCategory(request)
  if (!category) {
    throw new UnclearRequestError(
      'Tell Milan which vendor you need, for example a venue, caterer, decorator or photographer.',
    )
  }
  const unit = getCategory(category).unit
  const guests = findGuests(request) ?? wedding.guests
  return {
    category,
    area: findArea(request) ?? wedding.locality ?? wedding.city,
    guests,
    date: wedding.date,
    budget: budgetFor(unit, findBudget(request), guests) ?? defaultBudget(category, wedding),
    budgetUnit: unit,
    preferences: findPreferences(request),
  }
}

const llmBrief = z.object({
  category: z.string(),
  area: z.string().nullable(),
  guests: z.number().nullable(),
  budget: z.number().nullable(),
  preferences: z.string().nullable(),
})

/** Reads the request with the LLM when one is configured, and falls back to the rules. */
export async function parseRequest(request: string, wedding: Wedding): Promise<JobBrief> {
  const byRules = (() => {
    try {
      return parseRequestByRules(request, wedding)
    } catch {
      return null
    }
  })()
  if (!llmAvailable()) {
    if (!byRules) return parseRequestByRules(request, wedding) // throws the friendly error
    return byRules
  }
  const prompt = [
    'You read a request from an Indian family planning a wedding and fill in a brief for calling vendors.',
    `Categories: ${CATEGORIES.map((c) => `${c.id} (${c.label})`).join(', ')}.`,
    'Return JSON: {"category": one of the ids, or "unknown", "area": locality or null, "guests": number or null,',
    '"budget": number in rupees or null (per plate for catering, total for everything else; "5 lakh" = 500000),',
    '"preferences": short comma-separated list of wishes such as "pure veg, AC hall", or null}.',
    `Wedding defaults: city ${wedding.city}, locality ${wedding.locality}, ${wedding.guests} guests.`,
  ].join('\n')
  try {
    const out = llmBrief.parse(await askJson(prompt, request))
    if (!isCategoryId(out.category)) {
      if (byRules) return byRules
      throw new UnclearRequestError(
        'Tell Milan which vendor you need, for example a venue, caterer, decorator or photographer.',
      )
    }
    const unit = getCategory(out.category).unit
    return {
      category: out.category,
      area: out.area || wedding.locality || wedding.city,
      guests: out.guests || wedding.guests,
      date: wedding.date,
      budget: out.budget || defaultBudget(out.category, wedding),
      budgetUnit: unit,
      preferences: out.preferences ?? '',
    }
  } catch (err) {
    if (err instanceof UnclearRequestError) throw err
    console.error('[parse] LLM brief failed, using rules:', err instanceof Error ? err.message : err)
    if (byRules) return byRules
    return parseRequestByRules(request, wedding)
  }
}
