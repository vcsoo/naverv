import { parseStreamingState } from '../../../src/shared/naver'

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

/** 이름 있는 배열(place list 후보)을 재귀 탐색 */
function findNamedLists(value: unknown, depth = 0, path = ''): string[] {
  if (depth > 8) return []
  const found: string[] = []
  if (Array.isArray(value) && value.length > 0) {
    const first = (value as any[])[0]
    if (first && typeof first === 'object' && (first.name || first.placeName)) {
      found.push(`PATH: ${path} → len=${value.length}, first_keys=[${Object.keys(first).slice(0, 12).join(',')}]`)
    }
    for (const item of (value as any[]).slice(0, 2)) {
      found.push(...findNamedLists(item, depth + 1, `${path}[]`))
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      found.push(...findNamedLists(v, depth + 1, path ? `${path}.${k}` : k))
    }
  }
  return found
}

/** 블록 구조 요약 */
function summarizeBlock(block: unknown, depth = 0): unknown {
  if (depth > 3) return '...'
  if (Array.isArray(block)) {
    return { _array: true, length: block.length, first: summarizeBlock((block as any[])[0], depth + 1) }
  }
  if (block && typeof block === 'object') {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
      if (Array.isArray(v)) obj[k] = `Array(${(v as any[]).length})`
      else if (v && typeof v === 'object') obj[k] = summarizeBlock(v, depth + 1)
      else obj[k] = v
    }
    return obj
  }
  return block
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const placeId = searchParams.get('id') || ''

    // ── 검색결과 진단 ─────────────────────────────────────
    if (query) {
      const { status, text } = await fetchText(
        `https://m.map.naver.com/search?query=${encodeURIComponent(query)}`,
        'https://m.map.naver.com/'
      )
      const blocks = parseStreamingState(text) as any[]

      return Response.json({
        httpStatus: status,
        htmlLength: text.length,
        hasCaptcha: text.includes('ncaptcha'),
        blocksFound: blocks.length,
        // 각 블록의 구조 요약
        blockSummaries: blocks.map((b, i) => ({ index: i, summary: summarizeBlock(b) })),
        // place list 후보 경로 탐색
        namedListPaths: findNamedLists(blocks),
      })
    }

    // ── 상세페이지 진단 ───────────────────────────────────
    if (placeId) {
      const { status, text } = await fetchText(
        `https://m.place.naver.com/place/${placeId}/home`,
        'https://m.place.naver.com/'
      )
      const reviewHints: string[] = []
      const patterns = [
        /방문자\s*리뷰.{0,40}/g,
        /블로그\s*리뷰.{0,40}/g,
        /"(?:visitor|blog|review|place)[A-Za-z]*"\s*:\s*\d+/gi,
        /content="[^"]*(?:리뷰|review)[^"]{0,80}"/gi,
      ]
      for (const p of patterns) {
        for (const m of text.matchAll(p)) reviewHints.push(m[0])
      }
      return Response.json({
        httpStatus: status,
        htmlLength: text.length,
        reviewHints: [...new Set(reviewHints)].slice(0, 30),
      })
    }

    return Response.json({ error: 'query 또는 id 파라미터 필요' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
