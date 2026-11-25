import { getCategory } from '../categories'
import { callsAreSimulated, env } from '../env'
import { rupees } from '../money'
import * as repo from '../repo'
import { getRules } from '../rules'
import type { Call, CallPurpose, Job, Vendor, Wedding } from '../types'
import { getExecution, parseTranscript, placeCall, toCallStatus } from './bolna'
import { compareQuotes, recommend, totalFor, type ComparedOption } from './compare'
import { extractQuote } from './extract'
import { parseRequest } from './parse'
import { findVendors } from './places'
import { simulatedCall, simulatedQuote } from './simulate'

/** A user-facing problem: the message is shown as is. */
export class AgentError extends Error {}

const ACTIVE: ReadonlySet<Call['status']> = new Set(['ringing', 'live'])
const TERMINAL: ReadonlySet<Call['status']> = new Set(['done', 'no_answer', 'failed'])
const BOLNA_POLL_MS = 3_000
const SIM_PREFIX = 'sim:'

function requireWedding(): Wedding {
  const wedding = repo.getWedding()
  if (!wedding) throw new AgentError('Set up your wedding first.')
  return wedding
}

function requireJob(jobId: string): Job {
  const job = repo.getJob(jobId)
  if (!job) throw new AgentError('That job does not exist.')
  return job
}

// ---------- 1. request → shortlist ----------

export async function createJobFromRequest(request: string): Promise<Job> {
  const wedding = requireWedding()
  const brief = await parseRequest(request, wedding)
  const job = repo.createJob(wedding.id, request, brief)
  const { vendors, source } = await findVendors(brief.category, brief.area, wedding.city)
  repo.addVendors(job.id, vendors)
  const label = getCategory(brief.category).label.toLowerCase()
  repo.logActivity(
    `Found ${vendors.length} ${label} options near ${brief.area}${source === 'sample' ? ' (sample list)' : ' on Google Maps'}.`,
    job.id,
  )
  return job
}

// ---------- 2. shortlist → calls ----------

/** Which number to dial: in demo mode, a teammate's phone; otherwise the vendor's own. */
function numberToDial(vendor: Vendor, index: number): string {
  if (env.demoPhoneNumbers.length > 0) return env.demoPhoneNumbers[index % env.demoPhoneNumbers.length]
  if (vendor.source === 'sample' && !callsAreSimulated()) {
    throw new AgentError('Sample vendors have placeholder numbers. Add DEMO_PHONE_NUMBERS or a Google Places key.')
  }
  return vendor.phone
}

export async function startCalls(jobId: string, vendorIds: readonly string[]): Promise<void> {
  const rules = await getRules()
  if (!rules.callsEnabled) throw new AgentError('Calls are switched off right now.')
  const job = requireJob(jobId)
  const vendors = repo.listVendors(jobId)
  const chosen = vendors.filter((v) => vendorIds.includes(v.id))
  if (chosen.length === 0) throw new AgentError('Pick at least one vendor to call.')
  const alreadyCalled = new Set(repo.listCalls(jobId).filter((c) => c.purpose === 'enquiry').map((c) => c.vendorId))
  chosen
    .filter((v) => !alreadyCalled.has(v.id))
    .forEach((v) => {
      repo.createCall({ jobId, vendorId: v.id, purpose: 'enquiry', dialedNumber: numberToDial(v, vendors.indexOf(v)) })
    })
  vendors.filter((v) => !vendorIds.includes(v.id)).forEach((v) => repo.setVendorStatus(v.id, 'dropped'))
  repo.updateJob(job.id, { status: 'calling' })
  repo.logActivity(`Calling ${chosen.length} vendors.`, jobId)
  await dialQueued(jobId, rules.maxParallelCalls)
}

function callVariables(job: Job, vendor: Vendor, wedding: Wedding, purpose: CallPurpose): Record<string, string> {
  const c = getCategory(job.brief.category)
  const quote = repo.listQuotes(job.id).find((q) => q.vendorId === vendor.id)
  const date = new Date(job.brief.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    purpose,
    couple: `${wedding.coupleA} and ${wedding.coupleB}`,
    vendor_name: vendor.name,
    category: c.label,
    wedding_date: date,
    guests: String(job.brief.guests),
    area: `${job.brief.area}, ${wedding.city}`,
    preferences: job.brief.preferences || 'none',
    questions: c.questions.join(' '),
    agreed_price: quote?.price ? `${rupees(quote.price)}${c.unit === 'plate' ? ' per plate' : ''}` : '',
    language: wedding.language,
  }
}

async function dial(call: Call): Promise<void> {
  if (callsAreSimulated()) {
    repo.updateCall(call.id, { status: 'ringing', executionId: `${SIM_PREFIX}${Date.now()}` })
    return
  }
  const job = requireJob(call.jobId)
  const vendor = repo.getVendor(call.vendorId)!
  try {
    const executionId = await placeCall(call.dialedNumber, callVariables(job, vendor, requireWedding(), call.purpose))
    repo.updateCall(call.id, { status: 'ringing', executionId })
  } catch (err) {
    console.error('[runner] could not place call', { callId: call.id, err })
    repo.updateCall(call.id, { status: 'failed' })
    repo.logActivity(`Couldn't call ${vendor.name}: the phone line refused the call.`, call.jobId)
  }
}

async function dialQueued(jobId: string, maxParallel: number): Promise<void> {
  const calls = repo.listCalls(jobId)
  const free = maxParallel - calls.filter((c) => ACTIVE.has(c.status)).length
  const next = calls.filter((c) => c.status === 'queued' && c.executionId === null).slice(0, Math.max(0, free))
  await Promise.all(next.map(dial))
}

// ---------- 3. calls → quotes → recommendation ----------

