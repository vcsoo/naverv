import { collectAndStore, type Env } from '../../src/shared/db'

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json().catch(() => ({} as any))
    const query = String(body.search_query || body.query || '').trim()
    const limit = Number(body.limit || 75)
    if (!query) return Response.json({ error: 'search_query is required' }, { status: 400 })

    const result = await collectAndStore(context.env.DB, query, Math.min(limit || 75, 75))
    return Response.json({ ok: true, ...result })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
