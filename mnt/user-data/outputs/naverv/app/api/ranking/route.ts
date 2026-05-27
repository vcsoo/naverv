import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as CloudflareEnv).DB

    const { search_query, limit = 100 } = await request.json() as {
      search_query: string
      limit?: number
    }

    const latestRow = await db.prepare(
      'SELECT MAX(collected_at) as ts FROM rankings WHERE search_query = ?'
    ).bind(search_query).first<{ ts: string | null }>()

    if (!latestRow?.ts) {
      return Response.json({ need_collect: true })
    }

    const age = Date.now() - new Date(latestRow.ts).getTime()
    if (age > 24 * 60 * 60 * 1000) {
      return Response.json({ need_collect: true })
    }

    const { results } = await db.prepare(`
      SELECT rank, place_name, category, address,
             blog_review_count as blog,
             visitor_review_count as visit,
             total_review_count as total
      FROM rankings
      WHERE search_query = ? AND collected_at = ? AND rank <= ?
      ORDER BY rank
    `).bind(search_query, latestRow.ts, limit).all()

    return Response.json({
      search_query,
      collected_at: latestRow.ts,
      list: results
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