async function refreshCall(call: Call, job: Job, wedding: Wedding): Promise<Call> {
  if (!call.executionId || TERMINAL.has(call.status)) return call
  const vendor = repo.getVendor(call.vendorId)!
  if (call.executionId.startsWith(SIM_PREFIX)) {
    const startedAt = Number(call.executionId.slice(SIM_PREFIX.length))
    const state = simulatedCall(vendor, job.brief, wedding, Date.now() - startedAt, call.purpose)
    return repo.updateCall(call.id, state)
  }
  if (Date.now() - Date.parse(call.updatedAt) < BOLNA_POLL_MS) return call
  try {
    const exec = await getExecution(call.executionId)
    const transcript = parseTranscript(exec.transcript)
    return repo.updateCall(call.id, {
      status: toCallStatus(exec.status),
      transcript: transcript.length > 0 ? transcript : call.transcript,
    })
  } catch (err) {
    console.error('[runner] could not read call status', { callId: call.id, err })
    return repo.updateCall(call.id, {}) // bumps updatedAt so we back off
  }
}

async function onCallFinished(call: Call, job: Job): Promise<void> {
  const vendor = repo.getVendor(call.vendorId)!
  if (call.purpose === 'confirm') {
    repo.logActivity(`${vendor.name} confirmed the booking on the phone.`, job.id)
    return
  }
  if (call.status !== 'done') {
    repo.setVendorStatus(vendor.id, 'no_answer')
    repo.logActivity(`${vendor.name} didn't pick up.`, job.id)
    return
  }
  const quote = call.executionId?.startsWith(SIM_PREFIX)
    ? simulatedQuote(vendor, job.brief)
    : await extractQuote(vendor.id, job.brief.category, call.transcript)
  repo.saveQuote(quote)
  repo.setVendorStatus(vendor.id, 'quoted')
  repo.logActivity(
    quote.available === false
      ? `${vendor.name} is booked on your date.`
      : `${vendor.name} quoted ${quote.price ? rupees(quote.price) : 'no price'}${quote.unit === 'plate' ? ' a plate' : ''}.`,
    job.id,
  )
}

function finishIfAllCalled(job: Job): void {
  const enquiries = repo.listCalls(job.id).filter((c) => c.purpose === 'enquiry')
  if (job.status !== 'calling' || enquiries.length === 0 || !enquiries.every((c) => TERMINAL.has(c.status))) return
  const options = compareQuotes(job.brief, repo.listVendors(job.id), repo.listQuotes(job.id))
  const answered = enquiries.filter((c) => c.status === 'done').length
  repo.updateJob(job.id, { status: 'compared', recommendation: recommend(job.brief, options, answered) })
  repo.logActivity(`Compared ${options.length} quotes. Your pick is waiting.`, job.id)
}

// Two browser tabs polling the same job must not process one call twice.
const refreshing = new Set<string>()

export async function refreshJob(jobId: string): Promise<void> {
  if (refreshing.has(jobId)) return
  refreshing.add(jobId)
  try {
    const job = requireJob(jobId)
    const wedding = requireWedding()
    for (const call of repo.listCalls(jobId)) {
      const before = call.status
      const after = await refreshCall(call, job, wedding)
      if (!TERMINAL.has(before) && TERMINAL.has(after.status)) await onCallFinished(after, job)
    }
    const rules = await getRules()
    if (rules.callsEnabled) await dialQueued(jobId, rules.maxParallelCalls)
    finishIfAllCalled(requireJob(jobId))
  } finally {
    refreshing.delete(jobId)
  }
}

// ---------- 4. booking ----------

export type BookResult =
  | { readonly status: 'booked' }
  | { readonly status: 'needs_approval'; readonly overBy: number }

export async function bookVendor(jobId: string, vendorId: string, approvedOverBudget: boolean): Promise<BookResult> {
  const job = requireJob(jobId)
  if (job.status === 'booked') throw new AgentError('This job is already booked.')
  const option = jobOptions(job).find((o) => o.vendor.id === vendorId)
  if (!option) throw new AgentError('That vendor has no quote to book.')
  const rules = await getRules()
  if (option.overBudgetBy > 0 && rules.approvalOverBudget && !approvedOverBudget) {
    return { status: 'needs_approval', overBy: option.overBudgetBy }
  }
  repo.updateJob(jobId, { status: 'booked', bookedVendorId: vendorId })
  repo.setVendorStatus(vendorId, 'booked')
  repo.saveBooking({
    jobId,
    vendorId,
    vendorName: option.vendor.name,
    category: job.brief.category,
    amount: option.total,
    at: new Date().toISOString(),
  })
  repo.logActivity(`Booked ${option.vendor.name} for ${rupees(option.total)}. Calling them to confirm.`, jobId)
  const vendors = repo.listVendors(jobId)
  const call = repo.createCall({
    jobId,
    vendorId,
    purpose: 'confirm',
    dialedNumber: numberToDial(option.vendor, vendors.findIndex((v) => v.id === vendorId)),
  })
  if (rules.callsEnabled) await dial(call)
  return { status: 'booked' }
}

// ---------- read model ----------

export function jobOptions(job: Job): ComparedOption[] {
  return compareQuotes(job.brief, repo.listVendors(job.id), repo.listQuotes(job.id))
}

export function jobView(jobId: string) {
  const job = requireJob(jobId)
  const vendors = repo.listVendors(jobId)
  return {
    job,
    vendors,
    calls: repo.listCalls(jobId),
    quotes: repo.listQuotes(jobId),
    options: jobOptions(job),
    budgetTotal: totalFor(job.brief.budget, job.brief),
    simulated: callsAreSimulated(),
    demoRouting: env.demoPhoneNumbers.length > 0,
  }
}

export type JobView = ReturnType<typeof jobView>
