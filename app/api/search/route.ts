import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

function normalize(s: string): string {
  return s.normalize('NFC').replace(/\s/g, '').toLowerCase()
}

export async function POST(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB

    const { search_query, place_name } = await request.json() as any

    const latestRow = await db.prepare(
      'SELECT MAX(collected_at) as ts FROM rankings WHERE search_query = ?'
    ).bind(search_query).first() as any

    if (!latestRow?.ts) return Response.json({ need_collect: true })

    const age = Date.now() - new Date(latestRow.ts).getTime()
    if (age > 24 * 60 * 60 * 1000) return Response.json({ need_collect: true })

    const { results } = await db.prepare(
      'SELECT rank, place_name, blog_review_count, visitor_review_count, collected_at FROM rankings WHERE search_query = ? AND collected_at = ? ORDER BY rank'
    ).bind(search_query, latestRow.ts).all() as any

    const pNorm = normalize(place_name)
    const matched = results.find((r: any) => normalize(r.place_name).includes(pNorm))

    if (!matched) {
      return Response.json({ not_found: true, collected_at: latestRow.ts, total_collected: results.length })
    }

    const prevRow = await db.prepare(
      'SELECT MAX(collected_at) as ts FROM rankings WHERE search_query = ? AND collected_at < ?'
    ).bind(search_query, latestRow.ts).first() as any

    let prev_rank = null
    if (prevRow?.ts) {
      const pr = await db.prepare(
        'SELECT rank FROM rankings WHERE search_query = ? AND collected_at = ? AND place_name = ? LIMIT 1'
      ).bind(search_query, prevRow.ts, matched.place_name).first() as any
      prev_rank = pr?.rank ?? null
    }

    const now = new Date().toISOString()
    await db.prepare(`
      INSERT INTO targets (search_query, place_name_input, matched_name, first_added_at, last_searched_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(search_query, place_name_input)
      DO UPDATE SET last_searched_at = ?, matched_name = COALESCE(?, matched_name)
    `).bind(search_query, place_name, matched.place_name, now, now, now, matched.place_name).run()

    const { results: histRows } = await db.prepare(`
      SELECT date(collected_at) as d,
             MIN(rank) as rank,
             MAX(blog_review_count) as blog,
             MAX(visitor_review_count) as visit
      FROM rankings
      WHERE search_query = ? AND place_name = ?
      GROUP BY date(collected_at)
      ORDER BY d ASC
    `).bind(search_query, matched.place_name).all() as any

    return Response.json({
      search_query,
      matched_name: matched.place_name,
      rank: matched.rank,
      prev_rank,
      blog: matched.blog_review_count,
      visit: matched.visitor_review_count,
      collected_at: matched.collected_at,
      days_left: 30,
      history: histRows.map((h: any) => ({ date: h.d, rank: h.rank, blog: h.blog, visit: h.visit }))
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
