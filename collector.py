#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
네이버 플레이스 수집기 (PC용)
────────────────────────────
수집 후 naverv.pages.dev 에 데이터를 전송합니다.

설치:  pip install playwright requests && playwright install chromium
실행:  python collector.py
"""

import json, logging, re, sys, time
from datetime import datetime
from urllib.parse import quote

import requests

# ── ★ 설정 (여기만 수정) ────────────────────────
CLOUD_URL  = "https://naverv.pages.dev"   # Cloudflare Pages URL
API_SECRET = "tnsgml2199"           # Cloudflare Pages 환경변수와 동일하게
QUERIES    = ["검단신도시미용실"]            # 수집할 검색어 목록
MAX_ITEMS  = 100
HEADLESS   = True   # False 로 바꾸면 브라우저 창이 보임
# ────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("collector.log", encoding="utf-8"),
    ]
)
log = logging.getLogger(__name__)


class NaverScraper:
    UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
          "AppleWebKit/537.36 (KHTML, like Gecko) "
          "Chrome/124.0.0.0 Safari/537.36")

    def collect(self, query: str, max_items=100) -> list:
        """네이버 플레이스 검색 결과 수집"""
        log.info("수집 시작: '%s'", query)

        # 1단계: requests 직접 시도 (빠름)
        try:
            places = self._try_requests(query, max_items)
            if places:
                log.info("requests 방식 성공: %d개", len(places))
                return places
        except Exception as e:
            log.warning("requests 실패 → 브라우저 방식으로 시도: %s", e)

        # 2단계: Playwright 브라우저 방식
        return self._try_playwright(query, max_items)

    def _build_url(self, query: str, page: int) -> str:
        return (
            f"https://map.naver.com/p/api/search/allSearch"
            f"?caller=pcweb&query={quote(query)}"
            f"&type=all&page={page}&displayCount=20"
            f"&isPlaceOrderByCategoryCount=false&lang=ko"
        )

    def _try_requests(self, query: str, max_items: int) -> list:
        session = requests.Session()
        session.headers.update({
            "User-Agent":      self.UA,
            "Accept":          "application/json",
            "Accept-Language": "ko-KR,ko;q=0.9",
            "Referer":         "https://map.naver.com/",
        })
        all_places = []
        for pg in range(1, (max_items // 20) + 1):
            url = self._build_url(query, pg)
            r = session.get(url, timeout=12)
            r.raise_for_status()
            items = r.json()["result"]["place"]["list"]
            if not items:
                break
            for item in items:
                p = self._parse(item)
                if p:
                    all_places.append(p)
                    log.info("[%3d] %-30s 블:%5d 방:%5d",
                             p["rank"], p["name"], p["blog"], p["visit"])
            log.info("Page %d 완료: %d개 → 누계 %d개", pg, len(items), len(all_places))
            time.sleep(0.8)
        return all_places[:max_items]

    def _try_playwright(self, query: str, max_items: int) -> list:
        from playwright.sync_api import sync_playwright
        all_places = []
        seen = set()
        captured_url: list = [None]

        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=HEADLESS,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
            )
            ctx = browser.new_context(user_agent=self.UA, locale="ko-KR", viewport={"width":1280,"height":900})
            page = ctx.new_page()

            def on_response(response):
                if "allSearch" not in response.url:
                    return
                try:
                    items = response.json().get("result",{}).get("place",{}).get("list",[])
                    if not items:
                        return
                    if captured_url[0] is None:
                        captured_url[0] = response.url
                        log.info("[PW] 브라우저 URL 캡처 완료")
                    added = 0
                    for item in items:
                        p = self._parse(item)
                        if p and p["rank"] not in seen:
                            seen.add(p["rank"])
                            all_places.append(p)
                            added += 1
                    if added:
                        log.info("[PW] +%d개 → 누계 %d개", added, len(all_places))
                except Exception as e:
                    log.debug("[PW] 파싱 오류: %s", e)

            page.on("response", on_response)

            try:
                page.goto(
                    f"https://map.naver.com/p/search/{quote(query)}",
                    wait_until="networkidle", timeout=30000
                )
            except Exception:
                pass
            time.sleep(3)

            if not captured_url[0]:
                log.warning("[PW] URL 캡처 실패"); browser.close(); return []

            # 캡처된 URL로 page 2~5 요청 (세션 토큰 유지)
            pages_needed = (max_items + 19) // 20
            for pg in range(2, pages_needed + 1):
                if len(all_places) >= max_items:
                    break
                base = captured_url[0]
                pg_url = re.sub(r'page=\d+', f'page={pg}', base) if 'page=' in base else base + f'&page={pg}'
                try:
                    data = page.evaluate("""async (url) => {
                        const r = await fetch(url);
                        if (!r.ok) return null;
                        return r.json();
                    }""", pg_url)
                    if not data:
                        log.warning("[PW] Page %d: 응답 없음 → 중단", pg); break
                    items = data.get("result",{}).get("place",{}).get("list",[])
                    if not items:
                        log.info("[PW] Page %d: 항목 없음 → 중단", pg); break
                    added = 0
                    for item in items:
                        p = self._parse(item)
                        if p and p["rank"] not in seen:
                            seen.add(p["rank"]); all_places.append(p); added += 1
                    log.info("[PW] Page %d: +%d개 → 누계 %d개", pg, added, len(all_places))
                except Exception as e:
                    log.error("[PW] Page %d 오류: %s", pg, e); break
                time.sleep(0.8)

            browser.close()

        all_places.sort(key=lambda x: x["rank"])
        log.info("[PW] 완료: %d개", len(all_places))
        return all_places[:max_items]

    @staticmethod
    def _parse(item: dict):
        name = item.get("name","").strip()
        if not name:
            return None
        cat = item.get("category","")
        if isinstance(cat, list):
            cat = ", ".join(cat)
        return {
            "rank":     int(item.get("rank", 0)),
            "place_id": str(item.get("id","")),
            "name":     name,
            "address":  item.get("roadAddress") or item.get("address",""),
            "category": str(cat),
            "blog":     int(item.get("reviewCount") or 0),
            "visit":    int(item.get("placeReviewCount") or 0),
        }


def push_to_cloud(query: str, places: list, collected_at: str):
    """수집된 데이터를 Cloudflare에 전송"""
    url = f"{CLOUD_URL}/api/collect"
    payload = {
        "api_key":      API_SECRET,
        "query":        query,
        "collected_at": collected_at,
        "places":       places,
    }
    log.info("클라우드 전송 중: %s (%d개)", CLOUD_URL, len(places))
    r = requests.post(url, json=payload, timeout=30)
    if r.status_code == 200:
        log.info("✅ 전송 완료: %s", r.json())
    else:
        log.error("❌ 전송 실패: %d %s", r.status_code, r.text)


def main():
    scraper = NaverScraper()
    collected_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    for query in QUERIES:
        try:
            places = scraper.collect(query, MAX_ITEMS)
            if places:
                push_to_cloud(query, places, collected_at)
            else:
                log.warning("수집 결과 없음: '%s'", query)
        except Exception as e:
            log.error("오류 ('%s'): %s", query, e, exc_info=True)

    log.info("완료!")


if __name__ == "__main__":
    main()
