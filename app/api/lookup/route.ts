import { getRequestContext } from '@cloudflare/next-on-pages'
import { ensureRanking, findPlaceInLatest, getPlaceHistory, getLatestRankingList } from '../../../src/shared/db'

export const runtime = 'edge'

// Search without registering.
// GET /api/lookup?query=...           → full ranking list
// GET /api/lookup?query=...&place=... → single business result
export async function GET(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const place = searchParams.get('place') || ''

    if (!query) return Response.json({ error: 'query required' }, { status: 400 })

    await ensureRanking(db, query, 100)

    if (!place) {
      const ranking = await getLatestRankingList(db, query, 100)
      if (!ranking) return Response.json({ not_found: true })
      return Response.json({ list: ranking.list, collected_at: ranking.collected_at })
    }

    const found = await findPlaceInLatest(db, query, place)
    if (!found?.matched) {
      return Response.json({
        not_found: true,
        total_collected: found?.total_collected ?? 0,
        collected_at: found?.collected_at,
      })
    }

    const history = await getPlaceHistory(db, query, found.matched)
    const prev_rank = history.length >= 2 ? history[history.length - 2].rank : null

    return Response.json({
      matched_name: found.matched.name,
      rank: found.matched.rank,
      prev_rank,
      blog: found.matched.blog,
      visit: found.matched.visit,
      collected_at: found.collected_at,
      history,
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
