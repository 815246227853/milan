/** Vendor categories Milan can call, with what to ask and how they price. */

export type CategoryId =
  | 'venue'
  | 'catering'
  | 'decor'
  | 'photography'
  | 'mehendi'
  | 'makeup'
  | 'music'
  | 'pandit'

/** How a vendor quotes: per plate (multiplied by guests) or one price for the whole event. */
export type PriceUnit = 'plate' | 'event'

export interface Category {
  readonly id: CategoryId
  readonly label: string
  readonly hindi: string
  readonly unit: PriceUnit
  /** What Google Maps should search for, e.g. "banquet hall". */
  readonly searchTerm: string
  /** Words in a request that point to this category. */
  readonly keywords: readonly string[]
  /** Share of the total wedding budget suggested for this category. */
  readonly budgetShare: number
  /** What Milan asks every vendor in this category, in plain words. */
  readonly questions: readonly string[]
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'venue',
    label: 'Venue',
    hindi: 'शादी हॉल',
    unit: 'event',
    searchTerm: 'banquet hall wedding venue',
    keywords: ['venue', 'hall', 'banquet', 'lawn', 'resort', 'farmhouse', 'mandap', 'jagah'],
    budgetShare: 0.3,
    questions: [
      'Is the date free?',
      'What is the rent for the day?',
      'How many guests can it hold?',
      'Is catering in-house or can we bring our own?',
      'How much advance to book?',
    ],
  },
  {
    id: 'catering',
    label: 'Catering',
    hindi: 'खाना',
    unit: 'plate',
    searchTerm: 'wedding caterers',
    keywords: ['cater', 'food', 'khana', 'plate', 'thali', 'halwai', 'buffet', 'veg', 'non-veg'],
    budgetShare: 0.3,
    questions: [
      'Is the date free?',
      'What is the price per plate?',
      'What is included in the menu?',
      'How much advance to book?',
    ],
  },
  {
    id: 'decor',
    label: 'Decor',
    hindi: 'सजावट',
    unit: 'event',
    searchTerm: 'wedding decorators',
    keywords: ['decor', 'decoration', 'sajawat', 'flower', 'phool', 'mandap decor', 'stage', 'lighting'],
    budgetShare: 0.12,
    questions: [
      'Is the date free?',
      'What does a full mandap and stage setup cost?',
      'What is included: flowers, lights, entry?',
      'How much advance to book?',
    ],
  },
  {
    id: 'photography',
    label: 'Photography',
    hindi: 'फ़ोटो',
    unit: 'event',
    searchTerm: 'wedding photographer',
    keywords: ['photo', 'photographer', 'video', 'videographer', 'shoot', 'album', 'pre-wedding'],
    budgetShare: 0.1,
    questions: [
      'Is the date free?',
      'What is the package price?',
      'What is included: video, album, drone?',
      'How much advance to book?',
    ],
  },
  {
    id: 'mehendi',
    label: 'Mehendi',
    hindi: 'मेहंदी',
    unit: 'event',
    searchTerm: 'mehendi artist',
    keywords: ['mehendi', 'mehndi', 'henna'],
    budgetShare: 0.03,
    questions: [
      'Is the date free?',
      'What is the price for the bride, and for guests?',
      'How many artists will come?',
      'How much advance to book?',
    ],
  },
  {
    id: 'makeup',
    label: 'Makeup',
    hindi: 'मेकअप',
    unit: 'event',
    searchTerm: 'bridal makeup artist',
    keywords: ['makeup', 'make-up', 'mua', 'bridal look', 'hair'],
    budgetShare: 0.04,
    questions: [
      'Is the date free?',
      'What is the bridal package price?',
      'Is hair and draping included?',
      'How much advance to book?',
    ],
  },
  {
    id: 'music',
    label: 'DJ & Band',
    hindi: 'बैंड बाजा',
    unit: 'event',
    searchTerm: 'wedding dj band baja',
    keywords: ['dj', 'band', 'baja', 'dhol', 'music', 'sangeet', 'baraat', 'shehnai'],
    budgetShare: 0.05,
    questions: [
      'Is the date free?',
      'What is the price for the event?',
      'How many hours, and is sound and lighting included?',
      'How much advance to book?',
    ],
  },
  {
    id: 'pandit',
    label: 'Pandit',
    hindi: 'पंडित जी',
    unit: 'event',
    searchTerm: 'pandit for wedding',
    keywords: ['pandit', 'priest', 'pujari', 'puja', 'pooja', 'vivah', 'pheras'],
    budgetShare: 0.02,
    questions: [
      'Is the date and muhurat free?',
      'What is the dakshina?',
      'Is the samagri included?',
    ],
  },
]

export function getCategory(id: CategoryId): Category {
  const found = CATEGORIES.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown category: ${id}`)
  return found
}

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value)
}
