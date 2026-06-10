import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo/|login).*)'],
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/auth')) return NextResponse.next()
  if (request.nextUrl.pathname === '/api/init') return NextResponse.next()

  const token = request.cookies.get('session')?.value
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-please-set-SESSION_SECRET')
      await jwtVerify(token, secret)
      return NextResponse.next()
    } catch {}
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}
