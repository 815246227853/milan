import { randomUUID } from 'node:crypto'
import { db } from './db'
import type {
  Activity,
  Booking,
  Call,
  CallPurpose,
  CallStatus,
  Job,
  JobBrief,
  JobStatus,
  Quote,
  TranscriptLine,
  Vendor,
  VendorStatus,
  Wedding,
} from './types'

type Row = Record<string, unknown>

const str = (v: unknown): string => String(v ?? '')
const parse = <T>(v: unknown): T => JSON.parse(str(v)) as T
const now = (): string => new Date().toISOString()

// ---------- weddings (one per install for the hackathon) ----------

export function getWedding(): Wedding | null {
  const row = db().prepare('select data from weddings order by created_at limit 1').get() as Row | undefined
  return row ? parse<Wedding>(row.data) : null
}

export function saveWedding(input: Omit<Wedding, 'id'>): Wedding {
  const existing = getWedding()
  const wedding: Wedding = { ...input, id: existing?.id ?? randomUUID() }
  db()
    .prepare('insert into weddings (id, data) values (?, ?) on conflict(id) do update set data = excluded.data')
    .run(wedding.id, JSON.stringify(wedding))
  return wedding
}

// ---------- jobs ----------

function toJob(row: Row): Job {
  return {
    id: str(row.id),
    weddingId: str(row.wedding_id),
    request: str(row.request),
    brief: parse<JobBrief>(row.brief),
    status: str(row.status) as JobStatus,
    recommendation: row.recommendation == null ? null : str(row.recommendation),
    bookedVendorId: row.booked_vendor_id == null ? null : str(row.booked_vendor_id),
    createdAt: str(row.created_at),
  }
}

export function createJob(weddingId: string, request: string, brief: JobBrief): Job {
  const id = randomUUID()
  db()
    .prepare('insert into jobs (id, wedding_id, request, brief, status) values (?, ?, ?, ?, ?)')
    .run(id, weddingId, request, JSON.stringify(brief), 'shortlist')
  return getJob(id)!
}

export function getJob(id: string): Job | null {
  const row = db().prepare('select * from jobs where id = ?').get(id) as Row | undefined
  return row ? toJob(row) : null
}

export function listJobs(weddingId: string): Job[] {
  const rows = db().prepare('select * from jobs where wedding_id = ? order by created_at desc').all(weddingId) as Row[]
  return rows.map(toJob)
}

export function updateJob(
  id: string,
  patch: Partial<Pick<Job, 'status' | 'recommendation' | 'bookedVendorId'>>,
): Job {
  const current = getJob(id)
  if (!current) throw new Error(`Job ${id} not found`)
  const next = { ...current, ...patch }
  db()
    .prepare('update jobs set status = ?, recommendation = ?, booked_vendor_id = ? where id = ?')
    .run(next.status, next.recommendation, next.bookedVendorId, id)
  return next
}

// ---------- vendors ----------

function toVendor(row: Row): Vendor {
  return { ...parse<Omit<Vendor, 'status'>>(row.data), status: str(row.status) as VendorStatus }
}

export function addVendors(jobId: string, vendors: readonly Omit<Vendor, 'id' | 'jobId' | 'status'>[]): Vendor[] {
  const insert = db().prepare('insert into vendors (id, job_id, data, status) values (?, ?, ?, ?)')
  return vendors.map((v) => {
    const vendor: Vendor = { ...v, id: randomUUID(), jobId, status: 'shortlisted' }
    const { status, ...data } = vendor
    insert.run(vendor.id, jobId, JSON.stringify(data), status)
    return vendor
  })
}

export function listVendors(jobId: string): Vendor[] {
  const rows = db().prepare('select * from vendors where job_id = ? order by rowid').all(jobId) as Row[]
  return rows.map(toVendor)
}

export function getVendor(id: string): Vendor | null {
  const row = db().prepare('select * from vendors where id = ?').get(id) as Row | undefined
  return row ? toVendor(row) : null
}

export function setVendorStatus(id: string, status: VendorStatus): void {
  db().prepare('update vendors set status = ? where id = ?').run(status, id)
}

// ---------- calls ----------

function toCall(row: Row): Call {
  return {
    id: str(row.id),
    jobId: str(row.job_id),
    vendorId: str(row.vendor_id),
    purpose: str(row.purpose) as CallPurpose,
    dialedNumber: str(row.dialed_number),
    executionId: row.execution_id == null ? null : str(row.execution_id),
    status: str(row.status) as CallStatus,
    transcript: parse<TranscriptLine[]>(row.transcript),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function createCall(input: Pick<Call, 'jobId' | 'vendorId' | 'purpose' | 'dialedNumber'>): Call {
  const id = randomUUID()
  const at = now()
  db()
    .prepare(
      'insert into calls (id, job_id, vendor_id, purpose, dialed_number, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, input.jobId, input.vendorId, input.purpose, input.dialedNumber, 'queued', at, at)
  return getCall(id)!
}

export function getCall(id: string): Call | null {
  const row = db().prepare('select * from calls where id = ?').get(id) as Row | undefined
  return row ? toCall(row) : null
}

export function listCalls(jobId: string): Call[] {
  const rows = db().prepare('select * from calls where job_id = ? order by created_at').all(jobId) as Row[]
  return rows.map(toCall)
}

export function updateCall(
  id: string,
  patch: Partial<Pick<Call, 'status' | 'executionId' | 'transcript'>>,
): Call {
  const current = getCall(id)
  if (!current) throw new Error(`Call ${id} not found`)
  const next = { ...current, ...patch, updatedAt: now() }
  db()
    .prepare('update calls set status = ?, execution_id = ?, transcript = ?, updated_at = ? where id = ?')
    .run(next.status, next.executionId, JSON.stringify(next.transcript), next.updatedAt, id)
  return next
}

// ---------- quotes ----------

export function saveQuote(quote: Quote): void {
  db()
    .prepare('insert into quotes (vendor_id, data) values (?, ?) on conflict(vendor_id) do update set data = excluded.data')
    .run(quote.vendorId, JSON.stringify(quote))
}

export function listQuotes(jobId: string): Quote[] {
  const rows = db()
    .prepare('select q.data from quotes q join vendors v on v.id = q.vendor_id where v.job_id = ?')
    .all(jobId) as Row[]
  return rows.map((r) => parse<Quote>(r.data))
}

// ---------- bookings ----------

export function saveBooking(booking: Booking): void {
  db()
    .prepare('insert into bookings (job_id, data) values (?, ?) on conflict(job_id) do update set data = excluded.data')
    .run(booking.jobId, JSON.stringify(booking))
}

export function listBookings(): Booking[] {
  const rows = db().prepare('select data from bookings').all() as Row[]
  return rows.map((r) => parse<Booking>(r.data))
}

// ---------- activity ----------

export function logActivity(text: string, jobId: string | null = null): void {
  db().prepare('insert into activity (job_id, text) values (?, ?)').run(jobId, text)
}

export function listActivity(limit = 20): Activity[] {
  const rows = db().prepare('select * from activity order by id desc limit ?').all(limit) as Row[]
  return rows.map((r) => ({
    id: Number(r.id),
    jobId: r.job_id == null ? null : str(r.job_id),
    text: str(r.text),
    at: str(r.at),
  }))
}
