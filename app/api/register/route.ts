import { getRequestContext } from '@cloudflare/next-on-pages'
import { upsertTarget } from '../../../src/shared/db'
import { getSessionFromRequest } from '../../../src/shared/auth'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const { env } = getRequestContext()
    const db = (env as any).DB
    const { search_query, place_name_input, matched_name } = await request.json() as any

    if (!search_query || !place_name_input) {
      return Response.json({ error: 'search_query and place_name_input required' }, { status: 400 })
    }

    await upsertTarget(db, search_query, place_name_input, matched_name || place_name_input, session.user_id)
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
