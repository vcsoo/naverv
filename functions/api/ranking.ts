import { collectAndStore, getLatestRankingList, type Env } from '../../src/shared/db'

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json().catch(() => ({} as any))
    const query = String(body.search_query || body.query || '').trim()
    const limit = Number(body.limit || 100)
    if (!query) return Response.json({ error: 'search_query is required' }, { status: 400 })

    let ranking = await getLatestRankingList(context.env.DB, query, limit)
    if (!ranking) {
      const run = await collectAndStore(context.env.DB, query, Math.min(limit || 75, 75))
      ranking = await getLatestRankingList(context.env.DB, query, limit)
      if (!ranking) return Response.json({ need_collect: true, collected_at: run.collected_at })
    }

    return Response.json(ranking)
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
