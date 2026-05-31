#!/usr/bin/env node
/**
 * 네이버 리뷰 수 파싱 테스트 스크립트
 * 사용법: node scripts/test-naver-parse.mjs [place_id] [search_query]
 * 예시:
 *   node scripts/test-naver-parse.mjs 1681552480
 *   node scripts/test-naver-parse.mjs "" 검단신도시미용실
 */

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

async function get(url, referer) {
  const r = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'ko-KR,ko;q=0.9',
      referer,
    },
  })
  console.log(`HTTP ${r.status} ← ${url}`)
  return { status: r.status, text: await r.text() }
}

function extractJsonAt(text, start) {
  let i = start
  while (i < text.length && /\s/.test(text[i])) i++
  const opener = text[i]
  const closer = opener === '{' ? '}' : opener === '[' ? ']' : ''
  if (!closer) return null
  let depth = 0, inString = false, escape = false
  for (let j = i; j < text.length; j++) {
    const ch = text[j]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === opener) depth++
    else if (ch === closer) {
      depth--
      if (depth === 0) {
        try { return { value: JSON.parse(text.slice(i, j + 1)), end: j + 1 } }
        catch { return null }
      }
    }
  }
  return null
}

function parseStreamingState(html) {
  const marker = 'window.__RQ_STREAMING_STATE__.push('
  const out = []
  let pos = 0
  while (true) {
    const idx = html.indexOf(marker, pos)
    if (idx === -1) break
    const parsed = extractJsonAt(html, idx + marker.length)
    if (!parsed) { pos = idx + marker.length; continue }
    out.push(parsed.value)
    pos = parsed.end
  }
  return out
}

function findNumericReviewFields(value, path = '', depth = 0) {
  if (depth > 12) return []
  const found = []
  if (Array.isArray(value)) {
    for (let i = 0; i < Math.min(value.length, 5); i++) {
      found.push(...findNumericReviewFields(value[i], `${path}[${i}]`, depth + 1))
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
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

function findItemBlocks(value) {
  const found = []
  if (Array.isArray(value)) {
    for (const item of value) found.push(...findItemBlocks(item))
  } else if (value && typeof value === 'object') {
    if (Array.isArray(value.items) && value.items.some(x => x?.name && (x?.id || x?.placeId || x?.businessId))) {
      found.push(value)
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') found.push(...findItemBlocks(child))
    }
  }
  return found
}

function decodeHtml(s) {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
         .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function toInt(v, fallback = 0) {
  if (v == null || v === '') return fallback
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function parseDetailReviewCounts(html) {
  const text = decodeHtml(html)
  const result = { blog: null, visit: null }

  // 1순위: snake_case JSON 필드
  const vm = text.match(/"visitor_review_count"\s*:\s*"[^"]*?([\d,]+)/) ||
             text.match(/"visitor_review_count"\s*:\s*(\d+)/)
  if (vm) result.visit = toInt(vm[1])

  const bm = text.match(/"blog_review_count"\s*:\s*"[^"]*?([\d,]+)/) ||
             text.match(/"blog_review_count"\s*:\s*(\d+)/)
  if (bm) result.blog = toInt(bm[1])

  // 2순위: og:description
  if (result.visit === null || result.blog === null) {
    const meta = text.match(/content="([^"]*방문자\s*리뷰[^"]*)"/)
    if (meta) {
      if (result.visit === null) { const m = meta[1].match(/방문자\s*리뷰\s*([\d,]+)/); if (m) result.visit = toInt(m[1]) }
      if (result.blog === null)  { const m = meta[1].match(/블로그\s*리뷰\s*([\d,]+)/);  if (m) result.blog  = toInt(m[1]) }
    }
  }

  // 3순위: 기타
  if (result.visit === null) {
    const m = text.match(/방문자\s*리뷰\s*([\d,]+)/) ||
              text.match(/"visitorReviewsTotal"\s*:\s*(\d+)/) ||
              text.match(/"visitorReviewCount"\s*:\s*(\d+)/)
    if (m) result.visit = toInt(m[1])
  }
  if (result.blog === null) {
    const m = text.match(/블로그\s*리뷰\s*([\d,]+)/) ||
              text.match(/"blogCafeReviewCount"\s*:\s*(\d+)/) ||
              text.match(/"blogCafeReviewsTotal"\s*:\s*(\d+)/) ||
              text.match(/"blogReview(?:s)?Total"\s*:\s*(\d+)/) ||
              text.match(/"blogReview(?:s)?Count"\s*:\s*(\d+)/)
    if (m) result.blog = toInt(m[1])
  }

  return result
}

// ── 메인 ──────────────────────────────────────────────────────────
const placeId = process.argv[2] || '1681552480'
const query   = process.argv[3] || ''

if (query) {
  console.log(`\n=== 검색: ${query} ===`)
  const { status, text } = await get(`https://m.map.naver.com/search?query=${encodeURIComponent(query)}`, 'https://m.map.naver.com/')
  const streaming = parseStreamingState(text)
  const itemBlocks = findItemBlocks(streaming)
  const firstItem = itemBlocks[0]?.items?.[0] ?? null
  console.log('streaming blocks:', streaming.length, '| item blocks:', itemBlocks.length)
  if (firstItem) {
    console.log('firstItem keys:', Object.keys(firstItem))
    console.log('firstItem (review-related fields):')
    for (const [k, v] of Object.entries(firstItem)) {
      if (typeof v !== 'object' && (k.toLowerCase().includes('review') || k.toLowerCase().includes('visit') || k.toLowerCase().includes('blog') || k.toLowerCase().includes('count')))
        console.log(`  ${k}: ${v}`)
    }
  } else {
    console.log('firstItem: null — findItemBlocks 탐색 실패')
    console.log('numeric review fields in streaming:', findNumericReviewFields(streaming).slice(0, 20))
  }
}

console.log(`\n=== 상세 페이지: place_id=${placeId} ===`)
const { status: ds, text: dtext } = await get(`https://m.place.naver.com/place/${placeId}/home`, 'https://m.place.naver.com/')
const dstreaming = parseStreamingState(dtext)
const numericFields = findNumericReviewFields(dstreaming)
const parsedResult = parseDetailReviewCounts(dtext)

console.log('\n[parseDetailReviewCounts 결과]', parsedResult)
console.log(`\n[streaming state 숫자 review 필드] (${numericFields.length}개)`)
for (const f of numericFields.slice(0, 30)) console.log(`  ${f.path} = ${f.val}`)

console.log('\n[streaming 최상위 블록 키]')
for (const [i, b] of dstreaming.entries()) {
  const keys = b && !Array.isArray(b) && typeof b === 'object' ? Object.keys(b).slice(0, 10) : null
  console.log(`  [${i}] ${Array.isArray(b) ? 'array' : typeof b}`, keys ?? '')
}

// 주요 패턴 raw 힌트
console.log('\n[regex 힌트 (방문자/블로그 관련 원문)]')
const hints = new Set()
for (const p of [/방문자\s*리뷰.{0,80}/g, /블로그\s*리뷰.{0,80}/g, /"(?:visitor|blog|review|place|count)[A-Za-z_]*"\s*:\s*[\d"]/gi]) {
  for (const m of dtext.matchAll(p)) hints.add(m[0].slice(0, 120))
}
for (const h of [...hints].slice(0, 20)) console.log(' ', h)
