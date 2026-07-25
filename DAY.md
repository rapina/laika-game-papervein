# PRODUCTION LOG / 2026-07-25 / 종이맥

## 콘셉트 잠금

- 제목: 종이맥 / Paper Vein
- 질문: 벌어지는 종이의 모든 틈을 한 가닥의 섬유로 어떤 순서로 꿰매야 하는가?
- 노리는 재미와 감각: 한 번 당긴 결과가 종이 전체로 번져 다음 선택을 바꾸고, 작은 봉합이 마지막에 단단한 한 장을 만드는 만족감.
- 핵심 입력: 느슨한 섬유 끝을 빈 구멍까지 드래그해 놓는다. 방향키와 Space도 같은 선택·놓기를 수행한다.
- 시스템 반응과 긴장 변화: 봉합은 연결된 틈을 좁히는 대신 실과 장력을 쓰고, 종이는 가만두면 다시 벌어진다. 7개 봉합으로 성공하며 세 번째 파열 또는 실 소진으로 실패한다.
- 재료: 젖은 닥섬유 실, 손으로 뜬 두꺼운 종이, 눌린 구멍, 보풀과 마른 풀 자국.
- 시각 매체: 생성한 종이·섬유 래스터 원재료를 Canvas 2D 변형 경로, 틈 마스크, 판정 주름과 합성한다.
- 대표 색: 주홍 `#E64B32`. 실과 핵심 상태에만 사용한다.
- 세계: 햇빛이 드는 낮은 수선틀에서 젖은 종이 한 장이 마르며 벌어진다.
- 마지막 장면: 종이가 수선틀에서 들리고 역광이 종이결과 주홍 봉합선을 하나의 잎맥 구조로 드러낸다.
- 한 판 길이: 첫 플레이 90–105초, 숙련 60–80초.
- 제외: 바늘 직접 조작, 자유 곡선 자수, 인벤토리, 수집, 업그레이드, 콤보 배지, 장식 파티클, 실 엉킴 물리, 색만의 위험 정보, 정밀 타이밍 보너스, 게임 중 긴 문장.

순서·거리·누적 장력이 같은 드래그의 다음 대상을 바꾸며, 놓은 직후 종이 전체가 실제로 접히거나 반동한다. 반응 정확도만 올리는 구조가 아니라 선택한 순서가 실 잔량과 파열, 완주를 바꾸는 구조라 이 후보를 고정했다.

## 최근 학습 반영

선택한 학습은 두 개다.

1. 무입력 기준선: 초기 최대 벌어짐은 목표에 가깝지만 매초 멀어진다. `verification/playability-result.json`의 실제 step 측정에서 첫 파열 `16.750335초`, 세 번째 파열 종료 `25.600512초`다.
2. 단일 교정 방향: 결과 화면에 규칙 상태의 가장 높은 장력 주름이 가리키는 구멍 하나를 `N번 구멍부터 당겨 보기 / Try hole N first`로 남긴다.

화면 정보만 쓰는 검증 방법: 정책은 화면에 실제로 그리는 `stitched`, 주름 길이의 원천인 `tension`, 현재 실 끝만 읽는다. 같은 500개 시드·같은 9초 행동 간격에서 굵은 주름을 따르는 손과 가장 먼 구멍을 고르는 손을 비교한다. 내부 미래 상태나 닫힌 해법은 읽지 않는다.

## 구현

- `src/game/papervein/rules.mjs`: 시드 결정론, 1/60초 순수 `step`, 봉합·파열·실·결과·가이드 상태.
- `src/game/PaperVeinGame.ts`: 실제 포인터 drag/drop, window 키보드, DPR 캔버스, 고정 스텝 누산기, WebAudio, pause/visibility/mute/locale/restart.
- `design/targets/`: 코드 전에 생성한 390×844 첫 화면·성공·파열·결과 목표와 원본.
- `assets/generated/`, `public/assets/`: 보존한 생성 원본과 실제 타이틀·종이·섬유 자산.
- `scripts/capture-evidence.mjs`: 렌더 캔버스에 실제 포인터 move/down/move/up을 넣어 첫 화면·성공·파열·게임오버를 캡처한다.
- `scripts/depth-ab.mjs`: 실제 step을 호출하는 500시드 깊이 A/B를 고정 증거로 쓴다.

## 감산

### 1차

플레이 밖 셸의 랭킹·광고·결과 화면 전환, 게임 중 나가기 버튼, 사용하지 않는 반복 BGM과 템플릿 MP3를 제거했다. 확보한 화면과 오디오 범위를 종이 변형, 당김 이중음, 파열의 종이 반동에 재투자했다.

### 2차

