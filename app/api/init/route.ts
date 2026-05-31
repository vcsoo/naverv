import { getRequestContext } from '@cloudflare/next-on-pages'
import { hashPassword } from '../../../src/shared/auth'

export const runtime = 'edge'

export async function GET() {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB

    // 기본 테이블 생성
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
      db.prepare(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_qd ON rankings(search_query, collected_at)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_nm ON rankings(place_name)`),
    ])

    // targets 테이블에 user_id 컬럼 추가 (이미 있으면 무시)
    try {
      await db.prepare('ALTER TABLE targets ADD COLUMN user_id INTEGER REFERENCES users(id)').run()
    } catch { /* 이미 존재 */ }

    // 초기 관리자 계정 생성 (없을 때만)
    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind('muamong').first()
    let userId: number | null = existing?.id ?? null

    if (!existing) {
      const hash = await hashPassword('muamong')
      const now = new Date().toISOString().slice(0, 19)
      await db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').bind('muamong', hash, now).run()
      const created = await db.prepare('SELECT id FROM users WHERE username = ?').bind('muamong').first<{ id: number }>()
      userId = created?.id ?? null
    }

    // user_id 없는 기존 타겟을 muamong 계정으로 이관
    let migrated = 0
    if (userId) {
      const result = await db.prepare('UPDATE targets SET user_id = ? WHERE user_id IS NULL').bind(userId).run() as any
      migrated = result?.meta?.changes ?? 0
    }

    return Response.json({ ok: true, message: 'DB 초기화 완료', migrated_targets: migrated })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
