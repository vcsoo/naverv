import { getRequestContext } from '@cloudflare/next-on-pages'
import { findPlaceInLatest, getPlaceHistory } from '../../../src/shared/db'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const place = searchParams.get('place') || ''

    if (!query || !place) return Response.json({ error: 'query and place required' }, { status: 400 })

    const found = await findPlaceInLatest(db, query, place)
    if (!found?.matched) {
      return Response.json({ not_found: true, history: [] })
    }

    const history = await getPlaceHistory(db, query, found.matched)
    return Response.json({
      matched_name: found.matched.name,
      rank: found.matched.rank,
      blog: found.matched.blog,
      visit: found.matched.visit,
      collected_at: found.collected_at,
      history,
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
