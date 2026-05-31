import { getRequestContext } from '@cloudflare/next-on-pages'
import { hashPassword, getSessionFromRequest } from '../../../../src/shared/auth'
import { kstNowString } from '../../../../src/shared/naver'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (session?.username !== 'muamong') {
      return Response.json({ error: '권한 없음' }, { status: 403 })
    }

    const { username, password } = await request.json() as any
    if (!username || !password) {
      return Response.json({ error: 'username과 password 필요' }, { status: 400 })
    }

    const { env } = getRequestContext()
    const db = (env as any).DB

    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
    if (existing) return Response.json({ error: '이미 존재하는 아이디' }, { status: 409 })

    const hash = await hashPassword(password)
    await db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
      .bind(username, hash, kstNowString()).run()

    return Response.json({ ok: true, username })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
