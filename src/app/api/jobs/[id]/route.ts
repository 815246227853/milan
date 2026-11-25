import { handle } from '@/lib/http'
import { jobView, refreshJob } from '@/lib/agent/runner'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    await refreshJob(id)
    return jobView(id)
  })
}
