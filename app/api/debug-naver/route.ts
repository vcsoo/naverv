import { parseStreamingState, findItemBlocks } from '../../../src/shared/naver'

export const runtime = 'edge'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

async function get(url: string, referer: string) {
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

/** 숫자값 가진 review/visit/blog/count 관련 필드 재귀 탐색 */
function findNumericReviewFields(value: unknown, path = '', depth = 0): { path: string; val: number }[] {
  if (depth > 10) return []
  const found: { path: string; val: number }[] = []
  if (Array.isArray(value)) {
    for (let i = 0; i < Math.min((value as any[]).length, 3); i++) {
      found.push(...findNumericReviewFields((value as any[])[i], `${path}[${i}]`, depth + 1))
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lk = k.toLowerCase()
      if (typeof v === 'number' && v > 0 &&
          (lk.includes('review') || lk.includes('visit') || lk.includes('blog') || lk.includes('count'))) {
        found.push({ path: `${path}.${k}`, val: v })
      }
      found.push(...findNumericReviewFields(v, `${path}.${k}`, depth + 1))
    }
  }
  return found
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const placeId = searchParams.get('id') || ''

    // ── 검색결과: 아이템 필드 구조 확인 ────────────────────────
    if (query) {
      const { status, text } = await get(
        `https://m.map.naver.com/search?query=${encodeURIComponent(query)}`,
        'https://m.map.naver.com/'
      )
      const streaming = parseStreamingState(text)
      const itemBlocks = findItemBlocks(streaming)
      const firstItem = itemBlocks[0]?.items?.[0] ?? null

      return Response.json({
        httpStatus: status,
        blocksFound: streaming.length,
        itemBlocksFound: itemBlocks.length,
        // 첫 번째 아이템의 모든 필드 키
        firstItemKeys: firstItem ? Object.keys(firstItem) : null,
        // review/visit/blog/count 숫자 필드 탐색
        numericReviewFields: findNumericReviewFields(streaming),
        // 첫 번째 아이템 전체 (실제 필드값 확인)
        firstItem,
      })
    }

    // ── 상세 페이지: streaming state에서 숫자 탐색 ─────────────
    if (placeId) {
      const { status, text } = await get(
        `https://m.place.naver.com/place/${placeId}/home`,
        'https://m.place.naver.com/'
      )
      const streaming = parseStreamingState(text)
      const numericFields = findNumericReviewFields(streaming)

      // 기존 regex 패턴 결과
      const regexHints: string[] = []
      for (const p of [
        /방문자\s*리뷰.{0,60}/g,
        /블로그\s*리뷰.{0,60}/g,
        /"(?:visitor|blog|review|place|count)[A-Za-z_]*"\s*:\s*[\d"]/gi,
      ]) {
        for (const m of text.matchAll(p)) regexHints.push(m[0])
      }

      return Response.json({
        httpStatus: status,
        htmlLength: text.length,
        streamingBlocksFound: streaming.length,
        // streaming state 내 숫자 review 필드
        numericReviewFieldsInStreaming: numericFields.slice(0, 30),
        // 전체 streaming 구조 요약 (shallow)
        streamingKeys: streaming.map((b: any, i: number) => ({
          index: i,
          type: Array.isArray(b) ? 'array' : typeof b,
          keys: b && !Array.isArray(b) && typeof b === 'object' ? Object.keys(b).slice(0, 10) : null,
        })),
        regexHints: [...new Set(regexHints)].slice(0, 20),
      })
    }

    return Response.json({ error: 'query 또는 id 파라미터 필요' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
