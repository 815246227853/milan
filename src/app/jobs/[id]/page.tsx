import { notFound } from 'next/navigation'
import { JobLive } from '@/components/job/JobLive'
import { jobView, refreshJob } from '@/lib/agent/runner'
import { getJob } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!getJob(id)) notFound()
  await refreshJob(id)
  return <JobLive initial={jobView(id)} />
}
