# K-Food Map — 개발계획 인수인계 (Growth Plan Handoff)

**작성일:** 2026-08-02 · **기준 커밋:** `4b775c5`
**용도:** 원격/새 세션이 이 문서 하나로 개발을 이어받기 위한 인수인계.
**주의:** 엔지니어링 상태의 유일한 정본은 `HANDOFF.md`다. 이 문서는 그 위에
얹힌 *성장 계획*이며, 둘이 충돌하면 HANDOFF와 저장소 실측이 이긴다.

---

## 1. 현재 상태 스냅샷

| 항목 | 상태 |
|---|---|
| 로컬 폴더 | `바탕화면\KF 디지털 공공외교 아카데미\k-food-map` |
| GitHub | `rkdals0121/kfoodmap` (master) — **이 저장소가 K-Food Map 소유** |
| 배포 | `kfoodmap.vercel.app` (Vercel, master push 시 자동 배포) |
| 형제 프로젝트 | 밥친구/Eatple은 **별도** — `베이스` 폴더 → `rkdals0121/test` → `test-umber-phi-78.vercel.app`. 2026-08-02 사건(밥친구가 이 저장소를 덮음) 후 3중 잠금으로 분리 완료. 전말은 HANDOFF §2.16 |
| 데이터 | 20곳 (18 active, 2 quarantined) — 전수 검증 완료 (Phase 3) |
| v1.0 | `07feea7`에서 출하. 이후 Phase 6 MVP 4개 커밋됨: Passport Enhancement(`c01db9c`), ESG Explorer(`3a0ca9f`), Nearby Route(`8807bac`), Story Timeline(`31e4b2f`) |
| 외부 셸 개편 | `9b84565..b160514` (2026-07-23/24): Prologue 온보딩, 사이드바/모바일 바텀시트 셸, Naver·Kakao 길안내 버튼, Journal 재설계. **게이트 밖에서 진행됨** — 남긴 빚은 HANDOFF §7 Low #20 |

## 2. 프로젝트 헌법 (요약 — 전문은 HANDOFF §11)

1. **신뢰가 제품이다.** 모든 표시 주장 = 검증됐거나 정직하게 unknown.
   식이 정보(할랄/비건)는 안전 문제 — 절대 추론·발명하지 않는다.
2. **Repository가 유일한 진실.** 계획·결정은 저장소에 적혀야 실재한다.
3. **한 기능 = 한 검증 = 한 커밋.** 배치 금지. 커밋 전 게이트 전부 실행:
   ```
   npm run check-data      # "No violations." 필수
   npm run lint            # 현재 기준선 1 경고 (utils.js kakaoMapUrl origin, 의도적)
   npm run build
   grep -rc retrievedBy dist/   # 0 필수
   node scripts/evidence-hash.mjs --check # 0 pending, 0 drifted 필수
   ```
   UI 변경은 브라우저 실검증 필수 (§11 rule 16).
4. **아키텍처 동결** — Confidence Model / Evidence Layer / Lifecycle은
   확장만 하고 재설계하지 않는다. 예외는 아래 §5의 보류 결정 2건뿐.
5. **HANDOFF 동기화** — 변경과 같은 커밋에서 갱신, 수치는 재측정.

## 3. 왜 이 계획인가 (시장 분석 결론 압축)

2026-08-02에 eatpass.kr(미식여권 — 같은 장르의 거울상 서비스) 및 시장
앱들(HappyCow, 미쉐린, Foursquare, Wanderlog, TripAdvisor 등)을 분석했다.

- **eatpass의 교훈:** 3,867곳 대량 임포트 → 전부 "평점 없음·방문 0"의
  유령 도시 + 폐업 데이터 방치. **넓이는 신뢰 없이 무의미하다.**
  반대로 그들의 성장 장치는 훌륭하다: 로그아웃 샘플 여권, 지도서비스
  자동채움 제보 폼(어드민 검수), 빈 화면→기여 유도, URL 라우팅+SEO.
