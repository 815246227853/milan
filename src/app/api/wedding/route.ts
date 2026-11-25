import { z } from 'zod'
import { handle } from '@/lib/http'
import { getWedding, logActivity, saveWedding } from '@/lib/repo'

const weddingInput = z.object({
  coupleA: z.string().trim().min(1).max(40),
  coupleB: z.string().trim().min(1).max(40),
  city: z.string().trim().min(2).max(60),
  locality: z.string().trim().max(60).default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD'),
  guests: z.coerce.number().int().min(10).max(10_000),
  totalBudget: z.coerce.number().int().min(10_000).max(100_00_00_000),
  functions: z.array(z.enum(['haldi', 'mehendi', 'sangeet', 'shaadi', 'reception'])).min(1),
  language: z.enum(['hi', 'en', 'mr', 'gu', 'ta', 'te', 'kn', 'bn', 'pa']).default('hi'),
})

export async function GET() {
  return handle(async () => getWedding())
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = weddingInput.parse(await req.json())
    const isNew = getWedding() === null
    const wedding = saveWedding({ ...input, locality: input.locality || input.city })
    logActivity(isNew ? `Shaadi set up for ${wedding.coupleA} and ${wedding.coupleB}.` : 'Wedding details updated.')
    return wedding
  })
}
