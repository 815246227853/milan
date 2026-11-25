import { getCategory } from '../categories'
import { rupees } from '../money'
import type { CallPurpose, CallStatus, JobBrief, Quote, TranscriptLine, Vendor, Wedding } from '../types'

/**
 * Simulated vendor calls, used when Bolna isn't configured, so the whole flow can be tried
 * without a phone. Every vendor gets a stable persona from its id.
 */

const RING_MS = 3_000
const LINE_MS = 1_800

const INCLUDES: Record<string, readonly string[]> = {
  venue: ['AC hall, parking for 100 cars, 2 rooms', 'Lawn and hall, generator backup', 'Hall with stage, bridal room'],
  catering: ['Live chaat counter, 2 sweets', 'Welcome drink, 4 sabzi, dessert', 'Thali service, jalebi counter'],
  decor: ['Mandap, stage, entry gate', 'Fresh marigold and rose, fairy lights', 'Stage, mandap, 20 centrepieces'],
  photography: ['Candid + traditional, 1 album', 'Photo + video, drone, teaser', 'Two shooters, 300 edited photos'],
  mehendi: ['Bride full hands and feet, 3 artists for guests', 'Bridal design, 2 artists'],
  makeup: ['HD makeup, hair, draping', 'Airbrush makeup, hair styling'],
  music: ['5 hours, sound and lights', 'Baraat band with dhol, ghodi arranged'],
  pandit: ['Samagri included', 'Samagri extra'],
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export interface Persona {
  readonly answers: boolean
  readonly available: boolean
  readonly price: number
  readonly includes: string
  readonly advancePct: number
}

export function personaFor(vendor: Vendor, brief: JobBrief): Persona {
  const h = hash(vendor.id + vendor.name)
  const factor = 0.78 + ((h % 1000) / 1000) * 0.5 // 0.78x – 1.28x of budget
  const raw = brief.budget * factor
  const step = brief.budgetUnit === 'plate' ? 10 : 5_000
  const options = INCLUDES[brief.category] ?? ['Standard package']
  return {
    answers: h % 9 !== 0,
    available: h % 5 !== 0,
    price: Math.max(step, Math.round(raw / step) * step),
    includes: options[h % options.length],
    advancePct: [20, 25, 30, 40][h % 4],
  }
}

function confirmScript(brief: JobBrief, wedding: Wedding, p: Persona): TranscriptLine[] {
  const date = new Date(brief.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
  const price = brief.budgetUnit === 'plate' ? `${rupees(p.price)} per plate` : rupees(p.price)
  return [
    {
      speaker: 'milan',
      text: `Namaste ji, Milan bol rahi hoon. ${wedding.coupleA} aur ${wedding.coupleB} ki family ne aapko ${date} ke liye final kar diya hai, ${price} par.`,
    },
    { speaker: 'vendor', text: 'Arre wah, bahut badhiya! Booking pakki samjhiye.' },
    { speaker: 'milan', text: 'Advance ki details family aapko WhatsApp par bhej degi. Dhanyavaad ji!' },
  ]
}

function script(vendor: Vendor, brief: JobBrief, wedding: Wedding, p: Persona): TranscriptLine[] {
  const c = getCategory(brief.category)
  const date = new Date(brief.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
  const price = brief.budgetUnit === 'plate' ? `${rupees(p.price)} per plate` : rupees(p.price)
  const lines: TranscriptLine[] = [
    {
      speaker: 'milan',
      text: `Namaste ji, main Milan bol rahi hoon, ${wedding.coupleA} aur ${wedding.coupleB} ki shaadi ke liye AI assistant. ${date} ko ${brief.guests} mehmaanon ke liye ${c.label.toLowerCase()} ke baare mein poochna tha. Kya aap us din free hain?`,
    },
  ]
  if (!p.available) {
    return [
      ...lines,
      { speaker: 'vendor', text: `Nahi ji, ${date} ko toh hum already booked hain. Sorry.` },
      { speaker: 'milan', text: 'Koi baat nahi ji, dhanyavaad. Namaste!' },
    ]
  }
  return [
    ...lines,
    { speaker: 'vendor', text: `Haan ji, ${date} abhi free hai.` },
    { speaker: 'milan', text: `Bahut badhiya. ${brief.guests} logon ke liye kitna lagega?` },
    { speaker: 'vendor', text: `${price} lagega ji. ${p.includes} sab included hai.` },
    { speaker: 'milan', text: 'Aur booking ke liye advance kitna dena hoga?' },
    { speaker: 'vendor', text: `${p.advancePct} percent advance, baaki function ke din.` },
    { speaker: 'milan', text: 'Theek hai ji, main family se baat karke confirm karti hoon. Dhanyavaad!' },
  ]
}

export interface SimulatedState {
  readonly status: CallStatus
  readonly transcript: TranscriptLine[]
}

/** Where a simulated call is, `elapsedMs` after it was dialled. */
export function simulatedCall(
  vendor: Vendor,
  brief: JobBrief,
  wedding: Wedding,
  elapsedMs: number,
  purpose: CallPurpose = 'enquiry',
): SimulatedState {
  const p = personaFor(vendor, brief)
  if (elapsedMs < RING_MS) return { status: 'ringing', transcript: [] }
  if (purpose === 'confirm') {
    const all = confirmScript(brief, wedding, p)
    const shown = Math.floor((elapsedMs - RING_MS) / LINE_MS) + 1
    return shown < all.length ? { status: 'live', transcript: all.slice(0, shown) } : { status: 'done', transcript: all }
  }
  if (!p.answers) return { status: 'no_answer', transcript: [] }
  const all = script(vendor, brief, wedding, p)
  const shown = Math.floor((elapsedMs - RING_MS) / LINE_MS) + 1
  if (shown < all.length) return { status: 'live', transcript: all.slice(0, shown) }
  return { status: 'done', transcript: all }
}

export function simulatedQuote(vendor: Vendor, brief: JobBrief): Quote {
  const p = personaFor(vendor, brief)
  return {
    vendorId: vendor.id,
    available: p.available,
    price: p.available ? p.price : null,
    unit: brief.budgetUnit,
    includes: p.available ? p.includes : '',
    advance: p.available ? `${p.advancePct}% advance` : '',
    notes: p.available ? '' : 'Already booked on your date.',
  }
}