- **HappyCow의 교훈:** "식이 신뢰" 틈새 하나로 글로벌 충성 사용자 확보
  가능 — 우리 노선의 실증.
- **한국 특수성:** Google Maps는 한국에서 길안내가 반쪽 — 방한 외국인의
  1번 불편. Naver/Kakao 딥링크 선택지가 실질 가치 (이미 일부 구현됨).
- **결론 곡선:** 신뢰 자산을 UX로 전면화 → 문 넓히기(공유·검색·언어) →
  사용자가 검증 파이프라인에 리드 공급 → 그때 규모 확장.
  **대량 임포트는 영구 금지.**

## 4. 단계별 계획

### Stage 0 — 하우스키핑 ✅ 완료 (2026-08-02)
- ✅ 저장소 분리 (밥친구 사건 해결, §2.16)
- ✅ HANDOFF 재동기화 (`4b775c5`)
- ✅ **하우스키핑 커밋** — 내용:
  - `temp.js`, `.claude/launch.json` untrack + `.gitignore` 등록, `temp.js` 삭제
  - lint 경고 15→1 (13건 제거 + geocode_and_build.cjs 2건 수정; 남은 1건은
    `utils.js`의 `kakaoMapUrl` origin 미사용 — Kakao 라우팅 미구현은 실제
    기능 작업이라 의도적으로 남기고 주석으로 기록)
  - **결정 A (사용자):** GH Pages 워크플로 삭제 → 완료, Vercel 단일 배포
  - **결정 B (사용자):** 배지 실데이터 연결 → 완료. First Taste=방문≥1,
    Plant Based=방문한 곳 중 `dietary.vegan.value === VEGAN.FULL` 존재.
    Spicy Master는 계산 불가능한 필드라 제거
  - 전문은 HANDOFF §7 #13·#14·#20, §12

### Stage 1 — 공유 가능한 앱 ✅ 완료 (2026-08-03)
- ✅ **결정 C (사용자):** URL 라우팅 도입 승인. `react-router` +
  URL이 `selectedRestaurant`의 진실 소스가 되는 구조로 구현
  (`/`, `/place/:id`). `superpowers:brainstorming` → `writing-plans` →
  `subagent-driven-development`로 설계·계획·구현·리뷰를 거쳤다.
- ✅ 페이지별 title/meta: 빌드 후 `scripts/prerender-places.mjs`가 활성
  식당 18곳 각각에 `dist/place/<id>/index.html`(og:title/description/url
  + canonical 포함 — og:image는 SVG라 크롤러가 못 읽어 제외, HANDOFF §7)를
  정적 생성 — 헤드리스 브라우저 없이,
  크롤러(카카오톡/페이스북/트위터)가 실제로 보는 HTML까지 정확함.
  quarantine 2곳(akiya, makan)은 발견 표면 제외 원칙에 따라 프리렌더도
  라우트도 없음.
- 설계 문서: `docs/superpowers/specs/2026-08-02-routing-design.md`
- 계획·리뷰 기록: `docs/superpowers/plans/2026-08-02-stage1-routing.md`
- 상세는 HANDOFF §2.1, §12

### Stage 2 — 활성화 (백엔드 불필요, 작은 단위 여러 개)
1. ✅ **샘플 여권 완료 (2026-08-03)** — Journal이 비어있을 때(북마크 0개)
   실제 식당 3곳(gonghwachun·kampungku·plant-cafe, 각각 `SAMPLE_IDS`
   상수 + isQuarantined 필터 통과분만)을 "SAMPLE" 라벨을 붙여 실제
   스탬프와 같은 모양으로 미리보기. 방문일자 등 실데이터처럼 보일 수
   있는 요소는 전부 배제 — 라벨로만 구분. 이어서 "1. 찾기 2. 하트로
   저장 3. 방문 후 체크" 3단계 안내(기존에 있었지만 안 쓰이던 CSS
   재사용). 브라우저 실검증(모바일/데스크톱).
