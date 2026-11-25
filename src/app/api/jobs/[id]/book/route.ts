import { z } from 'zod'
import { handle } from '@/lib/http'
import { bookVendor } from '@/lib/agent/runner'

const bookInput = z.object({ vendorId: z.string().uuid(), approvedOverBudget: z.boolean().default(false) })

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    const { vendorId, approvedOverBudget } = bookInput.parse(await req.json())
    return bookVendor(id, vendorId, approvedOverBudget)
  })
}
