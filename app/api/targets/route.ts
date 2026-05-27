import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function GET() {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { results: targets } = await db.prepare(`
      SELECT search_query, place_name_input, matched_name, last_searched_at
      FROM targets WHERE last_searched_at >= ? ORDER BY last_searched_at DESC
    `).bind(cutoff).all() as any

    const output = await Promise.all(targets.map(async (t: any) => {
      const name = t.matched_name || t.place_name_input
      const latestRow = await db.prepare(
        'SELECT MAX(collected_at) as ts FROM rankings WHERE search_query = ?'
      ).bind(t.search_query).first() as any

      let latest_rank = null
      if (latestRow?.ts) {
        const rr = await db.prepare(`
          SELECT rank FROM rankings
          WHERE search_query = ? AND collected_at = ? AND place_name LIKE ?
          ORDER BY rank LIMIT 1
        `).bind(t.search_query, latestRow.ts, `%${name}%`).first() as any
        latest_rank = rr?.rank ?? null
      }

      const lastDt = new Date(t.last_searched_at)
      const days_left = Math.max(0, 30 - Math.floor((Date.now() - lastDt.getTime()) / 86400000))

      return {
        search_query: t.search_query,
        place_name_input: t.place_name_input,
        matched_name: t.matched_name,
        latest_rank,
        last_searched_at: t.last_searched_at.slice(0, 10),
        days_left
      }
    }))

    return Response.json(output)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB
    const { searchParams } = new URL(request.url)

    await db.prepare(
      'DELETE FROM targets WHERE search_query = ? AND place_name_input = ?'
    ).bind(searchParams.get('query') || '', searchParams.get('place') || '').run()

    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
