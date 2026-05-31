import { getRequestContext } from '@cloudflare/next-on-pages'
import { findPlaceInLatest, findPlaceInHistory, getPlaceHistory } from '../../../src/shared/db'
import { isDummy, getDummyHistory } from '../../../src/shared/dummy'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const place = searchParams.get('place') || ''

    if (!query || !place) return Response.json({ error: 'query and place required' }, { status: 400 })

    const todayKst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

    // 더미 데이터 처리
    if (isDummy(query, place)) {
      const history = getDummyHistory(todayKst)
      const last = history[history.length - 1]
      return Response.json({
        matched_name: place,
        rank: last.rank,
        blog: last.blog,
        visit: last.visit,
        collected_at: todayKst + 'T11:30:00',
        history,
      })
    }

    const { env } = getRequestContext()
    const db = (env as any).DB

    const found = await findPlaceInLatest(db, query, place)
    const matched = found?.matched ?? await findPlaceInHistory(db, query, place)

    if (!matched) {
      return Response.json({ not_found: true, history: [] })
    }

    const history = await getPlaceHistory(db, query, matched)
    if (!history.length) {
      return Response.json({ not_found: true, history: [] })
    }

    return Response.json({
      matched_name: matched.name,
      rank: found?.matched?.rank ?? null,
      blog: found?.matched?.blog ?? 0,
      visit: found?.matched?.visit ?? 0,
      collected_at: found?.collected_at ?? null,
      history,
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
