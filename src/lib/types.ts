import type { CategoryId, PriceUnit } from './categories'

export type FunctionName = 'haldi' | 'mehendi' | 'sangeet' | 'shaadi' | 'reception'

export interface Wedding {
  readonly id: string
  readonly coupleA: string
  readonly coupleB: string
  readonly city: string
  readonly locality: string
  readonly date: string // YYYY-MM-DD
  readonly guests: number
  readonly totalBudget: number
  readonly functions: readonly FunctionName[]
  readonly language: string // call language code, e.g. "hi"
}

/** Job lifecycle: shortlist ready → calling → compared (needs you) → booked. */
export type JobStatus = 'shortlist' | 'calling' | 'compared' | 'booked' | 'failed'

export interface JobBrief {
  readonly category: CategoryId
  readonly area: string
  readonly guests: number
  readonly date: string
  /** Budget for this job: per plate for catering, total otherwise. */
  readonly budget: number
  readonly budgetUnit: PriceUnit
  readonly preferences: string
}

export interface Job {
  readonly id: string
  readonly weddingId: string
  readonly request: string
  readonly brief: JobBrief
  readonly status: JobStatus
  readonly recommendation: string | null
  readonly bookedVendorId: string | null
  readonly createdAt: string
}

export type VendorSource = 'google' | 'sample'
export type VendorStatus = 'shortlisted' | 'quoted' | 'no_answer' | 'booked' | 'dropped'

export interface Vendor {
  readonly id: string
  readonly jobId: string
  readonly name: string
  readonly category: CategoryId
  readonly phone: string
  readonly address: string
  readonly rating: number | null
  readonly reviews: number | null
  readonly mapsUrl: string | null
  readonly source: VendorSource
  readonly status: VendorStatus
}

export type CallStatus = 'queued' | 'ringing' | 'live' | 'done' | 'no_answer' | 'failed'
export type CallPurpose = 'enquiry' | 'confirm'

export interface TranscriptLine {
  readonly speaker: 'milan' | 'vendor'
  readonly text: string
}

export interface Call {
  readonly id: string
  readonly jobId: string
  readonly vendorId: string
  readonly purpose: CallPurpose
  readonly dialedNumber: string
  readonly executionId: string | null
  readonly status: CallStatus
  readonly transcript: readonly TranscriptLine[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface Quote {
  readonly vendorId: string
  readonly available: boolean | null
  readonly price: number | null
  readonly unit: PriceUnit
  readonly includes: string
  readonly advance: string
  readonly notes: string
}

export interface Activity {
  readonly id: number
  readonly jobId: string | null
  readonly text: string
  readonly at: string
}

export interface Booking {
  readonly jobId: string
  readonly vendorId: string
  readonly vendorName: string
  readonly category: CategoryId
  readonly amount: number
  readonly at: string
}
