// 키워드="테스트", 상호명="테스트" 입력 시 30일치 더미 데이터 반환

export const DUMMY_QUERY = '테스트'
export const DUMMY_PLACE = '테스트'

export function isDummy(query: string, place: string) {
  return query === DUMMY_QUERY && place === DUMMY_PLACE
}

// 30일 고정 더미 값 (인덱스 0 = 30일 전, 인덱스 29 = 오늘)
const RANKS  = [15,14,14,13,13,12,11,12,11,10,10,9,10,9,8,9,8,7,8,7,6,7,6,5,6,5,4,5,4,3]
const BLOGS  = [810,825,840,855,870,890,905,920,940,955,975,990,1010,1025,1045,1065,1085,1100,1120,1140,1165,1185,1205,1230,1255,1280,1305,1330,1360,1390]
const VISITS = [3050,3100,3150,3200,3260,3310,3360,3420,3480,3530,3590,3650,3710,3770,3830,3890,3950,4010,4070,4130,4200,4260,4320,4390,4450,4510,4580,4650,4720,4790]

export function getDummyHistory(todayKst: string) {
  const base = new Date(todayKst + 'T12:00:00+09:00')
  return RANKS.map((rank, i) => {
    const dt = new Date(base)
    dt.setDate(dt.getDate() - (29 - i))
    const date = dt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    return { date, rank, blog: BLOGS[i], visit: VISITS[i] }
  })
}

export function getDummySingle(todayKst: string) {
  const history = getDummyHistory(todayKst)
  const last = history[history.length - 1]
  const prev = history[history.length - 2]
  return {
    matched_name: DUMMY_PLACE,
    rank: last.rank,
    prev_rank: prev.rank,
    blog: last.blog,
    visit: last.visit,
    collected_at: todayKst + 'T11:30:00',
    history,
  }
}

export function getDummyList(todayKst: string) {
  const history = getDummyHistory(todayKst)
  const last = history[history.length - 1]
  return {
    collected_at: todayKst + 'T11:30:00',
    list: [
      { rank: 1,          place_name: '1위샘플업체',  category: '미용실', blog: 2500, visit: 8200, address: '인천광역시 서구 샘플로 1' },
      { rank: 2,          place_name: '2위샘플업체',  category: '미용실', blog: 2100, visit: 7100, address: '인천광역시 서구 샘플로 2' },
      { rank: last.rank,  place_name: DUMMY_PLACE,    category: '테스트업체', blog: last.blog, visit: last.visit, address: '인천광역시 서구 테스트로 123' },
      { rank: last.rank + 1, place_name: '기타업체A', category: '미용실', blog: 980,  visit: 3200, address: '' },
      { rank: last.rank + 2, place_name: '기타업체B', category: '미용실', blog: 870,  visit: 2900, address: '' },
    ].sort((a, b) => a.rank - b.rank),
  }
}
