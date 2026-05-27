import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const { env } = getRequestContext()
    const e = env as any

    const body = await request.json() as any

    if (body.api_key !== e.API_SECRET) {
      return Response.json({ error: '인증 실패' }, { status: 401 })
    }

    const { query, collected_at, places } = body
    if (!query || !places?.length) {
      return Response.json({ error: '데이터 없음' }, { status: 400 })
    }

    const db = e.DB
    const CHUNK = 50

    for (let i = 0; i < places.length; i += CHUNK) {
      const chunk = places.slice(i, i + CHUNK)
      await db.batch(
        chunk.map((p: any) =>
          db.prepare(`
            INSERT INTO rankings
              (collected_at, search_query, rank, place_id, place_name,
               address, category, blog_review_count, visitor_review_count, total_review_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            collected_at, query, p.rank, p.place_id || '',
            p.name, p.address || '', p.category || '',
            p.blog || 0, p.visit || 0,
            (p.blog || 0) + (p.visit || 0)
          )
        )
      )
    }

    return Response.json({ ok: true, saved: places.length })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
