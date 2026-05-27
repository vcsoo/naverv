import { collectActiveTargets, type Env } from '../../src/shared/db'

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const configuredSecret = (context.env as any).CRON_SECRET
    if (configuredSecret) {
      const auth = context.request.headers.get('authorization') || ''
      if (auth !== `Bearer ${configuredSecret}`) {
        return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
      }
    }

    const result = await collectActiveTargets(context.env.DB)
    return Response.json(result)
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  return onRequestPost(context)
}
