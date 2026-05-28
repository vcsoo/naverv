import { getRequestContext } from '@cloudflare/next-on-pages'
import { listActiveTargets } from '../../../src/shared/db'

export const runtime = 'edge'

export async function GET() {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB
    const targets = await listActiveTargets(db)
    return Response.json(targets)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { env } = getRequestContext()
    const db = (env as any).DB
    const { searchParams } = new URL(request.url)
    await db.prepare(
      'DELETE FROM targets WHERE search_query = ? AND place_name_input = ?'
    ).bind(searchParams.get('query') || '', searchParams.get('place') || '').run()
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
