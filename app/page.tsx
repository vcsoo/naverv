'use client'
import { useState, useEffect } from 'react'

const WD = ['일','월','화','수','목','금','토']

export default function Home() {
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [result, setResult] = useState<any>(null)
  const [rankList, setRankList] = useState<any[]|null>(null)
  const [rankMeta, setRankMeta] = useState<any>(null)
  const [targets, setTargets] = useState<any[]>([])
  const [curQ, setCurQ] = useState('')
  const [curP, setCurP] = useState('')

  useEffect(() => { loadTargets() }, [])

  async function loadTargets() {
    const r = await fetch('/api/targets')
    setTargets(await r.json())
  }

  async function doSearch(retry=0) {
    if (!query.trim()) { alert('검색어를 입력해주세요'); return }
    setCurQ(query); setCurP(place)
    setLoading(true)
    if (place.trim()) await doPlace(query, place, retry)
    else await doRanking(query, retry)
    setLoading(false)
  }

  async function doPlace(q: string, p: string, retry=0) {
    setLoadingMsg('순위 확인 중...')
    const res = await fetch('/api/search', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({search_query:q, place_name:p}) })
    const data = await res.json()
    if (data.need_collect) {
      if (retry >= 1) { alert('수집된 데이터가 없습니다. PC 수집기를 먼저 실행해주세요.'); return }
      await new Promise(r => setTimeout(r, 2000))
      return doPlace(q, p, retry+1)
    }
    setRankList(null); setResult(data); loadTargets()
  }

  async function doRanking(q: string, retry=0) {
    setLoadingMsg('전체 순위 조회 중...')
    const res = await fetch('/api/ranking', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({search_query:q, limit:100}) })
    const data = await res.json()
    if (data.need_collect) {
      if (retry >= 1) { alert('수집된 데이터가 없습니다. PC 수집기를 먼저 실행해주세요.'); return }
      await new Promise(r => setTimeout(r, 2000))
      return doRanking(q, retry+1)
    }
    setResult(null); setRankList(data.list); setRankMeta({query:q, collected_at:data.collected_at})
  }

  function rCls(r: number) { return r===1?'r1':r<=3?'r3':r<=10?'r10':'rn' }
  function tCls(r: number) { return r===1?'t1':r<=3?'t3':r<=10?'t10':'' }

  function buildTable(history: any[]) {
    const sorted = [...history].reverse()
    if (!sorted.length) return <div className="empty">📭 수집 이력 없음</div>
    const today = new Date().toISOString().slice(0,10)
    return (
      <div className="dtw">
        <table className="dt">
          <thead><tr>
            <th className="rl">항목</th>
            {sorted.map(h => {
              const dt = new Date(h.date+'T00:00:00')
              const mm = String(dt.getMonth()+1).padStart(2,'0'), dd = String(dt.getDate()).padStart(2,'0')
              const cls = 'dhdr'+(h.date===today?' today':dt.getDay()===0?' sun':dt.getDay()===6?' sat':'')
              return <th key={h.date} className={cls}><div className="dh-d">{mm}.{dd}</div><div className="dh-w">{WD[dt.getDay()]}</div></th>
            })}
          </tr></thead>
          <tbody>
            <tr><td className="rl">📍 순위</td>
              {sorted.map((h,i) => {
                const prev = sorted[i+1]
                let chg = <span className="rc rc-nw">NEW</span>
                if (prev) { const d=prev.rank-h.rank; chg=d>0?<span className="rc rc-up">▲{d}</span>:d<0?<span className="rc rc-dn">▼{Math.abs(d)}</span>:<span className="rc rc-sm">━</span> }
                return <td key={h.date} className="dc" style={{textAlign:'center'}}><div className={`rv ${rCls(h.rank)}`}>{h.rank}</div>{chg}</td>
              })}
            </tr>
            <tr><td className="rl" style={{background:'#f8fffb'}}>📝 블로그</td>
              {sorted.map((h,i) => {
                const prev = sorted[i+1]
                const df = prev&&h.blog-prev.blog>0 ? <span style={{color:'var(--gd)',fontSize:'.6rem'}}> +{h.blog-prev.blog}</span> : null
                return <td key={h.date} className="dc" style={{background:'#fafffe',textAlign:'center'}}><span className="rvb"><span className="rvl">블</span>{h.blog?.toLocaleString()}{df}</span></td>
              })}
            </tr>
            <tr><td className="rl" style={{background:'#f8f9ff'}}>👤 방문자</td>
              {sorted.map((h,i) => {
                const prev = sorted[i+1]
                const df = prev&&h.visit-prev.visit>0 ? <span style={{color:'var(--blue)',fontSize:'.6rem'}}> +{h.visit-prev.visit}</span> : null
                return <td key={h.date} className="dc" style={{background:'#fafbff',textAlign:'center'}}><span className="rvv"><span className="rvl">방</span>{h.visit?.toLocaleString()}{df}</span></td>
              })}
            </tr>
            <tr><td className="rl">📊 총리뷰</td>
              {sorted.map(h => <td key={h.date} className="dc" style={{textAlign:'center'}}><span style={{fontFamily:"monospace",fontSize:'.78rem',fontWeight:600}}>{((h.blog||0)+(h.visit||0)).toLocaleString()}</span></td>)}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <style>{`
        :root{--g:#03c75a;--gd:#00a045;--gb:#e8faf1;--blue:#1967d2;--red:#e8192c;--org:#ff9500;--gold:#e6aa00;--bg:#f0f4f8;--surf:#fff;--bdr:#e2e8f0;--txt:#1a2332;--mut:#64748b;--sub:#94a3b8;--r:12px}
        *{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:var(--bg);color:var(--txt);font-size:14px}
        .hdr{background:linear-gradient(135deg,#03c75a,#00b44a 45%,#0597d8);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200}
        .hdr h1{color:#fff;font-size:1.1rem;font-weight:700}.hdr p{color:rgba(255,255,255,.8);font-size:.72rem;margin-top:2px}
        .wrap{max-width:1300px;margin:0 auto;padding:24px 18px}
        .scard{background:var(--surf);border-radius:var(--r);padding:22px 26px;box-shadow:0 4px 20px rgba(0,0,0,.08);margin-bottom:22px;border:1px solid rgba(3,199,90,.12)}
        .scard h2{font-size:.95rem;font-weight:700;margin-bottom:14px}
        .srow{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
        .fg label{display:block;font-size:.72rem;font-weight:600;color:var(--mut);text-transform:uppercase;margin-bottom:5px}
        .fg input{width:100%;height:44px;padding:0 13px;border:2px solid var(--bdr);border-radius:9px;font-size:.88rem;outline:none;transition:.15s}
        .fg input:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(3,199,90,.08)}
        .btn-main{height:44px;padding:0 24px;background:linear-gradient(135deg,var(--g),var(--gd));color:#fff;border:none;border-radius:9px;font-size:.9rem;font-weight:700;cursor:pointer;white-space:nowrap}
        .btn-main:disabled{opacity:.5;cursor:not-allowed}
        .hint{margin-top:10px;font-size:.74rem;color:var(--sub);display:flex;gap:6px;flex-wrap:wrap;align-items:center}
        .mtag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600}
        .mta{background:var(--gb);color:var(--gd);border:1px solid rgba(3,199,90,.3)}.mtb{background:#eff6ff;color:var(--blue);border:1px solid rgba(25,103,210,.25)}
        .res-hdr{background:linear-gradient(135deg,#1a2332,#2d3f55);border-radius:var(--r) var(--r) 0 0;padding:18px 22px;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px}
        .bname{color:#fff;font-size:1.15rem;font-weight:700}.qname{color:rgba(255,255,255,.55);font-size:.75rem;margin-top:3px}
        .cur-row{display:flex;align-items:center;gap:8px;margin-top:8px}
        .rnum{font-family:monospace;font-size:1.6rem;font-weight:700;color:#fff}
        .rnum.t1{color:var(--gold)}.rnum.t3{color:var(--org)}.rnum.t10{color:#4de88a}
        .cbadge{padding:4px 10px;border-radius:6px;font-size:.8rem;font-weight:700}
        .cup{background:rgba(232,25,44,.25);color:#ff6b7a}.cdn{background:rgba(25,103,210,.25);color:#7aaeff}.csm{background:rgba(255,255,255,.08);color:rgba(255,255,255,.45)}.cnw{background:rgba(3,199,90,.2);color:#4de88a}
        .result-wrap{margin-bottom:22px}.dtw{overflow-x:auto;background:var(--surf);border-radius:0 0 var(--r) var(--r);border:1px solid var(--bdr);border-top:none}
        .dt{border-collapse:collapse;width:max-content;min-width:100%}.dt th,.dt td{padding:0;text-align:center;white-space:nowrap}
        .rl{position:sticky;left:0;background:#f8fafc;z-index:10;padding:10px 14px;text-align:left;border-right:2px solid var(--bdr);border-bottom:1px solid #f0f4f8;font-size:.72rem;font-weight:600;color:var(--mut);text-transform:uppercase;min-width:82px}
        .dhdr{padding:9px 12px;border-bottom:2px solid var(--bdr);border-right:1px solid #f0f4f8;min-width:96px}
        .dh-d{font-family:monospace;font-size:.8rem;font-weight:700;color:var(--txt)}.dh-w{font-size:.68rem;color:var(--sub);margin-top:1px}
        .dhdr.today{background:#f0fff8}.dhdr.today .dh-d{color:var(--gd)}.dhdr.sun .dh-d{color:var(--red)}.dhdr.sat .dh-d{color:var(--blue)}
        .dc{padding:8px 12px;border-right:1px solid #f0f4f8;border-bottom:1px solid #f8fafc;vertical-align:middle}
        .rv{font-family:monospace;font-size:1rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%}
        .rv.r1{background:var(--gold);color:#5a3800}.rv.r3{background:var(--org);color:#fff}.rv.r10{background:var(--gb);color:var(--gd)}.rv.rn{background:#f0f4f8;color:var(--txt)}
        .rc{font-size:.68rem;font-weight:700;margin-top:3px;display:block}
        .rc-up{color:var(--red)}.rc-dn{color:var(--blue)}.rc-sm{color:var(--sub)}.rc-nw{color:var(--g)}
        .rvb{color:var(--gd);font-size:.76rem}.rvv{color:var(--blue);font-size:.76rem}.rvl{font-size:.62rem;color:var(--sub);margin-right:2px}
        .ranking-wrap{margin-bottom:22px}
        .rlt{border-radius:0 0 var(--r) var(--r);border:1px solid var(--bdr);border-top:none;overflow:hidden;background:var(--surf)}
        .rlt table{width:100%;border-collapse:collapse;font-size:.82rem}
        .rlt table thead th{background:#f7fafc;padding:9px 12px;text-align:left;font-weight:600;color:var(--mut);border-bottom:2px solid var(--bdr);font-size:.72rem;text-transform:uppercase;white-space:nowrap}
        .rlt table tbody tr{border-bottom:1px solid #f0f4f8}.rlt table tbody tr:hover{background:#f8fffe}.rlt table tbody td{padding:9px 12px;vertical-align:middle}
        .rl-r{font-family:monospace;font-size:.85rem;font-weight:700;text-align:center}
        .rl-r.t1{color:var(--gold)}.rl-r.t3{color:var(--org)}.rl-r.t10{color:var(--gd)}
        .rl-n{font-weight:600}.rl-c{font-size:.72rem;color:var(--sub);margin-top:1px}
        .rl-adr{font-size:.73rem;color:var(--sub);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .btn-trk{padding:3px 9px;border:1.5px solid var(--g);color:var(--gd);background:#fff;border-radius:6px;font-size:.7rem;font-weight:600;cursor:poin
