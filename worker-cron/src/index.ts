import { collectActiveTargets, type Env } from '../../src/shared/db'

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await collectActiveTargets(env.DB)
  },

  async fetch(_request: Request, env: Env) {
    const result = await collectActiveTargets(env.DB)
    return Response.json(result)
  },
}

type ScheduledEvent = {
  cron: string
  scheduledTime: number
}

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}
