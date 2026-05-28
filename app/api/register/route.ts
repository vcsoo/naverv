import { getRequestContext } from '@cloudflare/next-on-pages'
import { upsertTarget } from '../../../src/shared/db'

export const runtime = 'edge'

// Register a target without re-searching (data already collected by /api/lookup).
export async function POST(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB
    const { search_query, place_name_input, matched_name } = await request.json() as any

    if (!search_query || !place_name_input) {
      return Response.json({ error: 'search_query and place_name_input required' }, { status: 400 })
    }

    await upsertTarget(db, search_query, place_name_input, matched_name || place_name_input)
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
