import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AgentError } from './agent/runner'
import { UnclearRequestError } from './agent/parse'

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string }

export function ok<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data })
}

/** Runs a handler and turns known errors into a 4xx with a message the UI can show. */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse<ApiResponse<T>>> {
  try {
    return ok(await fn())
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0]
      return NextResponse.json({ ok: false, error: `${issue?.path.join('.') || 'input'}: ${issue?.message}` }, { status: 400 })
    }
    if (err instanceof AgentError || err instanceof UnclearRequestError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 })
    }
    console.error('[api] unexpected error', err)
    return NextResponse.json({ ok: false, error: 'Something went wrong on our side. Try again.' }, { status: 500 })
  }
}
