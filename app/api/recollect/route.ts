import { getRequestContext } from '@cloudflare/next-on-pages'
import { collectActiveTargets } from '../../../src/shared/db'

export const runtime = 'edge'

export async function POST() {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB
    const result = await collectActiveTargets(db)
    return Response.json(result)
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
