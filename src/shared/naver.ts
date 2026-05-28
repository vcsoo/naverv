export type NaverPlace = {
  rank: number
  place_id: string
  name: string
  address: string
  category: string
  blog: number
  visit: number
}

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

function toInt(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function extractJsonAt(text: string, start: number): { value: unknown; end: number } | null {
  let i = start
  while (i < text.length && /\s/.test(text[i])) i += 1
  const opener = text[i]
  const closer = opener === '{' ? '}' : opener === '[' ? ']' : ''
  if (!closer) return null

  let depth = 0
  let inString = false
  let escape = false
  for (let j = i; j < text.length; j += 1) {
    const ch = text[j]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === opener) depth += 1
    else if (ch === closer) {
      depth -= 1
      if (depth === 0) {
        const raw = text.slice(i, j + 1)
        try {
          return { value: JSON.parse(raw), end: j + 1 }
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function parseStreamingState(html: string): unknown[] {
  const marker = 'window.__RQ_STREAMING_STATE__.push('
  const out: unknown[] = []
  let pos = 0
  while (true) {
    const idx = html.indexOf(marker, pos)
    if (idx === -1) break
    const parsed = extractJsonAt(html, idx + marker.length)
    if (!parsed) {
      pos = idx + marker.length
      continue
    }
    out.push(parsed.value)
    pos = parsed.end
  }
  return out
}

function findItemBlocks(value: unknown): any[] {
  const found: any[] = []
  if (Array.isArray(value)) {
    for (const item of value) found.push(...findItemBlocks(item))
  } else if (value && typeof value === 'object') {
    const obj = value as any
    if (Array.isArray(obj.items) && obj.items.some((x: any) => x?.name && (x?.id || x?.placeId || x?.businessId))) found.push(obj)
    for (const child of Object.values(obj)) {
      if (child && typeof child === 'object') found.push(...findItemBlocks(child))
    }
  }
  return found
}

function parsePlace(item: any, fallbackRank: number): NaverPlace | null {
  const name = String(item?.name || '').trim()
  const placeId = String(item?.id || item?.placeId || item?.businessId || '').trim()
  if (!name || !placeId) return null
  const category = Array.isArray(item.category) ? item.category.join(', ') : String(item.category || '')
  return {
    rank: toInt(item.rank, fallbackRank),
    place_id: placeId,
    name,
    address: String(item.roadAddress || item.address || ''),
    category,
    blog: toInt(item.reviewCount || item.blogReviewCount),
    visit: toInt(item.placeReviewCount || item.visitorReviewCount),
  }
}

async function fetchText(url: string, referer: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': MOBILE_UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'ko-KR,ko;q=0.9',
      referer,
    },
  })
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${url}`)
  return await res.text()
}

export function parseDetailReviewCounts(html: string): { blog: number | null; visit: number | null } {
  const text = decodeHtml(html)
  const result: { blog: number | null; visit: number | null } = { blog: null, visit: null }

  const meta = text.match(/content="([^"]*방문자리뷰[^"]*)"/)
  if (meta) {
    const desc = meta[1]
    const visit = desc.match(/방문자리뷰\s*([\d,]+)/)
    const blog = desc.match(/블로그\s*리뷰\s*([\d,]+)/) || desc.match(/블로그리뷰\s*([\d,]+)/)
    if (visit) result.visit = toInt(visit[1])
    if (blog) result.blog = toInt(blog[1])
  }

  if (result.visit === null) {
    const visit = text.match(/"visitorReviewsTotal"\s*:\s*(\d+)/)
    if (visit) result.visit = toInt(visit[1])
  }
  if (result.blog === null) {
    const blog =
      text.match(/블로그\s*리뷰\s*([\d,]+)/) ||
      text.match(/블로그리뷰\s*([\d,]+)/) ||
      text.match(/"blogReview(?:s)?Total"\s*:\s*(\d+)/) ||
      text.match(/"blogReview(?:s)?Count"\s*:\s*(\d+)/)
    if (blog) result.blog = toInt(blog[1])
  }
  return result
}

async function enrichOne(place: NaverPlace): Promise<NaverPlace> {
  try {
    const html = await fetchText(`https://m.place.naver.com/place/${place.place_id}/home`, 'https://m.place.naver.com/')
    const detail = parseDetailReviewCounts(html)
    return {
      ...place,
      blog: detail.blog ?? place.blog,
      visit: detail.visit ?? place.visit,
    }
  } catch {
    return place
  }
}

async function enrichReviewCounts(places: NaverPlace[], concurrency = 6): Promise<NaverPlace[]> {
  const out: NaverPlace[] = []
  for (let i = 0; i < places.length; i += concurrency) {
    const chunk = places.slice(i, i + concurrency)
    out.push(...(await Promise.all(chunk.map(enrichOne))))
  }
  return out
}

export async function collectNaverPlaces(query: string, limit = 75): Promise<NaverPlace[]> {
  const url = `https://m.map.naver.com/search?query=${encodeURIComponent(query)}`
  const html = await fetchText(url, 'https://m.map.naver.com/')
  const blocks = findItemBlocks(parseStreamingState(html))
  if (!blocks.length) {
    if (html.includes('ncaptcha')) throw new Error('Naver returned ncaptcha')
    throw new Error('No Naver search result items found')
  }

  const best = blocks.sort((a, b) => (b.items?.length || 0) - (a.items?.length || 0))[0]
  const seen = new Set<string>()
  const places: NaverPlace[] = []
  for (let i = 0; i < best.items.length; i += 1) {
    const place = parsePlace(best.items[i], i + 1)
    if (!place || seen.has(place.place_id)) continue
    seen.add(place.place_id)
    places.push(place)
    if (places.length >= limit) break
  }
  return await enrichReviewCounts(places)
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').trim()
}

export function matchPlace(places: NaverPlace[], input: string): NaverPlace | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // 숫자로만 이루어진 입력 → 플레이스 ID 직접 매칭 (D1이 number로 반환할 수 있어 String() 변환)
  if (/^\d+$/.test(trimmed)) {
    const byId = places.find((p) => String(p.place_id) === trimmed)
    if (byId) return byId
  }

  const key = normalizeName(trimmed)
  if (!key) return null
  return (
    places.find((p) => normalizeName(p.name) === key) ||
    places.find((p) => normalizeName(p.name).includes(key) || key.includes(normalizeName(p.name))) ||
    null
  )
}

export function kstNowString(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 19)
}

export function kstDateString(date = new Date()): string {
  return kstNowString(date).slice(0, 10)
}
