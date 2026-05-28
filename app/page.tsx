'use client'
import { useState, useEffect } from 'react'

const WD = ['일', '월', '화', '수', '목', '금', '토']

type H = { date: string; rank: number; blog: number; visit: number }
type Row = {
  key: string
  search_query: string
  place_name_input: string
  matched_name: string | null
  history: H[]
  loading: boolean
  error?: string
}

export default function Home() {
  const [regQuery, setRegQuery] = useState('')
  const [regPlace, setRegPlace] = useState('')
  const [registering, setRegistering] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [dates, setDates] = useState<string[]>([])

  useEffect(() => { loadAll() }, [])

  function mkKey(t: any) { return `${t.search_query}||${t.place_name_input}` }

  function calcDates(rowList: Row[]) {
    const s = new Set<string>()
    for (const r of rowList) for (const h of r.history) s.add(h.date)
    setDates([...s].sort().reverse())
  }

  async function fetchHistory(query: string, place: string) {
    try {
      const r = await fetch(`/api/history?query=${encodeURIComponent(query)}&place=${encodeURIComponent(place)}`)
      if (!r.ok) return null
      return await r.json()
    } catch { return null }
  }

  async function loadAll() {
    const r = await fetch('/api/targets')
    const tList: any[] = await r.json()

    if (!Array.isArray(tList) || tList.length === 0) {
      setRows([])
      setDates([])
      return
    }

    setRows(tList.map(t => ({
      key: mkKey(t), search_query: t.search_query,
      place_name_input: t.place_name_input, matched_name: t.matched_name,
      history: [], loading: true,
    })))

    const done: Row[] = []
    for (const t of tList) {
      const data = await fetchHistory(t.search_query, t.matched_name || t.place_name_input)
      const row: Row = {
        key: mkKey(t), search_query: t.search_query,
        place_name_input: t.place_name_input,
        matched_name: data?.matched_name || t.matched_name,
        history: data?.history || [],
        loading: false,
        error: data?.not_found ? '순위권 밖' : (data === null ? '로드 실패' : undefined),
      }
      done.push(row)
      setRows(prev => prev.map(r => r.key === row.key ? row : r))
    }
    calcDates(done)
  }

  async function register() {
    const q = regQuery.trim(), p = regPlace.trim()
    if (!q || !p) { alert('검색어와 상호명을 모두 입력해주세요'); return }
    if (rows.length >= 10) { alert('최대 10개까지 등록 가능합니다'); return }

    setRegistering(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_query: q, place_name: p }),
      })
      const data = await res.json()
      if (data.not_found) {
        alert(`"${p}"을(를) "${q}" 검색결과 ${data.total_collected}위 내에서 찾을 수 없습니다.`)
        return
      }
      if (data.error) { alert('오류: ' + data.error); return }
      setRegQuery(''); setRegPlace('')
      await loadAll()
    } catch { alert('오류가 발생했습니다. 다시 시도해주세요.') }
    finally { setRegistering(false) }
  }

  async function del(row: Row) {
    const nm = row.matched_name || row.place_name_input
    if (!confirm(`"${row.search_query} / ${nm}" 삭제하시겠습니까?`)) return
    await fetch(
      `/api/targets?query=${encodeURIComponent(row.search_query)}&place=${encodeURIComponent(row.place_name_input)}`,
      { method: 'DELETE' }
    )
    const next = rows.filter(r => r.key !== row.key)
    setRows(next)
    calcDates(next)
  }

  function rCls(r: number) { return r === 1 ? 'r1' : r <= 3 ? 'r3' : r <= 10 ? 'r10' : 'rn' }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

  function renderCell(row: Row, date: string) {
    const h = row.history.find(x => x.date === date)
    if (!h) return <td key={date} className="dc dc-nil"><span>—</span></td>

    const sorted = [...row.history].sort((a, b) => a.date < b.date ? -1 : 1)
    const idx = sorted.findIndex(x => x.date === date)
    const prev = idx > 0 ? sorted[idx - 1] : null

    let chg: React.ReactNode
    if (!prev) {
      chg = <span className="rc rc-nw">NEW</span>
    } else {
      const d = prev.rank - h.rank
      chg = d > 0 ? <span className="rc rc-up">▲{d}</span>
          : d < 0 ? <span className="rc rc-dn">▼{Math.abs(d)}</span>
          : <span className="rc rc-sm">━</span>
    }

    return (
      <td key={date} className="dc">
        <div className={`rv ${rCls(h.rank)}`}>{h.rank}</div>
        {chg}
        <div className="cbl">블 {h.blog.toLocaleString()}</div>
        <div className="cvs">방 {h.visit.toLocaleString()}</div>
      </td>
    )
  }

  return (
    <>
      <style>{`
        :root{--g:#03c75a;--gd:#00a045;--gb:#e8faf1;--blue:#1967d2;--red:#e8192c;--org:#ff9500;--gold:#e6aa00;--bg:#f0f4f8;--surf:#fff;--bdr:#e2e8f0;--txt:#1a2332;--mut:#64748b;--sub:#94a3b8;--r:12px}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--txt);font-size:14px}
        .hdr{background:linear-gradient(135deg,#03c75a,#00b44a 45%,#0597d8);padding:14px 24px;position:sticky;top:0;z-index:200}
        .hdr h1{color:#fff;font-size:1.1rem;font-weight:700}
        .hdr p{color:rgba(255,255,255,.75);font-size:.72rem;margin-top:2px}
        .wrap{max-width:1400px;margin:0 auto;padding:20px 16px}
        .regcard{background:var(--surf);border-radius:var(--r);padding:18px 22px;box-shadow:0 2px 14px rgba(0,0,0,.07);margin-bottom:18px;border:1px solid rgba(3,199,90,.12)}
        .regrow{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
        .fg label{display:block;font-size:.7rem;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
        .fg input{width:100%;height:42px;padding:0 12px;border:2px solid var(--bdr);border-radius:8px;font-size:.88rem;outline:none;transition:.15s;background:#fff}
        .fg input:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(3,199,90,.08)}
        .fg input:disabled{background:#f7fafc;color:var(--sub)}
        .btn-main{height:42px;padding:0 22px;background:linear-gradient(135deg,var(--g),var(--gd));color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:.15s}
        .btn-main:hover{opacity:.9}.btn-main:disabled{opacity:.5;cursor:not-allowed}
        .reghint{margin-top:8px;font-size:.71rem;color:var(--sub)}
        .board{background:var(--surf);border-radius:var(--r);box-shadow:0 2px 14px rgba(0,0,0,.07);overflow:hidden;border:1px solid var(--bdr)}
        .board-hdr{padding:11px 18px;border-bottom:1px solid var(--bdr);background:#fafbfc;display:flex;align-items:center;justify-content:space-between}
        .board-hdr h2{font-size:.88rem;font-weight:700}
        .btn-sm{padding:4px 10px;border:1.5px solid var(--bdr);background:#fff;border-radius:6px;font-size:.72rem;font-weight:600;cursor:pointer;color:var(--mut);transition:.12s}
        .btn-sm:hover{border-color:var(--g);color:var(--gd)}
        .dtw{overflow-x:auto}
        .dt{border-collapse:collapse;width:max-content;min-width:100%}
        .dt thead th,.dt tbody td{white-space:nowrap}
        .rl-hdr{position:sticky;left:0;z-index:20;background:#f7fafc;padding:10px 14px;text-align:left;border-right:2px solid var(--bdr);border-bottom:2px solid var(--bdr);font-size:.7rem;font-weight:600;color:var(--mut);text-transform:uppercase;min-width:176px}
        .dhdr{padding:8px 6px;border-bottom:2px solid var(--bdr);border-right:1px solid #edf2f7;min-width:86px;text-align:center}
        .dh-d{font-family:monospace;font-size:.78rem;font-weight:700;color:var(--txt)}
        .dh-w{font-size:.65rem;color:var(--sub);margin-top:1px}
        .dhdr.today{background:#f0fff8}.dhdr.today .dh-d{color:var(--gd)}
        .dhdr.sun .dh-d{color:var(--red)}.dhdr.sat .dh-d{color:var(--blue)}
        .rl-cell{position:sticky;left:0;z-index:10;background:#fff;padding:10px 14px;border-right:2px solid var(--bdr);border-bottom:1px solid #f0f4f8;min-width:176px;max-width:200px;vertical-align:top}
        .rl-cell:hover{background:#f8fffb}
        .rl-q{font-size:.68rem;color:var(--sub);font-weight:500;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis}
        .rl-p{font-size:.84rem;font-weight:700;color:var(--txt);margin-bottom:5px;overflow:hidden;text-overflow:ellipsis}
        .rl-extra{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .spin-row{display:flex;align-items:center;gap:5px;font-size:.67rem;color:var(--sub)}
        .spin-sm{width:12px;height:12px;border:2px solid #e0e0e0;border-top-color:var(--g);border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0}
        .rl-err{font-size:.67rem;color:var(--red)}
        .btn-del{padding:2px 7px;border:1.5px solid #e2e8f0;color:var(--sub);background:#fff;border-radius:5px;font-size:.67rem;cursor:pointer;transition:.12s}
        .btn-del:hover{border-color:var(--red);color:var(--red)}
        .dc{padding:8px 6px;border-right:1px solid #f0f4f8;border-bottom:1px solid #f0f4f8;text-align:center;vertical-align:middle;min-width:86px}
        .dc-nil{color:#c8d6e0;font-size:.82rem;vertical-align:middle}
        .rv{font-family:monospace;font-size:.88rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;margin:0 auto}
        .rv.r1{background:var(--gold);color:#5a3800}.rv.r3{background:var(--org);color:#fff}
        .rv.r10{background:var(--gb);color:var(--gd)}.rv.rn{background:#f0f4f8;color:var(--txt)}
        .rc{font-size:.64rem;font-weight:700;display:block;margin-top:2px}
        .rc-up{color:var(--red)}.rc-dn{color:var(--blue)}.rc-sm{color:var(--sub)}.rc-nw{color:var(--g)}
        .cbl{font-size:.64rem;color:var(--gd);margin-top:4px}
        .cvs{font-size:.64rem;color:var(--blue);margin-top:1px}
        .empty-board{background:var(--surf);border-radius:var(--r);padding:52px;text-align:center;color:var(--sub);box-shadow:0 2px 14px rgba(0,0,0,.07)}
        .empty-board .ico{font-size:2.2rem;margin-bottom:10px}
        .empty-board p{font-size:.84rem;line-height:1.6}
        .overlay{display:flex;position:fixed;inset:0;background:rgba(255,255,255,.92);z-index:999;flex-direction:column;align-items:center;justify-content:center;gap:14px}
        .spin{width:46px;height:46px;border:4px solid #e0e0e0;border-top-color:var(--g);border-radius:50%;animation:spin .7s linear infinite}
        .smsg{color:var(--mut);font-size:.88rem;text-align:center;line-height:1.6}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:640px){.regrow{grid-template-columns:1fr}}
      `}</style>

      {registering && (
        <div className="overlay">
          <div className="spin"/>
          <div className="smsg">
            수집 중... 잠시만 기다려주세요<br/>
            <small style={{color:'var(--sub)',fontSize:'.76rem'}}>(최초 조회 시 30초~2분 소요)</small>
          </div>
        </div>
      )}

      <header className="hdr">
        <h1>🏆 네이버 플레이스 순위 추적기</h1>
        <p>매일 11:30 자동수집 · 최대 10개 등록 · 삭제 전까지 유지</p>
      </header>

      <div className="wrap">
        <div className="regcard">
          <div className="regrow">
            <div className="fg">
              <label>검색어 (키워드)</label>
              <input
                value={regQuery}
                onChange={e => setRegQuery(e.target.value)}
                placeholder="예) 검단신도시미용실"
                onKeyDown={e => e.key === 'Enter' && register()}
                disabled={registering}
              />
            </div>
            <div className="fg">
              <label>상호명</label>
              <input
                value={regPlace}
                onChange={e => setRegPlace(e.target.value)}
                placeholder="예) 르아헤어"
                onKeyDown={e => e.key === 'Enter' && register()}
                disabled={registering}
              />
            </div>
            <button className="btn-main" onClick={register} disabled={registering}>
              등록하기 →
            </button>
          </div>
          <p className="reghint">
            ✓ 등록 후 삭제 전까지 계속 유지됩니다 · 최대 10개 ·
            순위권에 없으면 등록되지 않습니다
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="empty-board">
            <div className="ico">📋</div>
            <p>
              등록된 항목이 없습니다.<br/>
              위 폼에서 키워드와 상호명을 입력해 등록해주세요.
            </p>
          </div>
        ) : (
          <div className="board">
            <div className="board-hdr">
              <h2>
                📊 순위 대시보드&nbsp;
                <span style={{fontSize:'.7rem',color:'var(--sub)',fontWeight:400}}>
                  {rows.length}개 등록
                </span>
              </h2>
              <button className="btn-sm" onClick={loadAll}>↻ 새로고침</button>
            </div>
            <div className="dtw">
              <table className="dt">
                <thead>
                  <tr>
                    <th className="rl-hdr">키워드 / 업체명</th>
                    {dates.map(d => {
                      const dt = new Date(d + 'T00:00:00')
                      const mm = String(dt.getMonth() + 1).padStart(2, '0')
                      const dd = String(dt.getDate()).padStart(2, '0')
                      const cls = 'dhdr' + (d === today ? ' today' : dt.getDay() === 0 ? ' sun' : dt.getDay() === 6 ? ' sat' : '')
                      return (
                        <th key={d} className={cls}>
                          <div className="dh-d">{mm}.{dd}</div>
                          <div className="dh-w">{WD[dt.getDay()]}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.key}>
                      <td className="rl-cell">
                        <div className="rl-q">{row.search_query}</div>
                        <div className="rl-p">{row.matched_name || row.place_name_input}</div>
                        <div className="rl-extra">
                          {row.loading
                            ? <span className="spin-row"><span className="spin-sm"/><span>로딩중...</span></span>
                            : row.error
                              ? <span className="rl-err">{row.error}</span>
                              : null
                          }
                          <button className="btn-del" onClick={() => del(row)}>✕ 삭제</button>
                        </div>
                      </td>
                      {dates.map(d => renderCell(row, d))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
