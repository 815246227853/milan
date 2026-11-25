import { z } from 'zod'
import { handle } from '@/lib/http'
import { jobView, startCalls } from '@/lib/agent/runner'

const callInput = z.object({ vendorIds: z.array(z.string().uuid()).min(1).max(8) })

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    const { vendorIds } = callInput.parse(await req.json())
    await startCalls(id, vendorIds)
    return jobView(id)
  })
}