미봉합 틈의 검은 폭을 줄이고 결과 화면을 판 종료·남은 실·파열·교정 한 줄·재시작 안내만 남겼다. 장력 주름, 7개 봉합, 파열 3회, 실 잔량은 다음 선택과 종료에 직접 관여하므로 유지했다.

## 목표 화면 대조

- 재료 질감: 목표의 사진적 깊이를 그대로 복제하지 않고 생성 종이 원재료를 반복 패턴으로 써 작은 화면에서 틈과 구멍의 판독을 우선했다.
- 핵심 동사: 목표처럼 성공은 틈이 닫히고 실이 팽팽해지며, 파열은 갈라진 이중 외곽선·진동 무늬·종이 반동으로 구분된다. 실제 캡처는 `verification/verb-success.png`, `verification/verb-fail.png`다.
- 정보: 목표의 고정 상단 설명을 첫 성공 2회까지만 보이는 종이 라벨로 줄였다. 세 답과 HUD는 유지했다.
- 마지막 장면: 목표의 사진 같은 완성 종이 대신 실제 플레이에서 누적한 봉합 경로를 그대로 남기고 종이를 들어 역광을 더한다. 플레이 결과의 형태 보존을 위한 의도적 차이다.

## 검증

- 결정론: `npm test` — 4 files, 23 tests 통과. 규칙 전용 6 tests 포함.
- 타입: `npx tsc -b` — 오류 0.
- 웹: `npm run build:web` — 성공, 주 번들 219.66KB / gzip 71.74KB.
- 실제 입력: `node scripts/capture-evidence.mjs` — `verification/capture-result.json` pass. 성공 `closedCount=1`, 파열 `ruptures=1`, 실제 입력 완주 `outcome=complete, closedCount=7`, 실패 게임오버 `over=true`; 콘솔 오류·페이지 오류·실패 요청 0.
- 건설 프로필: `node scripts/playability-sim.mjs` — `verification/playability-result.json` pass. 500시드 guided 완주율 1.0, 평균 63.001초, 평균 실 37.448, 평균 파열 1.936. 동일 시드의 주름 무시 정책 완주율 0, 완주율 차이 +100%p.
- 깊이 A/B: `node scripts/depth-ab.mjs` — `verification/depth-ab.json` pass.
- 무입력: 첫 파열 16.750335초, 세 번째 파열 종료 25.600512초.
- 프로필 한계: 포인터 조준 오차는 모델링하지 않는다. 규칙과 무관한 보풀·미세 흔들림은 결정론 밖이다.
- 스모크: `npm run smoke` — `smoke-result.json`에서 `mounted`, `finished`, `resultDelivered`, `restartVerified` 모두 true, 콘솔·페이지 오류 0.
- 뷰포트: `node scripts/viewport-smoke.mjs` — `verification/viewport-result.json` pass. 360×800, 390×844, 430×932, 900×760의 standalone/portal 8개 형상과 ko/en 결과 4개 조합 모두 통과. 430×932 유효 backing ratio는 standalone 3.0000/3.0003, portal 3.0007/3.0000.
- 아케이드: `npm run build:arcade` — 7개 불변 파일, 2,302,471 bytes, JS gzip 76,897 bytes. `dist-arcade/release.json` 검증 통과.
- CSP: `npm run csp` — `verification/csp-portal-result.json` pass. sandbox iframe 안 실제 pointer drag가 `closedCount 0→1`, `event=stitch`, 실 7.66 소모. CSP 위반·누락 자산·오류 0.
- 증거 결속: 최종 소스 해시 `6ee70486953d1ff8ed1b7f6f268538ea75f1ad5513db0ce92be7032fa5d77b75`가 capture, playability, depth A/B, smoke, viewport에 일치한다.

## 결과

- 상태: production candidate
- 게임 잠금: 브랜드 중립 제작 검증 통과
- 알려진 문제: 인앱 브라우저 연결은 이 환경에서 사용 가능한 브라우저가 없어 열리지 않았다. 저장소의 Playwright 검증 스크립트와 캡처 증거로 실제 입력·화면을 검증했다. Sonatype 조회는 인증 토큰 부재로 실패했다. 새 의존성 추가·업그레이드 없이 lockfile 그대로 `npm ci`했으며 npm은 기존 전이 의존성에서 48건(critical 4, high 24, moderate 5, low 15)을 보고했다.

## 런치패드 피드백

- 재사용 후보: 아직 없음. 두 번째 사용처가 확인되기 전에는 역이식하지 않는다.
- 게임에 남길 코드: 종이맥 규칙, 캔버스 렌더, 실제 입력 캡처, 깊이 A/B 어댑터.
- 다음 게임에서 재검증할 항목: 자연 파열 뒤 전체 반동과 긴 파열 보호가 다른 누적 재료에서도 읽히는가.
