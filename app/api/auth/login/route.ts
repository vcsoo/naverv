import { getRequestContext } from '@cloudflare/next-on-pages'
import { verifyPassword, signSession } from '../../../../src/shared/auth'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json() as any
    if (!username || !password) return Response.json({ error: '아이디와 비밀번호를 입력해주세요' }, { status: 400 })

    const { env } = getRequestContext()
    const db = (env as any).DB
    const user = await db
      .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .bind(username)
      .first<{ id: number; username: string; password_hash: string }>()

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return Response.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }, { status: 401 })
    }

    const token = await signSession({ user_id: user.id, username: user.username })
    const headers = new Headers()
    headers.set('Set-Cookie', `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
    return Response.json({ ok: true, username: user.username }, { headers })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
