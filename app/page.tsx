'use client'
import { useState, useEffect, Fragment } from 'react'

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
type SingleResult = {
  matched_name?: string; place_id?: string; rank?: number; prev_rank?: number | null
  blog?: number; visit?: number; collected_at?: string
  not_found?: boolean; total_collected?: number; history?: H[]
}
type ListItem = {
  rank: number; place_id?: string; place_name: string; category: string
  blog: number; visit: number; address: string
}
type ListResult = { list: ListItem[]; collected_at: string }

export default function Home() {
  const [srchQ, setSrchQ] = useState('')
  const [srchP, setSrchP] = useState('')
  const [searching, setSearching] = useState(false)
  const [doneQ, setDoneQ] = useState('')
  const [doneP, setDoneP] = useState('')
  const [single, setSingle] = useState<SingleResult | null>(null)
  const [listRes, setListRes] = useState<ListResult | null>(null)

  const [rows, setRows] = useState<Row[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [dayFilter, setDayFilter] = useState<7 | 14 | 30>(7)
  const [cardDate, setCardDate] = useState<string>('')
  const [registering, setRegistering] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

  useEffect(() => { loadDashboard() }, [])
  useEffect(() => { if (window.innerWidth < 700) setViewMode('card') }, [])

  const mkKey = (sq: string, pi: string) => `${sq}||${pi}`
  const rCls  = (r: number) => r === 1 ? 'r1' : r <= 3 ? 'r3' : r <= 10 ? 'r10' : 'rn'
  const tCls  = (r: number) => r === 1 ? 't1' : r <= 3 ? 't3' : r <= 10 ? 't10' : ''

  // ── 공통 변동 표시 ────────────────────────────────────────
  const chgSpan = (diff: number | null, isNew?: boolean): React.ReactNode => {
    if (isNew)         return <span className="rc rc-nw">N</span>
    if (diff === null) return null
    if (diff > 0)      return <span className="rc rc-up">▲{diff.toLocaleString()}</span>
    if (diff < 0)      return <span className="rc rc-dn">▼{Math.abs(diff).toLocaleString()}</span>
    return                    <span className="rc rc-sm">━</span>
  }

  function calcDates(rowList: Row[]) {
    const s = new Set<string>()
    for (const r of rowList) for (const h of r.history) s.add(h.date)
    const sorted = [...s].sort().reverse()
    setDates(sorted)
    // cardDate를 최신 날짜로 초기화 (아직 없을 때만)
    setCardDate(prev => prev || sorted[0] || today)
  }

  async function fetchHistory(query: string, place: string) {
    try {
      const r = await fetch(`/api/history?query=${encodeURIComponent(query)}&place=${encodeURIComponent(place)}`)
      return r.ok ? await r.json() : null
    } catch { return null }
  }

  async function loadDashboard() {
    const r = await fetch('/api/targets')
    const tList: any[] = await r.json()
    if (!Array.isArray(tList) || !tList.length) { setRows([]); setDates([]); return }

    setRows(tList.map(t => ({
      key: mkKey(t.search_query, t.place_name_input),
      search_query: t.search_query,
      place_name_input: t.place_name_input,
      matched_name: t.matched_name,
      history: [], loading: true,
    })))

    const done: Row[] = []
    for (const t of tList) {
      const data = await fetchHistory(t.search_query, t.matched_name || t.place_name_input)
      const row: Row = {
        key: mkKey(t.search_query, t.place_name_input),
        search_query: t.search_query,
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

  async function search() {
    const q = srchQ.trim()
    if (!q) { alert('검색어를 입력해주세요'); return }
    setSearching(true); setSingle(null); setListRes(null)
    try {
      const p = srchP.trim()
      const url = `/api/lookup?query=${encodeURIComponent(q)}${p ? `&place=${encodeURIComponent(p)}` : ''}`
      const data = await fetch(url).then(r => r.json())
      setDoneQ(q); setDoneP(p)
      if (p) setSingle(data); else setListRes(data)
    } catch { alert('오류가 발생했습니다. 다시 시도해주세요.') }
    finally { setSearching(false) }
  }

  async function registerItem(sq: string, pi: string, mn: string | null) {
    if (rows.length >= 10) { alert('최대 10개까지 등록 가능합니다'); return }
    setRegistering(mkKey(sq, pi))
    try {
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_query: sq, place_name_input: pi, matched_name: mn }),
      })
      await loadDashboard()
    } catch { alert('등록 중 오류가 발생했습니다.') }
    finally { setRegistering(null) }
  }

  async function del(row: Row) {
    const nm = row.matched_name || row.place_name_input
    if (!confirm(`"${row.search_query} / ${nm}" 삭제하시겠습니까?`)) return
    await fetch(`/api/targets?query=${encodeURIComponent(row.search_query)}&place=${encodeURIComponent(row.place_name_input)}`, { method: 'DELETE' })
    const next = rows.filter(r => r.key !== row.key)
    setRows(next); calcDates(next)
  }

  const visibleDates = dates.slice(0, dayFilter)

  const groups: [string, Row[]][] = []
  const seenQ = new Set<string>()
  for (const row of rows) {
    if (!seenQ.has(row.search_query)) {
      seenQ.add(row.search_query)
      groups.push([row.search_query, rows.filter(r => r.search_query === row.search_query)])
    }
  }

  function isRegistered(sq: string, pn: string) {
    return rows.some(r => r.search_query === sq && (r.matched_name === pn || r.place_name_input === pn))
  }

  function chgBadge(cur: number, prev: number | null | undefined) {
    if (prev == null) return <span className="badge badge-nw">NEW</span>
    const d = prev - cur
    return d > 0
      ? <span className="badge badge-up">▲{d} 상승</span>
      : d < 0
        ? <span className="badge badge-dn">▼{Math.abs(d)} 하락</span>
        : <span className="badge badge-sm">━ 유지</span>
  }

  // ── 표 뷰: 셀 렌더링 ────────────────────────────────────
  function renderCell(row: Row, date: string) {
    const h = row.history.find(x => x.date === date)
    if (!h) return <td key={date} className="dc dc-nil">—</td>

    const sorted = [...row.history].sort((a, b) => a.date < b.date ? -1 : 1)
    const idx  = sorted.findIndex(x => x.date === date)
    const prev = idx > 0 ? sorted[idx - 1] : null

    const rankDiff  = prev ? prev.rank  - h.rank  : null
    const blogDiff  = prev ? h.blog  - prev.blog  : null
    const visitDiff = prev ? h.visit - prev.visit : null

    return (
      <td key={date} className="dc">
        <div className="dc-rk">
          <div className={`rv ${rCls(h.rank)}`}>{h.rank}</div>
          {chgSpan(rankDiff, prev === null)}
        </div>
        <div className="dc-stat">
          <span className="dc-lbl">블</span>
          <span className="dc-num blog">{h.blog.toLocaleString()}</span>
          {chgSpan(blogDiff)}
        </div>
        <div className="dc-stat">
          <span className="dc-lbl">방</span>
          <span className="dc-num visit">{h.visit.toLocaleString()}</span>
          {chgSpan(visitDiff)}
        </div>
      </td>
    )
  }

  // ── 카드 뷰: 선택 날짜 기준 렌더링 ──────────────────────
  function renderCard(row: Row, selDate: string) {
    const sorted = [...row.history].sort((a, b) => a.date < b.date ? -1 : 1)
    const idx    = sorted.findIndex(x => x.date === selDate)
    const h      = idx >= 0 ? sorted[idx] : null
    const prev   = idx > 0 ? sorted[idx - 1] : null
    const last7  = sorted.slice(-7)

    const rankDiff  = (h && prev) ? prev.rank  - h.rank  : null
    const blogDiff  = (h && prev) ? h.blog  - prev.blog  : null
    const visitDiff = (h && prev) ? h.visit - prev.visit : null

    return (
      <div key={row.key} className="crd">
        {/* 업체명 + 삭제 */}
        <div className="crd-top">
          <span className="crd-name">{row.matched_name || row.place_name_input}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {row.loading && <span className="spin-sm" />}
            {row.error   && <span className="rl-err">{row.error}</span>}
            <button className="btn-del" onClick={() => del(row)}>✕</button>
          </div>
        </div>

        {h ? (
          <>
            {/* 선택 날짜 핵심 수치 */}
            <div className="crd-main">
              <div className="crd-rk-wrap">
                <span className={`crd-rank ${tCls(h.rank)}`}>{h.rank}위</span>
                {chgSpan(rankDiff, !prev)}
              </div>
              <div className="crd-counts">
                <div className="crd-cnt">
                  <span className="crd-lbl">블</span>
                  <span className="crd-val blog">{h.blog.toLocaleString()}</span>
                  {chgSpan(blogDiff)}
                </div>
                <div className="crd-cnt">
                  <span className="crd-lbl">방</span>
                  <span className="crd-val visit">{h.visit.toLocaleString()}</span>
                  {chgSpan(visitDiff)}
                </div>
              </div>
            </div>

            {/* 최근 7일 미니 순위 (선택 날짜 하이라이트) */}
            {last7.length > 1 && (
              <div className="crd-hist">
                {last7.map((hh, i) => {
                  const dt = new Date(hh.date + 'T00:00:00')
                  const mm = String(dt.getMonth() + 1).padStart(2, '0')
                  const dd = String(dt.getDate()).padStart(2, '0')
                  const prevH = i > 0 ? last7[i - 1] : null
                  const rd = prevH ? prevH.rank - hh.rank : null
                  const isSel = hh.date === selDate
                  return (
                    <div key={hh.date}
                      className={`crd-day${isSel ? ' crd-sel' : ''}`}
                      onClick={() => setCardDate(hh.date)}
                      style={{ cursor: 'pointer' }}>
                      <div className="crd-day-lbl">{hh.date === today ? '오늘' : `${mm}.${dd}`}</div>
                      <div className={`mob-rv ${rCls(hh.rank)}`}>{hh.rank}</div>
                      <div className={`mob-chg ${rd === null ? 'rc-nw' : rd > 0 ? 'rc-up' : rd < 0 ? 'rc-dn' : 'rc-sm'}`}>
                        {rd === null ? 'N' : rd > 0 ? `▲${rd}` : rd < 0 ? `▼${Math.abs(rd)}` : '━'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="crd-nodata">선택 날짜 데이터 없음</div>
        )}
      </div>
    )
  }

  // ── 날짜 포맷 헬퍼 ───────────────────────────────────────
  function fmtDate(d: string) {
    if (d === today) return '오늘'
    const dt = new Date(d + 'T00:00:00')
    return `${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      <style>{`
        :root{--g:#03c75a;--gd:#00a045;--gb:#e8faf1;--blue:#1967d2;--red:#e8192c;--org:#ff9500;--gold:#e6aa00;--bg:#f0f4f8;--surf:#fff;--bdr:#e2e8f0;--txt:#1a2332;--mut:#64748b;--sub:#94a3b8;--r:12px}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--txt);font-size:14px}

        .hdr{background:linear-gradient(135deg,#03c75a,#00b44a 45%,#0597d8);padding:14px 24px;position:sticky;top:0;z-index:200}
        .hdr h1{color:#fff;font-size:1.05rem;font-weight:700}
        .hdr p{color:rgba(255,255,255,.75);font-size:.7rem;margin-top:2px}

        .wrap{max-width:1400px;margin:0 auto;padding:18px 16px;display:flex;flex-direction:column;gap:16px}
        .card{background:var(--surf);border-radius:var(--r);padding:18px 22px;box-shadow:0 2px 12px rgba(0,0,0,.07);border:1px solid rgba(0,0,0,.05)}
        .card-title{font-size:.9rem;font-weight:700;margin-bottom:14px}

        /* 검색폼 */
        .srow{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
        .fg label{display:block;font-size:.7rem;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px}
        .hint-lbl{font-size:.64rem;font-weight:400;color:var(--sub);text-transform:none;margin-left:3px}
        .fg input{width:100%;height:42px;padding:0 12px;border:2px solid var(--bdr);border-radius:8px;font-size:.88rem;outline:none;transition:.15s;background:#fff}
        .fg input:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(3,199,90,.08)}
        .fg input:disabled{background:#f7fafc;color:var(--sub)}
        .btn-search{height:42px;padding:0 20px;background:linear-gradient(135deg,var(--g),var(--gd));color:#fff;border:none;border-radius:8px;font-size:.88rem;font-weight:700;cursor:pointer;white-space:nowrap}
        .btn-search:hover:not(:disabled){opacity:.9}.btn-search:disabled{opacity:.5;cursor:not-allowed}
        .srch-info{margin-top:10px;font-size:.72rem;color:var(--sub);display:flex;align-items:center;gap:6px}
        .srch-spin{width:12px;height:12px;border:2px solid #e0e0e0;border-top-color:var(--g);border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0;display:inline-block}

        /* 단일 결과 카드 */
        .res-card{background:var(--surf);border-radius:var(--r);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;border:1px solid var(--bdr)}
        .res-top{background:linear-gradient(135deg,#1a2332,#2d3f55);padding:16px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .res-name{color:#fff;font-size:1.08rem;font-weight:700}
        .res-q{color:rgba(255,255,255,.5);font-size:.71rem;margin-top:3px}
        .res-body{padding:14px 20px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
        .res-rank{font-family:monospace;font-size:1.5rem;font-weight:700}
        .res-rank.t1{color:var(--gold)}.res-rank.t3{color:var(--org)}.res-rank.t10{color:var(--gd)}
        .res-meta{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
        .cnt{font-size:.78rem}.cnt-blog{color:var(--gd)}.cnt-visit{color:var(--blue)}.cnt-time{color:var(--sub);font-size:.7rem}
        .badge{padding:3px 8px;border-radius:5px;font-size:.72rem;font-weight:700}
        .badge-nw{background:rgba(3,199,90,.14);color:var(--gd)}.badge-up{background:rgba(232,25,44,.11);color:var(--red)}
        .badge-dn{background:rgba(25,103,210,.11);color:var(--blue)}.badge-sm{background:#f0f4f8;color:var(--sub)}
        .badge-reg{padding:5px 12px;border-radius:7px;font-size:.76rem;font-weight:700;background:var(--gb);color:var(--gd);border:1px solid rgba(3,199,90,.3)}
        .btn-reg{padding:7px 15px;background:var(--g);color:#fff;border:none;border-radius:7px;font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap}
        .btn-reg:hover:not(:disabled){background:var(--gd)}.btn-reg:disabled{opacity:.5;cursor:not-allowed}
        .not-found{background:#fff8f8;border:1.5px solid #ffcdd2;border-radius:var(--r);padding:14px 18px;color:#c62828;font-size:.84rem}

        /* 전체 순위 목록 */
        .list-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .list-header h3{font-size:.88rem;font-weight:700}
        .list-time{font-size:.7rem;color:var(--sub)}
        .list-scroll{max-height:420px;overflow-y:auto;border:1px solid var(--bdr);border-radius:8px}
        .rtable{width:100%;border-collapse:collapse;font-size:.82rem}
        .rtable thead th{background:#f7fafc;padding:8px 12px;text-align:left;font-weight:600;color:var(--mut);border-bottom:2px solid var(--bdr);font-size:.68rem;text-transform:uppercase;white-space:nowrap;position:sticky;top:0;z-index:2}
        .rtable tbody tr{border-bottom:1px solid #f0f4f8}.rtable tbody tr:hover{background:#f8fffe}
        .rtable tbody td{padding:8px 12px;vertical-align:middle}
        .rk{font-family:monospace;font-weight:700;text-align:center;font-size:.84rem}
        .rk.t1{color:var(--gold)}.rk.t3{color:var(--org)}.rk.t10{color:var(--gd)}
        .rn-name{font-weight:600}
        .rn-sub{display:flex;align-items:center;gap:6px;margin-top:1px;flex-wrap:wrap}
        .rn-cat{font-size:.68rem;color:var(--sub)}
        .rn-pid{font-size:.62rem;color:var(--blue);font-family:monospace;text-decoration:none;opacity:.7;white-space:nowrap}
        .rn-pid:hover{opacity:1;text-decoration:underline}
        .rn-num{font-family:monospace;font-size:.78rem;text-align:right}
        .rn-blog{color:var(--gd)}.rn-visit{color:var(--blue)}
        .place-id-row{display:flex;align-items:center;gap:6px;margin-top:6px;width:100%;flex-basis:100%}
        .place-id-lbl{font-size:.68rem;color:var(--sub);font-weight:600;white-space:nowrap}
        .place-id-val{font-size:.72rem;font-family:monospace;color:var(--blue);text-decoration:none}
        .place-id-val:hover{text-decoration:underline}
        .btn-add{padding:3px 9px;border:1.5px solid var(--g);color:var(--gd);background:#fff;border-radius:6px;font-size:.7rem;font-weight:700;cursor:pointer;white-space:nowrap}
        .btn-add:hover:not(:disabled){background:var(--gb)}.btn-add:disabled{opacity:.5;cursor:not-allowed}

        /* 대시보드 공통 */
        .dash{background:var(--surf);border-radius:var(--r);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;border:1px solid var(--bdr)}
        .dash-top{padding:12px 18px;border-bottom:1px solid var(--bdr);background:#fafbfc;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
        .dash-title{font-size:.9rem;font-weight:700}
        .dash-cnt{font-size:.7rem;color:var(--sub);font-weight:400;margin-left:4px}
        .dash-ctrl{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
        .day-btn,.view-btn,.btn-sm{padding:4px 11px;border:1.5px solid var(--bdr);background:#fff;border-radius:6px;font-size:.74rem;font-weight:600;cursor:pointer;color:var(--mut);transition:.12s}
        .day-btn.on,.view-btn.on{background:var(--g);color:#fff;border-color:var(--g)}
        .day-btn:not(.on):hover,.view-btn:not(.on):hover,.btn-sm:hover{border-color:var(--g);color:var(--gd)}
        .sep{width:1px;height:20px;background:var(--bdr);flex-shrink:0}
        .empty{padding:46px;text-align:center;color:var(--sub)}
        .empty p{font-size:.82rem;margin-top:8px;line-height:1.7}

        /* 카드 뷰 날짜 탭 바 */
        .dash-date-bar{display:flex;gap:5px;padding:8px 14px;overflow-x:auto;border-bottom:1px solid var(--bdr);background:#f7faf7;-webkit-overflow-scrolling:touch}
        .dash-date-bar::-webkit-scrollbar{height:3px}
        .dash-date-bar::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:3px}
        .date-tab{padding:4px 11px;border:1.5px solid var(--bdr);background:#fff;border-radius:20px;font-size:.72rem;font-weight:600;cursor:pointer;color:var(--mut);white-space:nowrap;flex-shrink:0;transition:.12s}
        .date-tab.on{background:var(--g);color:#fff;border-color:var(--g)}
        .date-tab:not(.on):hover{border-color:var(--g);color:var(--gd)}

        /* ── 표 뷰 ── */
        .dtw{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .dt{border-collapse:collapse;width:max-content;min-width:100%}
        .dt thead th,.dt tbody td{white-space:nowrap}
        .grp-row td{background:linear-gradient(to right,#f0fff8,#f8fbff);padding:7px 16px;font-size:.76rem;font-weight:700;color:var(--gd);border-top:2px solid rgba(3,199,90,.2);border-bottom:1px solid rgba(3,199,90,.12)}
        .grp-cnt{font-size:.67rem;color:var(--sub);font-weight:400;margin-left:4px}
        .rl-hdr{position:sticky;left:0;z-index:20;background:#f7fafc;padding:9px 14px;text-align:left;border-right:2px solid var(--bdr);border-bottom:2px solid var(--bdr);font-size:.67rem;font-weight:600;color:var(--mut);text-transform:uppercase;width:140px;min-width:140px}
        .rl-cell{position:sticky;left:0;z-index:10;background:#fff;padding:7px 10px;border-right:2px solid var(--bdr);border-bottom:1px solid #f0f4f8;width:140px;min-width:140px}
        .rl-cell:hover{background:#f8fffb}
        .rl-inner{display:flex;align-items:center;gap:4px}
        .rl-name{font-size:.78rem;font-weight:600;color:var(--txt);flex:1;overflow:hidden;text-overflow:ellipsis}
        .rl-acts{display:flex;align-items:center;gap:4px;flex-shrink:0}
        .rl-err{font-size:.62rem;color:var(--red)}
        .spin-sm{width:12px;height:12px;border:2px solid #e0e0e0;border-top-color:var(--g);border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0;display:inline-block}
        .btn-del{padding:2px 6px;border:1.5px solid #e2e8f0;color:var(--sub);background:#fff;border-radius:4px;font-size:.64rem;cursor:pointer}
        .btn-del:hover{border-color:var(--red);color:var(--red)}
        .dhdr{padding:6px 2px;border-bottom:2px solid var(--bdr);border-right:1px solid #edf2f7;width:80px;min-width:80px;text-align:center}
        .dh-d{font-family:monospace;font-size:.68rem;font-weight:700;color:var(--txt)}
        .dh-w{font-size:.56rem;color:var(--sub);margin-top:1px}
        .dhdr.today{background:#f0fff8}.dhdr.today .dh-d{color:var(--gd)}
        .dhdr.sun .dh-d{color:var(--red)}.dhdr.sat .dh-d{color:var(--blue)}
        .dc{padding:5px 2px;border-right:1px solid #f0f4f8;border-bottom:1px solid #f0f4f8;text-align:center;width:80px;min-width:80px;vertical-align:top}
        .dc-nil{color:#cbd5e1;font-size:.76rem;vertical-align:middle!important}
        .dc-rk{display:flex;flex-direction:column;align-items:center;margin-bottom:3px}
        .dc-stat{display:flex;align-items:center;justify-content:center;gap:2px;margin-top:2px;line-height:1.2}
        .dc-lbl{color:var(--sub);font-weight:700;font-size:.56rem;flex-shrink:0}
        .dc-num{font-family:monospace;font-weight:600;font-size:.6rem}
        .dc-num.blog{color:var(--gd)}.dc-num.visit{color:var(--blue)}
        .rv{font-family:monospace;font-size:.72rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;margin:0 auto}
        .rv.r1{background:var(--gold);color:#5a3800}.rv.r3{background:var(--org);color:#fff}
        .rv.r10{background:var(--gb);color:var(--gd)}.rv.rn{background:#f0f4f8;color:var(--txt)}
        .rc{font-size:.58rem;font-weight:700;display:block;margin-top:2px}
        .rc-up{color:var(--red)}.rc-dn{color:var(--blue)}.rc-sm{color:var(--sub)}.rc-nw{color:var(--g)}

        /* ── 카드 뷰 ── */
        .card-groups{padding:14px 16px;display:flex;flex-direction:column;gap:14px}
        .crd-group-hdr{font-size:.76rem;font-weight:700;color:var(--gd);padding:6px 2px;display:flex;align-items:center;gap:6px}
        .crd-group-hdr::after{content:'';flex:1;height:1px;background:rgba(3,199,90,.2)}
        .crd{background:#fafbfc;border:1px solid var(--bdr);border-radius:10px;padding:12px 14px}
        .crd + .crd{margin-top:8px}
        .crd-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .crd-name{font-size:.88rem;font-weight:700;color:var(--txt)}
        .crd-main{display:flex;align-items:center;gap:14px;margin-bottom:10px}
        .crd-rk-wrap{display:flex;align-items:center;gap:6px;flex-shrink:0}
        .crd-rank{font-family:monospace;font-size:1.5rem;font-weight:800}
        .crd-rank.t1{color:var(--gold)}.crd-rank.t3{color:var(--org)}.crd-rank.t10{color:var(--gd)}
        .crd-counts{display:flex;flex-direction:column;gap:5px}
        .crd-cnt{display:flex;align-items:center;gap:4px;font-size:.76rem}
        .crd-lbl{color:var(--sub);font-weight:700;font-size:.68rem;width:10px;flex-shrink:0}
        .crd-val{font-family:monospace;font-weight:600}
        .crd-val.blog{color:var(--gd)}.crd-val.visit{color:var(--blue)}
        .crd-hist{display:flex;gap:6px;padding-top:8px;border-top:1px solid #f0f4f8;overflow-x:auto}
        .crd-day{display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;padding:3px 4px;border-radius:6px;transition:.12s}
        .crd-day:hover{background:rgba(3,199,90,.08)}
        .crd-day.crd-sel .crd-day-lbl{color:var(--gd);font-weight:700}
        .crd-day.crd-sel .mob-rv{outline:2px solid var(--g);outline-offset:1px}
        .crd-day-lbl{font-size:.58rem;color:var(--sub);font-family:monospace}
        .mob-rv{font-family:monospace;font-size:.72rem;font-weight:700;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center}
        .mob-rv.r1{background:var(--gold);color:#5a3800}.mob-rv.r3{background:var(--org);color:#fff}
        .mob-rv.r10{background:var(--gb);color:var(--gd)}.mob-rv.rn{background:#f0f4f8;color:var(--txt)}
        .mob-chg{font-size:.58rem;font-weight:700}
        .crd-nodata{font-size:.76rem;color:var(--sub);text-align:center;padding:10px 0}

        /* 스크롤 힌트 (모바일 표 뷰) */
        .scroll-hint{display:none;align-items:center;justify-content:center;gap:6px;padding:7px 14px;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:.72rem;color:#92400e}
        .scroll-hint-icon{font-size:.9rem}

        @keyframes spin{to{transform:rotate(360deg)}}

        /* ── 모바일 반응형 (640px 이하) ── */
        @media(max-width:640px){
          /* 레이아웃 */
          .wrap{padding:10px 10px;gap:10px}
          .card{padding:14px 12px}
          .hdr{padding:12px 16px}
          .hdr h1{font-size:1rem}

          /* 검색폼 */
          .srow{grid-template-columns:1fr;gap:8px}
          .btn-search{width:100%;height:48px;font-size:.92rem;border-radius:10px}
          .fg input{height:46px;font-size:.9rem}

          /* 대시보드 헤더: 타이틀 위, 컨트롤 아래 */
          .dash-top{flex-direction:column;align-items:stretch;gap:8px;padding:10px 12px}
          .dash-ctrl{justify-content:space-between;gap:4px}
          .view-btn{flex:1;text-align:center;padding:8px 4px;font-size:.76rem;min-height:36px}
          .day-btn{flex:1;text-align:center;padding:7px 4px;font-size:.74rem;min-height:36px}
          .btn-sm{padding:8px 10px;min-height:36px}
          .sep{display:none}

          /* 날짜 탭 바 */
          .date-tab{padding:7px 14px;font-size:.76rem;min-height:36px}

          /* 카드: 더 크고 읽기 쉽게 */
          .card-groups{padding:10px 12px;gap:10px}
          .crd{padding:14px 12px}
          .crd-name{font-size:.95rem}
          .crd-rank{font-size:2rem}
          .crd-val{font-size:.88rem}
          .crd-cnt{font-size:.82rem;gap:5px}
          .crd-lbl{font-size:.72rem}
          .crd-main{gap:16px;margin-bottom:12px}
          .mob-rv{width:34px;height:34px;font-size:.78rem}
          .crd-day{padding:4px 5px}
          .crd-day-lbl{font-size:.62rem}
          .mob-chg{font-size:.62rem}
          .btn-del{padding:5px 9px;font-size:.7rem;min-height:32px}

          /* 표 뷰: 컬럼 최소화 + 스크롤 힌트 표시 */
          .scroll-hint{display:flex}
          .rl-hdr{width:90px;min-width:90px;padding:7px 8px;font-size:.6rem}
          .rl-cell{width:90px;min-width:90px;padding:6px 6px}
          .rl-name{font-size:.7rem}
          .dhdr{width:58px;min-width:58px;padding:5px 1px}
          .dh-d{font-size:.6rem}
          .dh-w{font-size:.5rem}
          .dc{width:58px;min-width:58px;padding:4px 1px}
          .rv{width:22px;height:22px;font-size:.62rem}
          .dc-num{font-size:.54rem}
          .dc-lbl{font-size:.5rem}
          .rc{font-size:.5rem}
        }
      `}</style>

      <header className="hdr">
        <h1>🏆 네이버 플레이스 순위 추적기</h1>
        <p>매일 11:30 자동수집 · 최대 10개 등록 · 삭제 전까지 유지</p>
      </header>

      <div className="wrap">
        {/* 검색 */}
        <div className="card">
          <div className="card-title">🔍 순위 검색</div>
          <div className="srow">
            <div className="fg">
              <label>검색어 (키워드)</label>
              <input value={srchQ} onChange={e => setSrchQ(e.target.value)}
                     placeholder="예) 검단신도시미용실"
                     onKeyDown={e => e.key === 'Enter' && search()}
                     disabled={searching} />
            </div>
            <div className="fg">
              <label>상호명 또는 플레이스 ID<span className="hint-lbl">선택 · 비워두면 전체 100위</span></label>
              <input value={srchP} onChange={e => setSrchP(e.target.value)}
                     placeholder="예) 르아헤어  또는  1234567890"
                     onKeyDown={e => e.key === 'Enter' && search()}
                     disabled={searching} />
            </div>
            <button className="btn-search" onClick={search} disabled={searching}>
              {searching ? '검색 중...' : '검색하기 →'}
            </button>
          </div>
          {searching && (
            <div className="srch-info">
              <span className="srch-spin" />
              수집 중... 최초 조회 시 30초~2분 소요될 수 있습니다.
            </div>
          )}
        </div>

        {/* 단일 업체 결과 */}
        {single && !single.not_found && (
          <div className="res-card">
            <div className="res-top">
              <div>
                <div className="res-name">{single.matched_name}</div>
                <div className="res-q">검색어: {doneQ}</div>
              </div>
              {isRegistered(doneQ, single.matched_name || doneP)
                ? <span className="badge-reg">✓ 등록됨</span>
                : <button className="btn-reg"
                    onClick={() => registerItem(doneQ, doneP, single!.matched_name || null)}
                    disabled={registering !== null}>
                    {registering === mkKey(doneQ, doneP) ? '등록 중...' : '+ 대시보드에 등록'}
                  </button>
              }
            </div>
            <div className="res-body">
              <span className={`res-rank ${tCls(single.rank || 0)}`}>{single.rank}위</span>
              {chgBadge(single.rank!, single.prev_rank)}
              <div className="res-meta">
                <span className="cnt cnt-blog">블로그 {(single.blog || 0).toLocaleString()}</span>
                <span className="cnt cnt-visit">방문자 {(single.visit || 0).toLocaleString()}</span>
                <span className="cnt cnt-time">{single.collected_at?.slice(0, 16)} 수집</span>
              </div>
              {single.place_id && (
                <div className="place-id-row">
                  <span className="place-id-lbl">플레이스 ID</span>
                  <a className="place-id-val"
                     href={`https://m.place.naver.com/place/${single.place_id}/home`}
                     target="_blank" rel="noopener noreferrer">
                    {single.place_id} ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {single?.not_found && (
          <div className="not-found">
            &quot;{doneP}&quot;을(를) &quot;{doneQ}&quot; 검색결과 {single.total_collected}위 내에서 찾을 수 없습니다.
          </div>
        )}

        {/* 전체 순위 목록 */}
        {listRes?.list && (
          <div className="card">
            <div className="list-header">
              <h3>&quot;{doneQ}&quot; 전체 순위 — {listRes.list.length}개</h3>
              <span className="list-time">{listRes.collected_at?.slice(0, 16)} 수집</span>
            </div>
            <div className="list-scroll">
              <table className="rtable">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>순위</th>
                    <th>상호명</th>
                    <th style={{ width: 80, textAlign: 'right' }}>블로그</th>
                    <th style={{ width: 80, textAlign: 'right' }}>방문자</th>
                    <th style={{ width: 66, textAlign: 'center' }}>등록</th>
                  </tr>
                </thead>
                <tbody>
                  {listRes.list.map(item => {
                    const reg = isRegistered(doneQ, item.place_name)
                    const key = mkKey(doneQ, item.place_name)
                    return (
                      <tr key={item.rank}>
                        <td className={`rk ${tCls(item.rank)}`}>{item.rank}</td>
                        <td>
                          <div className="rn-name">{item.place_name}</div>
                          <div className="rn-sub">
                            {item.category && <span className="rn-cat">{item.category}</span>}
                            {item.place_id && (
                              <a className="rn-pid"
                                 href={`https://m.place.naver.com/place/${item.place_id}/home`}
                                 target="_blank" rel="noopener noreferrer"
                                 onClick={e => e.stopPropagation()}>
                                ID:{item.place_id}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="rn-num rn-blog">{(item.blog || 0).toLocaleString()}</td>
                        <td className="rn-num rn-visit">{(item.visit || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }}>
                          {reg
                            ? <span className="badge badge-nw" style={{ fontSize: '.68rem' }}>✓</span>
                            : <button className="btn-add"
                                onClick={() => registerItem(doneQ, item.place_name, item.place_name)}
                                disabled={registering !== null}>
                                {registering === key ? '...' : '+등록'}
                              </button>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 대시보드 */}
        <div className="dash">
          <div className="dash-top">
            <span className="dash-title">
              📊 순위 대시보드
              <span className="dash-cnt">{rows.length}개 등록</span>
            </span>
            <div className="dash-ctrl">
              {/* 뷰 토글 */}
              <button className={`view-btn${viewMode === 'card' ? ' on' : ''}`}
                onClick={() => setViewMode('card')} title="카드 뷰">📋 카드</button>
              <button className={`view-btn${viewMode === 'table' ? ' on' : ''}`}
                onClick={() => setViewMode('table')} title="표 뷰">📊 표</button>

              {/* 표 뷰일 때만 날짜 탭 */}
              {viewMode === 'table' && (
                <>
                  <div className="sep" />
                  {([7, 14, 30] as const).map(d => (
                    <button key={d} className={`day-btn${dayFilter === d ? ' on' : ''}`}
                      onClick={() => setDayFilter(d)}>{d}일</button>
                  ))}
                </>
              )}
              <button className="btn-sm" onClick={loadDashboard} title="새로고침">↻</button>
            </div>
          </div>

          {/* 카드 뷰: 날짜 선택 바 */}
          {viewMode === 'card' && dates.length > 0 && (
            <div className="dash-date-bar">
              {dates.slice(0, 14).map(d => (
                <button key={d}
                  className={`date-tab${cardDate === d ? ' on' : ''}`}
                  onClick={() => setCardDate(d)}>
                  {fmtDate(d)}
                </button>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📋</div>
              <p>등록된 항목이 없습니다.<br />위에서 검색 후 &quot;+ 대시보드에 등록&quot;으로 추가하세요.</p>
            </div>
          ) : viewMode === 'card' ? (
            /* ── 카드 뷰 ── */
            <div className="card-groups">
              {groups.map(([query, groupRows]) => (
                <div key={query}>
                  <div className="crd-group-hdr">🔑 {query}</div>
                  {groupRows.map(row => renderCard(row, cardDate))}
                </div>
              ))}
            </div>
          ) : (
            /* ── 표 뷰 ── */
            <>
            <div className="scroll-hint">
              <span className="scroll-hint-icon">👈</span>
              좌우로 스크롤하세요
              <span className="scroll-hint-icon">👉</span>
            </div>
            <div className="dtw">
              <table className="dt">
                <thead>
                  <tr>
                    <th className="rl-hdr">키워드 / 업체명</th>
                    {visibleDates.map(d => {
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
                  {groups.map(([query, groupRows]) => (
                    <Fragment key={`g-${query}`}>
                      <tr className="grp-row">
                        <td colSpan={visibleDates.length + 1}>
                          🔑 {query}
                          <span className="grp-cnt">({groupRows.length}개)</span>
                        </td>
                      </tr>
                      {groupRows.map(row => (
                        <tr key={row.key}>
                          <td className="rl-cell">
                            <div className="rl-inner">
                              <span className="rl-name">{row.matched_name || row.place_name_input}</span>
                              <div className="rl-acts">
                                {row.loading && <span className="spin-sm" />}
                                {row.error && <span className="rl-err">{row.error}</span>}
                                <button className="btn-del" onClick={() => del(row)}>✕</button>
                              </div>
                            </div>
                          </td>
                          {visibleDates.map(d => renderCell(row, d))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

      </div>
    </>
  )
}
