export const runtime = 'edge'

export async function POST() {
  const headers = new Headers()
  headers.set('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
  return Response.json({ ok: true }, { headers })
}
