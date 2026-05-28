import { getRequestContext } from '@cloudflare/next-on-pages'
import { ensureRanking, findPlaceInLatest, getPlaceHistory, upsertTarget } from '../../../src/shared/db'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB
    const { search_query, place_name } = await request.json() as any

    if (!search_query) return Response.json({ error: 'search_query required' }, { status: 400 })

    await ensureRanking(db, search_query, 100)

    const found = await findPlaceInLatest(db, search_query, place_name)

    if (!found?.matched) {
      return Response.json({
        not_found: true,
        search_query,
        collected_at: found?.collected_at,
        total_collected: found?.total_collected ?? 0
      })
    }

    const { matched, collected_at } = found
    await upsertTarget(db, search_query, place_name, matched.name)

    const history = await getPlaceHistory(db, search_query, matched)
    const prev_rank = history.length >= 2 ? history[history.length - 2].rank : null

    return Response.json({
      search_query,
      matched_name: matched.name,
      rank: matched.rank,
      prev_rank,
      blog: matched.blog,
      visit: matched.visit,
      collected_at,
      days_left: 30,
      history
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
