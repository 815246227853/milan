/** Indian number formatting: ₹2,37,500 and "₹2.4 lakh". */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function rupees(amount: number): string {
  return `₹${inr.format(Math.round(amount))}`
}

export function shortRupees(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${trim(amount / 1_00_00_000)} cr`
  if (amount >= 1_00_000) return `₹${trim(amount / 1_00_000)} lakh`
  if (amount >= 1_000) return `₹${trim(amount / 1_000)}k`
  return rupees(amount)
}

function trim(n: number): string {
  return n.toFixed(n >= 10 ? 0 : 1).replace(/\.0$/, '')
}

/**
 * Reads an amount written the way people in India write it:
 * "1000", "₹1,200", "5 lakh", "5L", "2.5 lac", "80k", "1 crore".
 */
export function parseAmount(text: string): number | null {
  const m = text
    .toLowerCase()
    .replace(/,/g, '')
    .match(/(\d+(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|l\b|k\b|thousand|hazaar|hazar)?/)
  if (!m) return null
  const value = Number(m[1])
  const unit = m[2] ?? ''
  if (unit.startsWith('cr')) return value * 1_00_00_000
  if (unit.startsWith('la') || unit === 'l') return value * 1_00_000
  if (unit === 'k' || unit === 'thousand' || unit.startsWith('haz')) return value * 1_000
  return value
}
