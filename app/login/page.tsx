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
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR','Malgun Gothic',-apple-system,sans-serif;background:#fff}
        .login-screen{display:flex;position:fixed;inset:0;background:#fff;justify-content:center;align-items:center;flex-direction:column;padding:24px}
        .login-box{width:340px;max-width:100%;display:flex;flex-direction:column;align-items:center;gap:20px}
        .login-logo{height:36px;width:auto;margin-bottom:8px}
        .login-title{font-size:1.15rem;font-weight:700;color:#111;text-align:center;letter-spacing:-.02em}
        .login-sub{font-size:.85rem;color:#555;text-align:center;margin-top:4px}
        .login-fields{width:100%;display:flex;flex-direction:column;gap:12px}
        .login-fields input{width:100%;padding:12px 16px;border:1px solid #e0e0e0;border-radius:8px;font-size:.95rem;font-family:inherit;outline:none;transition:.15s}
        .login-fields input:focus{border-color:#111;box-shadow:0 0 0 3px rgba(0,0,0,.08)}
        .login-error{font-size:.8rem;color:#c0392b;min-height:1.1rem;text-align:center}
        .login-btn{width:100%;padding:13px 0;background:#111;color:#fff;border:none;border-radius:8px;font-size:.95rem;font-family:inherit;font-weight:700;cursor:pointer;transition:.15s;letter-spacing:-.01em}
        .login-btn:hover{background:#333}
        .login-btn:disabled{opacity:.6;cursor:not-allowed}
        @media(max-width:380px){
          .login-logo{height:30px}
          .login-title{font-size:1.05rem}
        }
      `}</style>
      <div className="login-screen">
        <form onSubmit={handleLogin} className="login-box">
          <img className="login-logo" src="/logo/wordmark.png" alt="MUAMONG" />
          <div>
            <div className="login-title">네이버 플레이스 순위 추적기</div>
            <div className="login-sub">로그인이 필요합니다</div>
          </div>
          <div className="login-fields">
            <input
              type="text" placeholder="아이디" value={username} autoComplete="username"
              onChange={e => setUsername(e.target.value)}
            />
            <input
              type="password" placeholder="비밀번호" value={password} autoComplete="current-password"
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div className="login-error">{error}</div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </>
  )
}
