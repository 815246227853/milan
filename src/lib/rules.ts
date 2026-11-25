import { Flagsmith } from 'flagsmith-nodejs'
import { env } from './env'

/**
 * The rules Milan follows before every call and booking, from Flagsmith.
 * Without a Flagsmith key the defaults below apply, so the app never depends on it.
 */
export interface Rules {
  /** Kill switch: off stops new calls. */
  readonly callsEnabled: boolean
  /** Over-budget bookings need an explicit "book anyway" from the family. */
  readonly approvalOverBudget: boolean
  /** How many vendors Milan calls at once. */
  readonly maxParallelCalls: number
}

export const DEFAULT_RULES: Rules = { callsEnabled: true, approvalOverBudget: true, maxParallelCalls: 3 }

let client: Flagsmith | null = null

export async function getRules(): Promise<Rules> {
  if (!env.flagsmithKey) return DEFAULT_RULES
  try {
    client ??= new Flagsmith({ environmentKey: env.flagsmithKey, requestTimeoutSeconds: 3 })
    const flags = await client.getEnvironmentFlags()
    const parallel = Number(flags.getFeatureValue('max_parallel_calls'))
    return {
      callsEnabled: flags.isFeatureEnabled('calls_enabled'),
      approvalOverBudget: flags.isFeatureEnabled('approval_over_budget'),
      maxParallelCalls: Number.isFinite(parallel) && parallel > 0 ? parallel : DEFAULT_RULES.maxParallelCalls,
    }
  } catch (err) {
    console.error('[rules] Flagsmith unreachable, using defaults', err)
    return DEFAULT_RULES
  }
}
