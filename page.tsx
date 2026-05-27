'use client'
import { useState, useEffect } from 'react'

const WD = ['일','월','화','수','목','금','토']

interface Place { rank:number; place_name:string; category:string; address:string; blog:number; visit:number; total:number }
interface HistItem { date:string; rank:number; blog:number; visit:number }
interface Target { search_query:string; place_name_input:string; matched_name:string|null; latest_rank:number|null; last_searched_at:string; days_left:number }
interface SearchResult { matched_name?:string; search_query?:string; rank?:number; prev_rank?:number|null; blog?:number; visit?:number; collected_at?:string; history?:HistItem[]; need_collect?:boolean; not_found?:boolean; total_collected?:number; error?:string }

function rCls(r:number){ return r===1?'r1':r<=3?'r3':r<=10?'r10':'rn' }
function tCls(r:number){ return r===1?'t1':r<=3?'t3':r<=10?'t10':'' }

export default function Home() {
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [result, setResult] = useState<SearchResult|null>(null)
  const [rankList, setRankList] = useState<Place[]|null>(null)
  const [rankMeta, setRankMeta] = useState<{query:string;collected_at:string}|null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [currentQuery, setCurrentQuery] = useState('')
  const [currentPlace, setCurrentPlace] = useState('')

  useEffect(() => { loadTargets() }, [])

  async function loadTargets(){
    const r = await fetch('/api/targets')
    setTargets(await r.json())
  }

  async function doSearch(retry=0){
    if(!query.trim()){ alert('검색어를 입력해주세요'); return }
    setCurrentQuery(query); setCurrentPlace(place)
    setLoading(true)
    if(place.trim()){
      setLoadingMsg('순위 확인 중...<br/><small>처음이면 2~4분 소요됩니다</small>')
      await doSearchPlace(query, place, retry)
    } else {
      setLoadingMsg('전체 순위 조회 중...')
      await doSearchRanking(query, retry)
    }
    setLoading(false)
  }

  async function doSearchPlace(q:string, p:string, retry=0){
    const res = await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({search_query:q,place_name:p})})
    const data:SearchResult = await res.json()
    if(data.need_collect){
      if(retry>=1){ alert('수집 실패. 잠시 후 다시 시도해주세요.'); return }
      setLoadingMsg('수집 중... (2~4분 소요됩니다 🙏)')
      await fetch('/api/collect',{method:'POST'}) // trigger PC collect signal - no-op on cloud
      // For cloud version, just retry
      await new Promise(r=>setTimeout(r,3000))
      return doSearchPlace(q,p,retry+1)
    }
    setRankList(null)
    setResult(data)
    loadTargets()
  }

  async function doSearchRanking(q:string, retry=0){
    const res = await fetch('/api/ranking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({search_query:q,limit:100})})
    const data = await res.json()
    if(data.need_collect){
      if(retry>=1){ alert('수집 실패. 잠시 후 다시 시도해주세요.'); return }
      await new Promise(r=>setTimeout(r,3000))
      return doSearchRanking(q,retry+1)
    }
    setResult(null)
    setRankList(data.list)
    setRankMeta({query:q, collected_at:data.collected_at})
    loadTargets()
  }

  function buildDateTable(history:HistItem[], query:string, name:string){
    const sorted = [...history].reverse()
    if(!sorted.length) return <div className="empty">📭 수집 이력 없음</div>
    const today = new Date().toISOString().slice(0,10)
    return (
      <div className="dtw">
        <table className="dt">
          <thead><tr>
            <th className="rl">항목</th>
            {sorted.map(h=>{
              const dt=new Date(h.date+'T00:00:00')
              const mm=String(dt.getMonth()+1).padStart(2,'0'), dd=String(dt.getDate()).padStart(2,'0')
              const wd=WD[dt.getDay()]
              const cls='dhdr'+(h.date===today?' today':dt.getDay()===0?' sun':dt.getDay()===6?' sat':'')
              return <th key={h.date} className={cls}><div className="dh-d">{mm}.{dd}</div><div className="dh-w">{wd}</div></th>
            })}
          </tr></thead>
          <tbody>
            <tr><td className="rl">📍 순위</td>
              {sorted.map((h,i)=>{
                const prev=sorted[i+1]
                let chg=<span className="rc rc-nw">NEW</span>
                if(prev){const d=prev.rank-h.rank;chg=d>0?<span className="rc rc-up">▲{d}</span>:d<0?<span className="rc rc-dn">▼{Math.abs(d)}</span>:<span className="rc rc-sm">━</span>}
                return <td key={h.date} className="dc" style={{textAlign:'center'}}><div className={`rv ${rCls(h.rank)}`}>{h.rank}</div>{chg}</td>
              })}
            </tr>
            <tr><td className="rl" style={{background:'#f8fffb'}}>📝 블로그</td>
              {sorted.map((h,i)=>{
                const prev=sorted[i+1]
                const df=prev&&h.blog-prev.blog>0?<span style={{color:'var(--gd)',fontSize:'.6rem'}}> +{h.blog-prev.blog}</span>:null
                return <td key={h.date} className="dc" style={{background:'#fafffe',textAlign:'center'}}><span className="rvb"><span className="rvl">블</span>{h.blog.toLocaleString()}{df}</span></td>
              })}
            </tr>
            <tr><td className="rl" style={{background:'#f8f9ff'}}>👤 방문자</td>
              {sorted.map((h,i)=>{
                const prev=sorted[i+1]
                const df=prev&&h.visit-prev.visit>0?<span style={{color:'var(--blue)',fontSize:'.6rem'}}> +{h.visit-prev.visit}</span>:null
                return <td key={h.date} className="dc" style={{background:'#fafbff',textAlign:'center'}}><span className="rvv"><span className="rvl">방</span>{h.visit.toLocaleString()}{df}</span></td>
              })}
            </tr>
            <tr><td className="rl">📊 총리뷰</td>
              {sorted.map(h=><td key={h.date} className="dc" style={{textAlign:'center'}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'.78rem',fontWeight:600}}>{(h.blog+h.visit).toLocaleString()}</span></td>)}
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
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:var(--bg);color:var(--txt);font-size:14px}
        .hdr{background:linear-gradient(135deg,#03c75a,#00b44a 45%,#0597d8);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200}
        .hdr h1{color:#fff;font-size:1.1rem;font-weight:700}
        .hdr p{color:rgba(255,255,255,.8);font-size:.72rem;margin-top:2px}
        .wrap{max-width:1300px;margin:0 auto;padding:24px 18px}
        .scard{background:var(--surf);border-radius:var(--r);padding:22px 26px;box-shadow:0 4px 20px rgba(0,0,0,.08);margin-bottom:22px;border:1px solid rgba(3,199,90,.12)}
        .scard h2{font-size:.95rem;font-weight:700;margin-bottom:14px}
        .srow{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
        .fg label{display:block;font-size:.72rem;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
        .fg label .opt{font-size:.65rem;color:var(--sub);font-weight:400;text-transform:none;letter-spacing:0;margin-left:4px}
        .fg input{width:100%;height:44px;padding:0 13px;border:2px solid var(--bdr);border-radius:9px;font-size:.88rem;font-family:inherit;outline:none;transition:.15s}
        .fg input:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(3,199,90,.08)}
        .btn-main{height:44px;padding:0 24px;background:linear-gradient(135deg,var(--g),var(--gd));color:#fff;border:none;border-radius:9px;font-size:.9rem;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit}
        .btn-main:disabled{opacity:.5;cursor:not-allowed}
        .mode-hint{margin-top:10px;font-size:.74rem;color:var(--sub);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .mtag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600}
        .mta{background:var(--gb);color:var(--gd);border:1px solid rgba(3,199,90,.3)}
        .mtb{background:#eff6ff;color:var(--blue);border:1px solid rgba(25,103,210,.25)}
        /* Result header */
        .res-hdr{background:linear-gradient(135deg,#1a2332,#2d3f55);border-radius:var(--r) var(--r) 0 0;padding:18px 22px;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px}
        .bname{color:#fff;font-size:1.15rem;font-weight:700}
        .qname{color:rgba(255,255,255,.55);font-size:.75rem;margin-top:3px}
        .cur-row{display:flex;align-items:center;gap:8px;margin-top:8px}
        .rnum{font-family:'JetBrains Mono',monospace;font-size:1.6rem;font-weight:700;color:#fff}
        .rnum.t1{color:var(--gold)}.rnum.t3{color:var(--org)}.rnum.t10{color:#4de88a}
        .cbadge{padding:4px 10px;border-radius:6px;font-size:.8rem;font-weight:700;font-family:'JetBrains Mono',monospace}
        .cup{background:rgba(232,25,44,.25);color:#ff6b7a}.cdn{background:rgba(25,103,210,.25);color:#7aaeff}.csm{background:rgba(255,255,255,.08);color:rgba(255,255,255,.45)}.cnw{background:rgba(3,199,90,.2);color:#4de88a}
        /* Date table */
        .result-wrap{margin-bottom:22px}
        .dtw{overflow-x:auto;background:var(--surf);border-radius:0 0 var(--r) var(--r);border:1px solid var(--bdr);border-top:none}
        .dt{border-collapse:collapse;width:max-content;min-width:100%}
        .dt th,.dt td{padding:0;text-align:center;white-space:nowrap}
        .rl{position:sticky;left:0;background:#f8fafc;z-index:10;padding:10px 14px;text-align:left;border-right:2px solid var(--bdr);border-bottom:1px solid #f0f4f8;font-size:.72rem;font-weight:600;color:var(--mut);text-transform:uppercase;min-width:82px}
        .dhdr{padding:9px 12px;border-bottom:2px solid var(--bdr);border-right:1px solid #f0f4f8;min-width:96px}
        .dh-d{font-family:'JetBrains Mono',monospace;font-size:.8rem;font-weight:700;color:var(--txt)}
        .dh-w{font-size:.68rem;color:var(--sub);margin-top:1px}
        .dhdr.today{background:#f0fff8}.dhdr.today .dh-d{color:var(--gd)}
        .dhdr.sun .dh-d{color:var(--red)}.dhdr.sat .dh-d{color:var(--blue)}
        .dc{padding:8px 12px;border-right:1px solid #f0f4f8;border-bottom:1px solid #f8fafc;vertical-align:middle}
        .rv{font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%}
        .rv.r1{background:var(--gold);color:#5a3800}.rv.r3{background:var(--org);color:#fff}.rv.r10{background:var(--gb);color:var(--gd)}.rv.rn{background:#f0f4f8;color:var(--txt)}
        .rc{font-size:.68rem;font-weight:700;margin-top:3px;font-family:'JetBrains Mono',monospace;display:block}
        .rc-up{color:var(--red)}.rc-dn{color:var(--blue)}.rc-sm{color:var(--sub)}.rc-nw{color:var(--g)}
        .rvb{color:var(--gd);font-size:.76rem}.rvv{color:var(--blue);font-size:.76rem}.rvl{font-size:.62rem;color:var(--sub);margin-right:2px}
        /* Ranking table */
        .ranking-wrap{margin-bottom:22px}
        .rlt{border-radius:0 0 var(--r) var(--r);border:1px solid var(--bdr);border-top:none;overflow:hidden;background:var(--surf)}
        .rlt table{width:100%;border-collapse:collapse;font-size:.82rem}
        .rlt table thead th{background:#f7fafc;padding:9px 12px;text-align:left;font-weight:600;color:var(--mut);border-bottom:2px solid var(--bdr);font-size:.72rem;text-transform:uppercase;white-space:nowrap}
        .rlt table tbody tr{border-bottom:1px solid #f0f4f8}
        .rlt table tbody tr:hover{background:#f8fffe}
        .rlt table tbody td{padding:9px 12px;vertical-align:middle}
        .rl-r{font-family:'JetBrains Mono',monospace;font-size:.85rem;font-weight:700;text-align:center}
        .rl-r.t1{color:var(--gold)}.rl-r.t3{color:var(--org)}.rl-r.t10{color:var(--gd)}
        .rl-n{font-weight:600}.rl-c{font-size:.72rem;color:var(--sub);margin-top:1px}
        .rl-num{font-family:'JetBrains Mono',monospace;font-size:.8rem}
        .rl-adr{font-size:.73rem;color:var(--sub);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .btn-trk{padding:3px 9px;border:1.5px solid var(--g);color:var(--gd);background:#fff;border-radius:6px;font-size:.7rem;font-weight:600;cursor:pointer}
        /* Targets */
        .tcard{background:var(--surf);border-radius:var(--r);box-shadow:0 2px 8px rgba(0,0,0,.07);overflow:hidden;margin-bottom:22px}
        .tcard-hdr{padding:14px 20px;border-bottom:1px solid var(--bdr);background:#fafbfc;display:flex;align-items:center;justify-content:space-between}
        .tcard-hdr h3{font-size:.88rem;font-weight:700}
        .trow{display:flex;align-items:center;padding:11px 18px;border-bottom:1px solid #f4f7fb;gap:10px;cursor:pointer}
        .trow:hover{background:#f8fbff}
        .t-info{flex:1}.t-q{font-size:.82rem;font-weight:600}.t-p{font-size:.75rem;color:var(--mut);margin-top:1px}
        .t-rank{font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:700;min-width:46px;text-align:center}
        .t-rank.t1{color:var(--gold)}.t-rank.t3{color:var(--org)}.t-rank.t10{color:var(--gd)}
        .t-days{font-size:.7rem;color:var(--sub);background:#f4f7fb;padding:2px 7px;border-radius:10px}
        .t-del{padding:3px 8px;border:1.5px solid var(--bdr);color:var(--sub);background:#fff;border-radius:5px;font-size:.7rem;cursor:pointer}
        .t-del:hover{border-color:var(--red);color:var(--red)}
        .empty{text-align:center;padding:36px;color:var(--sub)}
        .not-found{background:#fff8f8;border:1.5px solid #ffcdd2;border-radius:9px;padding:16px 18px;color:#c62828;font-size:.85rem;margin:16px}
        .btn-sm{padding:5px 11px;border:1.5px solid var(--bdr);background:#fff;border-radius:7px;font-size:.74rem;font-weight:600;cursor:pointer;color:var(--mut)}
        .btn-sm:hover{border-color:var(--g);color:var(--gd)}
        /* Loading overlay */
        .overlay{display:flex;position:fixed;inset:0;background:rgba(255,255,255,.92);z-index:999;flex-direction:column;align-items:center;justify-content:center;gap:14px}
        .spin{width:46px;height:46px;border:4px solid #e0e0e0;border-top-color:var(--g);border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .smsg{color:var(--mut);font-size:.86rem;text-align:center;line-height:1.8}
        @media(max-width:680px){.srow{grid-template-columns:1fr;gap:8px}.hdr{flex-direction:column;gap:8px}}
      `}</style>

      {loading && (
        <div className="overlay">
          <div className="spin"/>
          <div className="smsg" dangerouslySetInnerHTML={{__html:loadingMsg}}/>
        </div>
      )}

      <header className="hdr">
        <div>
          <h1>🏆 네이버 플레이스 순위 추적기</h1>
          <p>매일 11:00 자동수집 · 100위 · 30일 추적</p>
        </div>
      </header>

      <div className="wrap">
        {/* 검색 폼 */}
        <div className="scard">
          <h2>🔍 순위 확인</h2>
          <div className="srow">
            <div className="fg">
              <label>검색어 (키워드)</label>
              <input value={query} onChange={e=>setQuery(e.target.value)}
                placeholder="예) 검단신도시미용실" onKeyDown={e=>e.key==='Enter'&&doSearch()}/>
            </div>
            <div className="fg">
              <label>상호명 <span className="opt">※ 비워두면 전체 100위 목록</span></label>
              <input value={place} onChange={e=>setPlace(e.target.value)}
                placeholder="예) 르아헤어 (선택사항)" onKeyDown={e=>e.key==='Enter'&&doSearch()}/>
            </div>
            <button className="btn-main" onClick={()=>doSearch()} disabled={loading}>
              {place.trim() ? '순위 확인 →' : '전체 순위 보기 →'}
            </button>
          </div>
          <div className="mode-hint">
            <span className="mtag mta">🏷 상호명 입력 시</span> 날짜별 순위 추적 (▲빨강=상승 / ▼파랑=하락)
            &nbsp;|&nbsp;
            <span className="mtag mtb">📋 키워드만 입력 시</span> 검색결과 상위 100위 전체 목록
          </div>
        </div>

        {/* 모드A: 상호명 순위 결과 */}
        {result && !result.need_collect && (
          <div className="result-wrap">
            <div className="res-hdr">
              <div>
                <div className="bname">{result.not_found ? place : result.matched_name}</div>
                <div className="qname">검색어: {currentQuery}</div>
                {!result.not_found && (
                  <div className="cur-row">
                    <span className={`rnum ${tCls(result.rank!)}`}>{result.rank}</span>
                    <span style={{color:'rgba(255,255,255,.55)',fontSize:'.9rem'}}>위</span>
                    <span className={`cbadge ${
                      result.prev_rank==null?'cnw':
                      result.prev_rank===result.rank?'csm':
                      result.prev_rank>result.rank!?'cdn':'cup'
                    }`}>
                      {result.prev_rank==null?'NEW':
                       result.prev_rank===result.rank?'━ 유지':
                       result.prev_rank>result.rank!?`▲${result.prev_rank-result.rank!} 상승`:
                       `▼${result.rank!-result.prev_rank} 하락`}
                    </span>
                    <span style={{color:'rgba(255,255,255,.4)',fontSize:'.7rem'}}>
                      수집: {result.collected_at?.slice(0,16)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {result.not_found ? (
              <div className="not-found" style={{margin:0,borderRadius:'0 0 var(--r) var(--r)'}}>
                <b>"{currentPlace}"</b>을(를) <b>"{currentQuery}"</b> 검색결과 <b>{result.total_collected}위</b> 내에서 찾을 수 없습니다.<br/>
                <span style={{fontSize:'.8rem',color:'#888',marginTop:6,display:'block'}}>
                  상호명 입력란을 비우고 전체 순위에서 정확한 업체명을 확인 후 다시 입력해주세요.
                </span>
              </div>
            ) : buildDateTable(result.history||[], currentQuery, result.matched_name||'')}
          </div>
        )}

        {/* 모드B: 전체 순위 */}
        {rankList && (
          <div className="ranking-wrap">
            <div className="res-hdr">
              <div>
                <div className="bname">"{rankMeta?.query}" 검색결과 상위 100위</div>
                <div className="qname">수집: {rankMeta?.collected_at?.slice(0,16)} · {rankList.length}개</div>
              </div>
            </div>
            <div className="rlt">
              <table>
                <thead><tr>
                  <th style={{width:46,textAlign:'center'}}>순위</th>
                  <th>상호명</th>
                  <th style={{width:90}}>카테고리</th>
                  <th style={{width:80,textAlign:'right'}}>블로그</th>
                  <th style={{width:80,textAlign:'right'}}>방문자</th>
                  <th style={{width:75,textAlign:'right'}}>총리뷰</th>
                  <th>주소</th>
                  <th style={{width:58,textAlign:'center'}}>추적</th>
                </tr></thead>
                <tbody>
                  {rankList.map(r=>(
                    <tr key={r.rank}>
                      <td className={`rl-r ${tCls(r.rank)}`}>{r.rank}</td>
                      <td><div className="rl-n">{r.place_name}</div><div className="rl-c">{r.category||''}</div></td>
                      <td style={{fontSize:'.74rem',color:'var(--sub)'}}>{r.category||'—'}</td>
                      <td className="rl-num" style={{color:'var(--gd)',textAlign:'right'}}>{(r.blog||0).toLocaleString()}</td>
                      <td className="rl-num" style={{color:'var(--blue)',textAlign:'right'}}>{(r.visit||0).toLocaleString()}</td>
                      <td className="rl-num" style={{fontWeight:600,textAlign:'right'}}>{(r.total||0).toLocaleString()}</td>
                      <td className="rl-adr" title={r.address||''}>{r.address||'—'}</td>
                      <td style={{textAlign:'center'}}>
                        <button className="btn-trk" onClick={()=>{setQuery(rankMeta?.query||'');setPlace(r.place_name);setTimeout(()=>doSearch(),100)}}>+추적</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 추적 목록 */}
        <div className="tcard">
          <div className="tcard-hdr">
            <h3>📌 추적 중인 목록 <span style={{fontSize:'.7rem',color:'var(--sub)',fontWeight:400,marginLeft:4}}>(매일 오전 11:00 자동수집)</span></h3>
            <button className="btn-sm" onClick={loadTargets}>↻ 새로고침</button>
          </div>
          {targets.length===0 ? (
            <div className="empty">📭 추적 중인 항목이 없습니다.<br/><small>검색어 + 상호명 입력 후 순위 확인을 누르면 자동 등록됩니다.</small></div>
          ) : targets.map(t=>{
            const nm=t.matched_name||t.place_name_input
            const rc=t.latest_rank?tCls(t.latest_rank):''
            return (
              <div key={`${t.search_query}-${t.place_name_input}`} className="trow"
                onClick={()=>{setQuery(t.search_query);setPlace(t.place_name_input);setTimeout(()=>doSearch(),100)}}>
                <div className="t-info">
                  <div className="t-q">{t.search_query}</div>
                  <div className="t-p">{nm}</div>
                </div>
                <div className={`t-rank ${rc}`}>{t.latest_rank?`${t.latest_rank}위`:'—'}</div>
                <span className="t-days">D-{t.days_left}</span>
                <button className="t-del" onClick={async e=>{
                  e.stopPropagation()
                  if(!confirm(`"${t.search_query} / ${nm}" 추적 중단?`))return
                  await fetch(`/api/targets?query=${encodeURIComponent(t.search_query)}&place=${encodeURIComponent(t.place_name_input)}`,{method:'DELETE'})
                  loadTargets()
                }}>✕</button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
