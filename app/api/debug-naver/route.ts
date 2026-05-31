import { parseStreamingState, parseDetailReviewCounts } from '../../../src/shared/naver'

export const runtime = 'edge'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

async function fetchText(url: string, referer: string) {
  const r = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'ko-KR,ko;q=0.9',
      referer,
    },
  })
  return { status: r.status, text: await r.text() }
}

// GET /api/debug-naver?query=검단신도시미용실
// GET /api/debug-naver?id=PLACE_ID   (place detail page)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const placeId = searchParams.get('id') || ''

    // ── 1. 검색 결과 진단 ──────────────────────────────────────
    if (query) {
      const { status, text } = await fetchText(
        `https://m.map.naver.com/search?query=${encodeURIComponent(query)}`,
        'https://m.map.naver.com/'
      )
      const blocks = parseStreamingState(text)
      // 첫 번째 아이템의 모든 필드 반환
      const firstBlock: any = (blocks as any[]).find((b: any) => Array.isArray(b?.items) && b.items.length > 0)
      const firstItem = firstBlock?.items?.[0] ?? null

      return Response.json({
        mode: 'search',
        httpStatus: status,
        htmlLength: text.length,
        hasCaptcha: text.includes('ncaptcha'),
        hasStreamingState: text.includes('window.__RQ_STREAMING_STATE__'),
        blocksFound: (blocks as any[]).length,
        firstItemKeys: firstItem ? Object.keys(firstItem) : null,
        firstItem,  // 전체 필드 확인용
      })
    }

    // ── 2. 플레이스 상세 페이지 진단 ──────────────────────────
    if (placeId) {
      const { status, text } = await fetchText(
        `https://m.place.naver.com/place/${placeId}/home`,
        'https://m.place.naver.com/'
      )
      const parsed = parseDetailReviewCounts(text)

      // 리뷰 관련 패턴 수동 탐색
      const reviewHints: string[] = []
      const patterns = [
        /방문자\s*리뷰.{0,30}/g,
        /블로그\s*리뷰.{0,30}/g,
        /"(?:visitor|blog|review|place)[A-Za-z]*"\s*:\s*\d+/gi,
        /content="[^"]*(?:리뷰|review)[^"]{0,100}"/gi,
      ]
      for (const p of patterns) {
        const matches = [...text.matchAll(p)].map(m => m[0]).slice(0, 5)
        reviewHints.push(...matches)
      }

      return Response.json({
        mode: 'detail',
        httpStatus: status,
        htmlLength: text.length,
        parsedResult: parsed,
        reviewHints: [...new Set(reviewHints)].slice(0, 30),
      })
    }

    return Response.json({ error: 'query 또는 id 파라미터 필요' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
