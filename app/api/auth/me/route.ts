import { getSessionFromRequest } from '../../../../src/shared/auth'

export const runtime = 'edge'

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session) return Response.json({ user: null }, { status: 401 })
  return Response.json({ user: { id: session.user_id, username: session.username } })
}
