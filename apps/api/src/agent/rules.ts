// Milan's rules come from Flagsmith. Read them before every call and every commitment.
// Each wedding is a Flagsmith identity, so families can have different rules.
import Flagsmith from 'flagsmith-nodejs';

const flagsmith = new Flagsmith({ environmentKey: process.env.FLAGSMITH_ENVIRONMENT_KEY! });

export interface Rules {
  callsEnabled: boolean;        // kill switch
  approvalOverBudget: boolean;
  maxPricePerPlate: number;
  callLanguages: string[];
  maxParallelCalls: number;
  aiDisclosure: boolean;
}

export async function getRules(weddingId: string): Promise<Rules> {
  const flags = await flagsmith.getIdentityFlags(weddingId);
  return {
    callsEnabled: flags.isFeatureEnabled('calls_enabled'),
    approvalOverBudget: flags.isFeatureEnabled('approval_over_budget'),
    maxPricePerPlate: Number(flags.getFeatureValue('max_price_per_plate') ?? 1000),
    callLanguages: String(flags.getFeatureValue('call_languages') ?? 'hi').split(','),
    maxParallelCalls: Number(flags.getFeatureValue('max_parallel_calls') ?? 3),
    // Disclosure stays on unless explicitly disabled in a test environment.
    aiDisclosure: flags.isFeatureEnabled('ai_disclosure') !== false,
  };
}

// Called before booking: over budget + approval rule on → create a decision instead of booking.
export function needsApproval(rules: Rules, cost: number, budget: number): boolean {
  return rules.approvalOverBudget && cost > budget;
}
