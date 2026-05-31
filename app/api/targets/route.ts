import { getRequestContext } from '@cloudflare/next-on-pages'
import { listUserTargets } from '../../../src/shared/db'
import { getSessionFromRequest } from '../../../src/shared/auth'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const { env } = getRequestContext()
    const db = (env as any).DB
    const targets = await listUserTargets(db, session.user_id)
    return Response.json(targets)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const { env } = getRequestContext()
    const db = (env as any).DB
    const { searchParams } = new URL(request.url)
    await db
      .prepare('DELETE FROM targets WHERE search_query = ? AND place_name_input = ? AND user_id = ?')
      .bind(searchParams.get('query') || '', searchParams.get('place') || '', session.user_id)
      .run()
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