2. **빈 상태 전면 개선** — Journal 빈 상태는 위 항목으로 사실상 처리됨.
   남은 범위: 다른 막다른 화면들(예: 필터 결과 0건인 "No places match")
   — `BottomSheetList`의 기존 빈 상태는 이미 "필터 제거해보라"는
   제안이 있어 우선순위 낮음
3. **Food Journey MVP** — 편집 저작 코스 1개 (예: 이태원 할랄 반나절 —
   검증된 eid·kampungku 중심). 기획은 Phase 6 계획에서 동결됨:
   테마 큐레이션이지 경로 계산이 아님. 이동은 Nearby Route 책임
4. **Offline MVP** — 정적 데이터의 오프라인 이용 (기획 동결됨.
   지도 타일은 범위 밖)
5. ✅ **신뢰의 전면화 완료 (2026-08-03, `125667d`)** — Prologue 1단계에
   활성 식당 수(데이터에서 계산, 하드코딩 아님) + "researched one at a
   time — every claim sourced, or marked honestly unknown" 명시.
   "verified"나 퍼센트 표현은 의도적으로 안 씀 — HANDOFF §8이 이미
   "단일 % verified 수치는 무의미"라고 못 박아둠. 홈 화면 상단(매번
   보이는 곳)이 아니라 Prologue 1회성 화면에만 배치 — 상시 배너로
   화면을 어지럽히지 않기 위함

### Stage 3 — 도달
- **Multilingual MVP** — UI + 안전 라벨만 (동결된 범위). 영어 우선.
  편집 콘텐츠(story 등) 번역은 범위 밖. 안전 라벨 번역은 검증 가능
  인력 확보가 전제 (P0의 "자신 있게 틀림"을 번역으로 재도입 금지)

### Stage 4 — 커뮤니티/규모 (백엔드 결정 필요)
- ⚠️ **미결정 D:** §2.1 no-backend 수정 (Supabase류 최소 도입 권장,
  정적 데이터는 계속 코어). AI Food Guide·Sync·UGC 셋이 이 결정에 걸림
- **UGC 제보** — eatpass식 자동채움 폼(이름→Naver/Kakao에서 주소·좌표
  자동) + 우리 검증 큐. **제보는 절대 직접 게시되지 않는다** (§2.11)
- **Cross-Device Sync** — 여권을 계정에 (동결된 MVP)
- **데이터 확장 파이프라인** — 공공데이터·제보는 *리드 큐*로만 받고,
  Phase 3 검증 워크플로 통과분만 게시. 확장 축: 할랄 클러스터 심화,
  전통시장·다회용기 식당 (창립 제안서 항목, 현재 0곳)

### 영구 금지
대량 임포트 · 별점/리뷰 · ESG 점수/랭킹 · 앱 내 경로 렌더링 ·
esg_point 텍스트에서 카테고리 유도 · 게이트 밖 작업(§2.16 재발 금지)

## 5. 보류 중인 결정 (사용자만 정할 수 있음)

| ID | 결정 | 막고 있는 것 |
|---|---|---|
| A | ✅ GH Pages 워크플로 삭제 (2026-08-02 결정: 삭제) | — 완료 |
| B | ✅ 배지 목업 처리 (2026-08-02 결정: 실연결) | — 완료 |
| C | ✅ §2.1 "no router" 수정 (2026-08-03 결정: 승인, URL 라우팅 구현) | — 완료 |
| D | §2.1 "no backend" 수정 (관리형 백엔드)? | Stage 4 전체 |

## 6. 새 세션 시작 절차

1. `git pull` 후 `HANDOFF.md` 헤더와 §12, 이 문서를 읽는다
2. `git log --oneline -10`과 게이트 5종으로 현재 상태를 실측한다
   (문서를 믿지 말고 측정할 것 — 이 프로젝트의 규칙)
3. 위 §4에서 다음 ⬜ 항목을 찾아, 미결정이 걸려 있으면 사용자에게
   먼저 묻고, 아니면 §2의 규율대로 구현→검증→단일 커밋
4. 커밋·push 전 사용자 승인. push는 Vercel 자동 배포를 의미한다
