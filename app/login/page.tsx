'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push('/')
      } else {
        const data = await res.json()
        setError(data.error || '로그인 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#f0f4f8' }}>
      <form onSubmit={handleLogin} style={{ background:'white', padding:'2rem', borderRadius:'14px', width:'320px', boxShadow:'0 4px 16px rgba(0,0,0,0.10)' }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontSize:'2rem' }}>🏆</div>
          <div style={{ fontWeight:700, fontSize:'1.05rem', marginTop:'0.4rem' }}>네이버 플레이스 순위 추적기</div>
        </div>
        {error && <div style={{ color:'#e53e3e', marginBottom:'1rem', fontSize:'0.875rem', textAlign:'center' }}>{error}</div>}
        <div style={{ marginBottom:'0.8rem' }}>
          <input
            type="text" placeholder="아이디" value={username} autoComplete="username"
            onChange={e => setUsername(e.target.value)}
            style={{ width:'100%', padding:'0.65rem 0.8rem', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'0.95rem', boxSizing:'border-box' }}
          />
        </div>
        <div style={{ marginBottom:'1.2rem' }}>
          <input
            type="password" placeholder="비밀번호" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
            style={{ width:'100%', padding:'0.65rem 0.8rem', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'0.95rem', boxSizing:'border-box' }}
          />
        </div>
        <button type="submit" disabled={loading}
          style={{ width:'100%', padding:'0.75rem', background:'#03C75A', color:'white', border:'none', borderRadius:'8px', fontSize:'1rem', fontWeight:700, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
