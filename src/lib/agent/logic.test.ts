import { describe, expect, it } from 'vitest'
import { parseAmount, rupees, shortRupees } from '../money'
import type { JobBrief, Quote, Vendor, Wedding } from '../types'
import { parseTranscript, toCallStatus } from './bolna'
import { compareQuotes, recommend } from './compare'
import { parseRequestByRules, UnclearRequestError } from './parse'
import { simulatedCall } from './simulate'

const wedding: Wedding = {
  id: 'w1', coupleA: 'Riya', coupleB: 'Arjun', city: 'Nagpur', locality: 'Dharampeth',
  date: '2026-12-12', guests: 300, totalBudget: 25_00_000, functions: ['shaadi'], language: 'hi',
}

describe('money', () => {
  it('reads Indian amounts', () => {
    expect(parseAmount('5 lakh')).toBe(500_000)
    expect(parseAmount('₹1,200')).toBe(1200)
    expect(parseAmount('2.5 lac')).toBe(250_000)
    expect(parseAmount('80k')).toBe(80_000)
  })
  it('formats in lakh style', () => {
    expect(rupees(237500)).toBe('₹2,37,500')
    expect(shortRupees(250_000)).toBe('₹2.5 lakh')
  })
})

describe('parseRequestByRules', () => {
  it('reads a catering request with a per-plate budget', () => {
    const b = parseRequestByRules('Find a veg caterer in Sadar for 250 guests within ₹1,000 per plate', wedding)
    expect(b).toMatchObject({ category: 'catering', area: 'Sadar', guests: 250, budget: 1000, budgetUnit: 'plate' })
    expect(b.preferences).toContain('veg')
  })
  it('reads a venue request with a lakh budget and defaults the area', () => {
    const b = parseRequestByRules('top banquet halls under 5 lakh', wedding)
    expect(b).toMatchObject({ category: 'venue', area: 'Dharampeth', guests: 300, budget: 500_000, budgetUnit: 'event' })
  })
  it('splits a total catering budget across guests', () => {
    expect(parseRequestByRules('caterer for 300 guests, budget 3 lakh', wedding).budget).toBe(1000)
  })
  it('asks for a category when it cannot tell', () => {
    expect(() => parseRequestByRules('help me please', wedding)).toThrow(UnclearRequestError)
  })
})

const brief: JobBrief = { category: 'catering', area: 'Sadar', guests: 250, date: '2026-12-12', budget: 1000, budgetUnit: 'plate', preferences: '' }
const vendor = (id: string, rating = 4.5): Vendor => ({
  id, jobId: 'j', name: id, category: 'catering', phone: '', address: '', rating, reviews: 10, mapsUrl: null, source: 'sample', status: 'quoted',
})
const quote = (vendorId: string, price: number | null, available: boolean | null = true): Quote => ({
  vendorId, available, price, unit: 'plate', includes: '', advance: '', notes: '',
})

describe('compareQuotes', () => {
  it('puts in-budget, cheapest, available vendors first and drops the booked ones', () => {
    const out = compareQuotes(brief, [vendor('a'), vendor('b'), vendor('c'), vendor('d')], [
      quote('a', 1200), quote('b', 980), quote('c', 950), quote('d', 900, false),
    ])
    expect(out.map((o) => o.vendor.id)).toEqual(['c', 'b', 'a'])
    expect(out[0].total).toBe(237_500)
    expect(out[2].overBudgetBy).toBe(50_000)
    expect(recommend(brief, out, 3)).toContain('c: ₹950 a plate')
  })
})

describe('bolna helpers', () => {
  it('maps statuses and transcripts', () => {
    expect(toCallStatus('in-progress')).toBe('live')
    expect(toCallStatus('no-answer')).toBe('no_answer')
    expect(parseTranscript('assistant: Namaste\nuser: Haan ji\n')).toEqual([
      { speaker: 'milan', text: 'Namaste' }, { speaker: 'vendor', text: 'Haan ji' },
    ])
  })
})

describe('simulatedCall', () => {
  it('rings, talks, then finishes', () => {
    const v = vendor('11111111-1111-1111-1111-111111111111')
    expect(simulatedCall(v, brief, wedding, 0).status).toBe('ringing')
    const end = simulatedCall(v, brief, wedding, 60_000)
    expect(['done', 'no_answer']).toContain(end.status)
  })
})

describe('extractQuoteByRules', () => {
  it('reads Devanagari answers from a real call', async () => {
    const { extractQuoteByRules } = await import('./extract')
    const q = extractQuoteByRules('v', 'catering', [
      { speaker: 'vendor', text: 'हाँ फ्री है।' },
      { speaker: 'vendor', text: '250 है।' },
      { speaker: 'vendor', text: 'आधा-आधा एडवांस है।' },
    ])
    expect(q).toMatchObject({ available: true, price: 250, advance: '50% advance' })
  })
})
