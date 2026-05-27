import { ensureRanking, findPlaceInLatest, getPlaceHistory, upsertTarget, type Env } from '../../src/shared/db'

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json().catch(() => ({} as any))
    const query = String(body.search_query || body.query || '').trim()
    const placeName = String(body.place_name || body.place || '').trim()
    if (!query || !placeName) return Response.json({ error: 'search_query and place_name are required' }, { status: 400 })

    await ensureRanking(context.env.DB, query, 75)
    const found = await findPlaceInLatest(context.env.DB, query, placeName)

    if (!found || !found.matched) {
      await upsertTarget(context.env.DB, query, placeName, null)
      return Response.json({
        not_found: true,
        search_query: query,
        place_name_input: placeName,
        total_collected: found?.total_collected || 0,
        collected_at: found?.collected_at || null,
        history: [],
      })
    }

    await upsertTarget(context.env.DB, query, placeName, found.matched.name)
    const history = await getPlaceHistory(context.env.DB, query, found.matched)
    const prev = history.length >= 2 ? history[history.length - 2] : null

    return Response.json({
      not_found: false,
      search_query: query,
      place_name_input: placeName,
      matched_name: found.matched.name,
      rank: found.matched.rank,
      prev_rank: prev?.rank ?? null,
      blog: found.matched.blog,
      visit: found.matched.visit,
      collected_at: found.collected_at,
      history,
    })
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
