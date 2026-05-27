import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function GET() {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB

    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS rankings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collected_at TEXT NOT NULL,
        search_query TEXT NOT NULL,
        rank INTEGER NOT NULL,
        place_id TEXT DEFAULT '',
        place_name TEXT NOT NULL,
        address TEXT DEFAULT '',
        category TEXT DEFAULT '',
        blog_review_count INTEGER DEFAULT 0,
        visitor_review_count INTEGER DEFAULT 0,
        total_review_count INTEGER DEFAULT 0
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_query TEXT NOT NULL,
        place_name_input TEXT NOT NULL,
        matched_name TEXT,
        first_added_at TEXT NOT NULL,
        last_searched_at TEXT NOT NULL,
        UNIQUE(search_query, place_name_input)
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_qd ON rankings(search_query, collected_at)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_nm ON rankings(place_name)`),
    ])

    return Response.json({ ok: true, message: 'DB 초기화 완료' })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
