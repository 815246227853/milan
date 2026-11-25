import { z } from 'zod'
import { getCategory, type CategoryId } from '../categories'
import { parseAmount } from '../money'
import type { Quote, TranscriptLine } from '../types'
import { askJson, llmAvailable } from './llm'

const llmQuote = z.object({
  available: z.boolean().nullable(),
  price: z.number().nullable(),
  includes: z.string().nullable(),
  advance: z.string().nullable(),
  notes: z.string().nullable(),
})

const asText = (lines: readonly TranscriptLine[]): string =>
  lines.map((l) => `${l.speaker === 'milan' ? 'Milan' : 'Vendor'}: ${l.text}`).join('\n')

/** Last-resort reading when there is no LLM: the first amount the vendor said, and yes/no on the date. */
export function extractQuoteByRules(vendorId: string, category: CategoryId, lines: readonly TranscriptLine[]): Quote {
  const vendorText = lines
    .filter((l) => l.speaker === 'vendor')
    .map((l) => l.text)
    .join(' ')
  const amounts = [...vendorText.matchAll(/₹?\s*(\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|k\b|hazaa?r)?)/gi)]
    .map((m) => parseAmount(m[1]))
    .filter((n): n is number => n !== null && n >= 100)
  const lower = vendorText.toLowerCase()
  // Sarvam transcribes Hindi in Devanagari, so match both scripts.
  const no = /(not free|booked|nahi hai|available nahi|khaali nahi|फ्री नहीं|बुक है|बुक्ड|खाली नहीं)/.test(lower)
  const yes = /(free hai|available|khaali hai|ho jayega|haan|yes|फ्री है|खाली है|हो जाएगा|हाँ|हां)/.test(lower)
  const advance = vendorText.match(/(\d{1,2})\s*(?:%|percent|प्रतिशत|परसेंट)/i)?.[1]
  const half = /(aadha|आधा)/i.test(vendorText)
  return {
    vendorId,
    available: no ? false : yes ? true : null,
    price: amounts.at(-1) ?? null, // vendors correct themselves ("50… nahi, 250"), so the last figure wins
    unit: getCategory(category).unit,
    includes: '',
    advance: advance ? `${advance}% advance` : half ? '50% advance' : '',
    notes: amounts.length === 0 ? 'No price said on the call.' : '',
  }
}

/** Turns a finished call into a structured quote. Prefers the LLM, falls back to rules. */
export async function extractQuote(
  vendorId: string,
  category: CategoryId,
  lines: readonly TranscriptLine[],
): Promise<Quote> {
  if (!llmAvailable() || lines.length === 0) return extractQuoteByRules(vendorId, category, lines)
  const c = getCategory(category)
  const system = [
    `You read a phone call between Milan (an AI assistant for a wedding family) and a ${c.label.toLowerCase()} vendor in India.`,
    'The call may be in Hindi, Hinglish or another Indian language. Numbers may be spoken ("pandrah sau" = 1500, "dhai lakh" = 250000).',
    `Return JSON: {"available": true/false/null (is the wedding date free), "price": number in rupees or null (${
      c.unit === 'plate' ? 'per plate' : 'total for the event'
    }; if they gave a range use the lower end), "includes": short English list or null, "advance": short English, e.g. "30% advance" or null, "notes": one short English sentence on anything else the family should know, or null}.`,
  ].join('\n')
  try {
    const out = llmQuote.parse(await askJson(system, asText(lines)))
    return {
      vendorId,
      available: out.available,
      price: out.price,
      unit: c.unit,
      includes: out.includes ?? '',
      advance: out.advance ?? '',
      notes: out.notes ?? '',
    }
  } catch (err) {
    console.error('[extract] LLM quote failed, using rules:', err instanceof Error ? err.message : err)
    return extractQuoteByRules(vendorId, category, lines)
  }
}
