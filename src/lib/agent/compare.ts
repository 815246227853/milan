import { rupees, shortRupees } from '../money'
import type { JobBrief, Quote, Vendor } from '../types'

export interface ComparedOption {
  readonly vendor: Vendor
  readonly quote: Quote
  /** What the whole job costs with this vendor (per plate × guests for catering). */
  readonly total: number
  readonly budgetTotal: number
  readonly overBudgetBy: number
}

export function totalFor(price: number, brief: JobBrief): number {
  return brief.budgetUnit === 'plate' ? price * brief.guests : price
}

export function budgetTotal(brief: JobBrief): number {
  return totalFor(brief.budget, brief)
}

/** Vendors who are free on the date and gave a price, cheapest first. */
export function compareQuotes(brief: JobBrief, vendors: readonly Vendor[], quotes: readonly Quote[]): ComparedOption[] {
  const limit = budgetTotal(brief)
  return quotes
    .filter((q) => q.available !== false && q.price !== null)
    .map((quote) => {
      const vendor = vendors.find((v) => v.id === quote.vendorId)
      if (!vendor) return null
      const total = totalFor(quote.price!, brief)
      return { vendor, quote, total, budgetTotal: limit, overBudgetBy: Math.max(0, total - limit) }
    })
    .filter((o): o is ComparedOption => o !== null)
    .sort((a, b) => a.overBudgetBy - b.overBudgetBy || a.total - b.total || (b.vendor.rating ?? 0) - (a.vendor.rating ?? 0))
}

function priceText(o: ComparedOption, brief: JobBrief): string {
  return brief.budgetUnit === 'plate'
    ? `${rupees(o.quote.price!)} a plate (${shortRupees(o.total)} for ${brief.guests})`
    : rupees(o.total)
}

/** One plain sentence the family can act on. */
export function recommend(brief: JobBrief, options: readonly ComparedOption[], called: number): string {
  if (options.length === 0) {
    return called === 0
      ? 'No one picked up. Try again in a while or add more vendors.'
      : 'Nobody who answered is free on your date with a price. Try a nearby area or a different date.'
  }
  const best = options[0]
  const parts = [`${best.vendor.name}: ${priceText(best, brief)}`]
  if (best.quote.includes) parts.push(`includes ${best.quote.includes.toLowerCase()}`)
  const budgetNote =
    best.overBudgetBy > 0
      ? `${shortRupees(best.overBudgetBy)} over your budget`
      : `${shortRupees(best.budgetTotal - best.total)} under your budget`
  return `${parts.join(', ')}. ${budgetNote}.`
}
