import type { CategoryId } from '../categories'

/**
 * Sample vendors used when there is no Google Places key. Names are made up; phone numbers are
 * placeholders that never get dialled (demo mode routes calls to DEMO_PHONE_NUMBERS).
 */
const NAMES: Record<CategoryId, readonly string[]> = {
  venue: ['Shubh Vivah Lawns', 'Royal Orchid Banquets', 'Rangoli Gardens', 'Kesar Palace Hall', 'Mangalam Celebration Centre'],
  catering: ['Sharma Caterers', 'Annapurna Foods', 'Gupta Halwai & Sons', 'Rasoi Royale', 'Saffron Feast Caterers'],
  decor: ['Phoolwala Decor', 'Genda Phool Events', 'Mandap Kraft', 'Rajwada Decorators', 'Roshni Lights & Tent'],
  photography: ['Click Shaadi Studio', 'Pheras & Frames', 'Candid Kahani', 'Saat Phere Films', 'Dulhan Diaries'],
  mehendi: ['Heena by Sapna', 'Rang Mehendi Arts', 'Mehendi Mahal', 'Shagun Heena Studio', 'Bel Boota Mehendi'],
  makeup: ['Glow by Kavya', 'Dulhan Studio', 'Shringaar Bridal Lounge', 'Rupali Makeovers', 'Solah Shringar Studio'],
  music: ['Shehnai Brass Band', 'DJ Baraati Beats', 'Dhol Tasha Pathak', 'Sangeet Sound & Light', 'Jhankaar Band Baja'],
  pandit: ['Pandit Ramesh Shastri', 'Acharya Vinod Tiwari', 'Pandit Mohan Joshi', 'Shree Vedic Sanskar Kendra', 'Pandit Suresh Mishra'],
}

export interface SampleVendor {
  readonly name: string
  readonly phone: string
  readonly address: string
  readonly rating: number
  readonly reviews: number
}

export function sampleVendors(category: CategoryId, area: string, limit: number): SampleVendor[] {
  return NAMES[category].slice(0, limit).map((name, i) => ({
    name,
    phone: `+91 90000 ${String(10000 + i * 1111 + category.length * 7).slice(0, 5)}`,
    address: `${area}`,
    rating: [4.6, 4.4, 4.7, 4.2, 4.5][i] ?? 4.3,
    reviews: [312, 128, 540, 76, 210][i] ?? 90,
  }))
}
