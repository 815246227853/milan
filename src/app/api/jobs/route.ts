import { z } from 'zod'
import { handle } from '@/lib/http'
import { createJobFromRequest } from '@/lib/agent/runner'

const jobInput = z.object({ request: z.string().trim().min(5, 'say a little more').max(500) })

export async function POST(req: Request) {
  return handle(async () => {
    const { request } = jobInput.parse(await req.json())
    const job = await createJobFromRequest(request)
    return { id: job.id }
  })
}
