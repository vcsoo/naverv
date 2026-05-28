import { collectNaverPlaces, kstDateString, kstNowString, matchPlace, normalizeName, type NaverPlace } from './naver'

export type Env = {
  DB: D1Database
}

type D1Database = {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>
}

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export async function collectAndStore(db: D1Database, query: string, limit = 75) {
  const places = await collectNaverPlaces(query, limit)
  const collectedAt = kstNowString()
  const date = collectedAt.slice(0, 10)

  await db
    .prepare('DELETE FROM rankings WHERE search_query = ? AND substr(collected_at, 1, 10) = ?')
    .bind(query, date)
    .run()

  const statements = places.map((p) =>
    db
      .prepare(
        `INSERT INTO rankings (
          collected_at, search_query, rank, place_id, place_name, address, category,
          blog_review_count, visitor_review_count, total_review_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        collectedAt,
        query,
        p.rank,
        p.place_id,
        p.name,
        p.address,
        p.category,
        p.blog,
        p.visit,
        p.blog + p.visit,
      ),
  )

  for (let i = 0; i < statements.length; i += 40) {
    await db.batch(statements.slice(i, i + 40))
  }

  return { collected_at: collectedAt, count: places.length, places }
}

export async function latestCollectedAt(db: D1Database, query: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT collected_at FROM rankings WHERE search_query = ? ORDER BY collected_at DESC LIMIT 1')
    .bind(query)
    .first<{ collected_at: string }>()
  return row?.collected_at || null
}

export async function ensureRanking(db: D1Database, query: string, limit = 75) {
  const latest = await latestCollectedAt(db, query)
  if (latest && latest.slice(0, 10) === kstDateString()) return { collected_at: latest, collected: false }
  const run = await collectAndStore(db, query, limit)
  return { collected_at: run.collected_at, collected: true }
}

export async function getLatestRankingList(db: D1Database, query: string, limit = 100) {
  const collectedAt = await latestCollectedAt(db, query)
  if (!collectedAt) return null
  const { results } = await db
    .prepare(
      `SELECT rank, place_id, place_name, address, category,
              blog_review_count AS blog, visitor_review_count AS visit, total_review_count AS total,
              collected_at
       FROM rankings
       WHERE search_query = ? AND collected_at = ?
       ORDER BY rank ASC
       LIMIT ?`,
    )
    .bind(query, collectedAt, limit)
    .all<any>()
  return { collected_at: collectedAt, list: results }
}

export async function upsertTarget(db: D1Database, query: string, inputName: string, matchedName: string | null) {
  const now = kstNowString()
  const existing = await db
    .prepare('SELECT id FROM targets WHERE search_query = ? AND place_name_input = ? LIMIT 1')
    .bind(query, inputName)
    .first<{ id: number }>()

  if (existing) {
    await db
      .prepare('UPDATE targets SET matched_name = ?, last_searched_at = ? WHERE id = ?')
      .bind(matchedName, now, existing.id)
      .run()
  } else {
    await db
      .prepare(
        `INSERT INTO targets (search_query, place_name_input, matched_name, first_added_at, last_searched_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(query, inputName, matchedName, now, now)
      .run()
  }
}

export async function findPlaceInLatest(db: D1Database, query: string, placeName: string) {
  const ranking = await getLatestRankingList(db, query, 100)
  if (!ranking) return null
  const places: NaverPlace[] = ranking.list.map((r: any) => ({
    rank: r.rank,
    place_id: r.place_id || '',
    name: r.place_name,
    address: r.address || '',
    category: r.category || '',
    blog: r.blog || 0,
    visit: r.visit || 0,
  }))
  const matched = matchPlace(places, placeName)
  return matched ? { matched, collected_at: ranking.collected_at, total_collected: ranking.list.length } : { matched: null, collected_at: ranking.collected_at, total_collected: ranking.list.length }
}

export async function getPlaceHistory(db: D1Database, query: string, matched: NaverPlace) {
  const { results } = await db
    .prepare(
      `SELECT substr(collected_at, 1, 10) AS date, collected_at, rank,
              blog_review_count AS blog, visitor_review_count AS visit
       FROM rankings
       WHERE search_query = ? AND (place_id = ? OR place_name = ?)
       ORDER BY collected_at DESC`,
    )
    .bind(query, matched.place_id, matched.name)
    .all<any>()

  const seen = new Set<string>()
  const history = []
  for (const row of results) {
    if (seen.has(row.date)) continue
    seen.add(row.date)
    history.push({ date: row.date, rank: row.rank, blog: row.blog || 0, visit: row.visit || 0 })
  }
  return history.reverse()
}

export async function listActiveTargets(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT id, search_query, place_name_input, matched_name, first_added_at, last_searched_at
       FROM targets
       ORDER BY last_searched_at DESC`,
    )
    .all<any>()
  return results
}

export async function collectActiveTargets(db: D1Database) {
  const targets = await listActiveTargets(db)
  const uniqueQueries = Array.from(new Set(targets.map((t: any) => t.search_query)))
  const results = []
  for (const query of uniqueQueries) {
    try {
      results.push(await collectAndStore(db, query, 75))
    } catch (e: any) {
      results.push({ query, error: e?.message || String(e) })
    }
  }
  return { ok: true, ran: results.length, results }
}
