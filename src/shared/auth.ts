import { SignJWT, jwtVerify } from 'jose'

export type SessionPayload = { user_id: number; username: string }

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-please-set-SESSION_SECRET')
}

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(n => n.toString(16).padStart(2, '0')).join('')
  return `${hex(salt.buffer)}:${hex(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)))
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(n => n.toString(16).padStart(2, '0')).join('')
  return hex(hash) === hashHex
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  const token = match?.[1]
  if (!token) return null
  return verifySession(token)
}
