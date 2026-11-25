import { z } from 'zod'
import { getCategory, type CategoryId } from '../categories'
import { env } from '../env'
import type { Vendor } from '../types'
import { sampleVendors } from './sampleVendors'

export type FoundVendor = Omit<Vendor, 'id' | 'jobId' | 'status'>

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
].join(',')

const placesResponse = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }).optional(),
        formattedAddress: z.string().optional(),
        internationalPhoneNumber: z.string().optional(),
        nationalPhoneNumber: z.string().optional(),
        rating: z.number().optional(),
        userRatingCount: z.number().optional(),
        googleMapsUri: z.string().optional(),
      }),
    )
    .optional(),
})

/** Ranks by rating weighted by how many people rated it, so 4.6 from 500 beats 5.0 from 3. */
export function placeScore(rating: number | null, reviews: number | null): number {
  const r = rating ?? 0
  const n = reviews ?? 0
  const prior = 4.0
  const weight = 25
  return (r * n + prior * weight) / (n + weight)
}

async function searchGoogle(category: CategoryId, area: string, city: string, limit: number): Promise<FoundVendor[]> {
  const query = `${getCategory(category).searchTerm} in ${area}, ${city}`
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.placesApiKey,
      'X-Goog-FieldMask': FIELDS,
    },
    body: JSON.stringify({ textQuery: query, regionCode: 'IN', languageCode: 'en', pageSize: 20 }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Places ${res.status}: ${body.slice(0, 200)}`)
  }
  const { places = [] } = placesResponse.parse(await res.json())
  return places
    .filter((p) => p.internationalPhoneNumber || p.nationalPhoneNumber) // can't call without a number
    .map(
      (p): FoundVendor => ({
        name: p.displayName?.text ?? 'Unnamed vendor',
        category,
        phone: (p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? '').replace(/[^\d+]/g, ''),
        address: p.formattedAddress ?? area,
        rating: p.rating ?? null,
        reviews: p.userRatingCount ?? null,
        mapsUrl: p.googleMapsUri ?? null,
        source: 'google',
      }),
    )
    .sort((a, b) => placeScore(b.rating, b.reviews) - placeScore(a.rating, a.reviews))
    .slice(0, limit)
}

/** Finds the top vendors near the area. Uses Google Maps when a key is set, sample vendors otherwise. */
export async function findVendors(
  category: CategoryId,
  area: string,
  city: string,
  limit = 4,
): Promise<{ vendors: FoundVendor[]; source: 'google' | 'sample' }> {
  if (env.placesApiKey) {
    try {
      const vendors = await searchGoogle(category, area, city, limit)
      if (vendors.length > 0) return { vendors, source: 'google' }
    } catch (err) {
      console.error('[places] search failed, using sample vendors', err)
    }
  }
  const vendors = sampleVendors(category, `${area}, ${city}`, limit).map(
    (s): FoundVendor => ({ ...s, category, mapsUrl: null, source: 'sample' }),
  )
  return { vendors, source: 'sample' }
}
