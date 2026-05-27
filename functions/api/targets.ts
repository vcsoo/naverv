import { listActiveTargets, type Env } from '../../src/shared/db'
import { kstNowString } from '../../src/shared/naver'

export async function onRequestGet(context: { env: Env }) {
  try {
    const targets = await listActiveTargets(context.env.DB)
    return Response.json(targets)
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json().catch(() => ({} as any))
    const query = String(body.search_query || body.query || '').trim()
    const place = String(body.place_name_input || body.place_name || body.place || '').trim()
    const matched = body.matched_name ? String(body.matched_name).trim() : null
    if (!query || !place) return Response.json({ error: 'search_query and place_name are required' }, { status: 400 })

    const now = kstNowString()
    const existing = await context.env.DB
      .prepare('SELECT id FROM targets WHERE search_query = ? AND place_name_input = ? LIMIT 1')
      .bind(query, place)
      .first<{ id: number }>()

    if (existing) {
      await context.env.DB
        .prepare('UPDATE targets SET matched_name = ?, last_searched_at = ? WHERE id = ?')
        .bind(matched, now, existing.id)
        .run()
    } else {
      await context.env.DB
        .prepare(
          `INSERT INTO targets (search_query, place_name_input, matched_name, first_added_at, last_searched_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(query, place, matched, now, now)
        .run()
    }
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    const url = new URL(context.request.url)
    const query = String(url.searchParams.get('query') || '').trim()
    const place = String(url.searchParams.get('place') || '').trim()
    if (!query || !place) return Response.json({ error: 'query and place are required' }, { status: 400 })

    await context.env.DB
      .prepare('DELETE FROM targets WHERE search_query = ? AND place_name_input = ?')
      .bind(query, place)
      .run()
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
