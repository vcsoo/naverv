import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

// 유니코드 정규화 (한글 NFC)
function normalize(s: string): string {
  return s.normalize('NFC').replace(/\s/g, '').toLowerCase()
}

export async function POST(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as CloudflareEnv).DB

    const { search_query, place_name } = await request.json() as {
      search_query: string
      place_name: string
    }

    // 최신 수집 시각
    const latestRow = await db.prepare(
      'SELECT MAX(collected_at) as ts FROM rankings WHERE search_query = ?'
    ).bind(search_query).first<{ ts: string | null }>()

    if (!latestRow?.ts) {
      return Response.json({ need_collect: true })
    }

    // 24시간 이내인지 확인
    const age = Date.now() - new Date(latestRow.ts).getTime()
    if (age > 24 * 60 * 60 * 1000) {
      return Response.json({ need_collect: true })
    }

    // 해당 시각의 전체 결과 가져와서 Python 레벨 매칭
    const { results } = await db.prepare(
      'SELECT rank, place_name, blog_review_count, visitor_review_count, collected_at FROM rankings WHERE search_query = ? AND collected_at = ? ORDER BY rank'
    ).bind(search_query, latestRow.ts).all<{
      rank: number
      place_name: string
      blog_review_count: number
      visitor_review_count: number
      collected_at: string
    }>()

    // 정규화 매칭
    const pNorm = normalize(place_name)
    const matched = results.find(r => normalize(r.place_name).includes(pNorm))

    if (!matched) {
      return Response.json({
        not_found: true,
        collected_at: latestRow.ts,
        total_collected: results.length
      })
    }

    // 이전 순위
    const prevRow = await db.prepare(
      'SELECT MAX(collected_at) as ts FROM rankings WHERE search_query = ? AND collected_at < ?'
    ).bind(search_query, latestRow.ts).first<{ ts: string | null }>()

    let prev_rank: number | null = null
    if (prevRow?.ts) {
      const prevRankRow = await db.prepare(
        'SELECT rank FROM rankings WHERE search_query = ? AND collected_at = ? AND place_name = ? LIMIT 1'
      ).bind(search_query, prevRow.ts, matched.place_name).first<{ rank: number }>()
      prev_rank = prevRankRow?.rank ?? null
    }

    // 히스토리 (날짜별)
    const { results: histRows } = await db.prepare(`
      SELECT date(collected_at) as d,
             MIN(rank) as rank,
             MAX(blog_review_count) as blog,
             MAX(visitor_review_count) as visit
      FROM rankings
      WHERE search_query = ? AND place_name = ?
      GROUP BY date(collected_at)
      ORDER BY d ASC
    `).bind(search_query, matched.place_name).all<{
      d: string; rank: number; blog: number; visit: number
    }>()

    // 추적 대상 등록/갱신
    const now = new Date().toISOString()
    await db.prepare(`
      INSERT INTO targets (search_query, place_name_input, matched_name, first_added_at, last_searched_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(search_query, place_name_input)
      DO UPDATE SET last_searched_at = ?, matched_name = COALESCE(?, matched_name)
    `).bind(
      search_query, place_name, matched.place_name, now, now,
      now, matched.place_name
    ).run()

    return Response.json({
      search_query,
      matched_name: matched.place_name,
      rank: matched.rank,
      prev_rank,
      blog: matched.blog_review_count,
      visit: matched.visitor_review_count,
      collected_at: matched.collected_at,
      days_left: 30,
      history: histRows.map(h => ({
        date: h.d, rank: h.rank, blog: h.blog, visit: h.visit
      }))
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
