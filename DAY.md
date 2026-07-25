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

## 독립 검토 blocked 수정

- 독립 검토 `design-review.json`은 sourceHash `6ee70486953d1ff8ed1b7f6f268538ea75f1ad5513db0ce92be7032fa5d77b75`에서 빠른 인접 봉합이 실제 포인터 `3.48초`, 키보드 `2.43초`에 무파열 완주해 60–80초 건설 리듬과 굵은 주름 선택을 우회한다는 fatal을 남겼다. 이 검토 파일은 수정하지 않았다.
- 각 유효 봉합 뒤 순수 규칙 `step`이 `stabilizationRemaining`을 9초 동안 줄인다. 마지막 봉합도 안정화가 끝나야 성공한다. 주홍 실 끝이 구멍 가까이 팽팽한 상태에서 천천히 느슨해지고, 구멍 원형 진행과 이완 중 상태 문구가 같은 readiness를 보여 준다. 이때 실제 포인터로 다시 놓으면 봉합·실 차감 없이 종이 반동과 `아직 팽팽하다 / STILL TAUT`가 나오며, capture 해제 뒤 readiness에서 같은 drag가 정상 봉합된다.
- 안정화 끝에는 가장 장력이 높은 미봉합 구멍으로 세 굵은 주름이 수렴하고 `느슨해졌다 · 굵은 주름부터 / LOOSE · FOLLOW THE BOLD CREASE`가 잠시 남는다. 첫판 가이드도 `실이 느슨해진 뒤 / When the strand loosens`를 명시한다.
- `stitchPreview()`가 비용 `5 + 2.4d + 4 × tension + 1.5 × priorRuptures`, 봉합 뒤 실 잔량, 실제 놓은 직후 장력 `tension + 0.08 + 0.1d`, 파열 위험을 한 번 계산한다. 캔버스는 내부 비용 대신 `실 78.0 남음 / 78.0 THREAD LEFT`를 표시하고, predicted tension `0.72` 이상이면 놓기 전에 이중 외곽선과 진동 무늬를 그린다.
- 성공 결과판은 화면 아래 137px의 58% 반투명 띠로 줄였다. 중앙의 들린 종이, 역광, 누적 주홍 잎맥은 가리지 않으며 실패 결과판은 원인 판독 대비를 유지한다.

### 수정 검증

- `npm test` — 4 files, 26 tests 통과. cooldown 조기 재입력 반동·readiness 뒤 복구, exact preview 비용과 실제 차감, predicted tension 위험 예고, 무입력, 마지막 안정화 뒤 60–80초 완주를 포함한다.
- `npx tsc -b` — 오류 0.
- `npm run build:web` — 성공, 주 번들 224.65KB / gzip 73.03KB.
- `node scripts/capture-evidence.mjs` — `verification/capture-result.json` pass. 실제 포인터 target 7 preview는 predicted tension `0.83518`, 사전 위험 예고 true, 놓은 순간 확정 비용 `22.01792`와 실제 차감 `22.01792`가 일치하고 실제 파열했다. cooldown 중 같은 포인터 drag는 `closedCount=1`, `rejectedStitches=1`로 반동한 뒤 실제 readiness에서 `closedCount=2`로 회복했다. 실제 7봉합 완주는 `66.784669초`, 실패는 세 번째 파열 `19.783729초`; ko/en 가이드 시점, success/rupture/complete/fail, 콘솔·페이지·요청 오류 0을 확인했다.
- 캡처 수정 중 첫 실행은 drag 중간의 stale target 3 preview를 읽어 evidence가 실패했다. 최종 target 7을 기다리게 고쳤다. 두 번째 실행은 drag 중 미세 장력 감쇠 전 preview와 놓는 순간 비용을 비교해 evidence가 실패했다. 화면과 규칙이 공유하는 놓는 순간 `lastCommittedPreview`를 실제 차감에 결속하고, 표시 잔량은 0.1 정밀도에서 일치하는지 분리 검증했다. 세 번째 실행의 이름별 13 checks는 모두 true다.
- `node scripts/playability-sim.mjs 500` — `verification/playability-result.json` pass. 임의 9초 sleep 없이 실제 `stabilizationRemaining <= 0`만 보고 행동했다. 대표 행동 시각 `0, 9.00018, 18.00036, 27.00054, 36.00072, 45.0009, 54.00108초`; 500시드 굵은 주름 정책 완주율 `1.0`, 평균 `63.001초`, 평균 실 `41.720`, 평균 파열 `0`.
- `node scripts/depth-ab.mjs` — `verification/depth-ab.json` pass. 같은 500시드에서 굵은 주름 정책 완주율 `1.0`, 먼 구멍 우선 정책 `0`, 완주율 우위 `+100%p`.
- 무입력 actual step 기준 첫 파열 `16.750335초`, 세 번째 파열 종료 `25.600512초`.
- `npm run smoke` — `smoke-result.json`에서 `mounted`, `finished`, `resultDelivered`, `restartVerified` 모두 true, 오류 0.
- `node scripts/viewport-smoke.mjs` — `verification/viewport-result.json` pass. 4 뷰포트 × standalone/portal 8개 형상, 360×800 ko/en × standalone/portal 게임오버 4개가 모두 통과했다.
- `npm run build:arcade` — 7개 불변 파일, 2,309,028 bytes, JS gzip 78,412 bytes; `release.json` 검증 통과.
- `npm run csp` — `verification/csp-portal-result.json` pass. sandbox iframe 안 실제 drag가 `closedCount 0→1`, 확정 preview 비용과 실제 차감 일치, CSP 위반·누락 자산·오류 0.
- 최종 sourceHash `af5e433e66853f7fdfdc4dbee902e222358ee6350743ae1e579b9c0d90c0adcb`가 capture, playability, depth A/B, smoke, viewport에 일치한다.

## 공개 서사 산출물

- `WHY.md`에 라이카의 한국어·영어 작품 노트를 같은 선택과 감각으로 작성했다.
- `brand/art/laika-base.png`를 실제 참조로 Codex 내장 `image_gen`을 사용해 `art/source/laika-papervein.png`를 생성했다.
- 재현 프롬프트는 `art/prompts/laika-papervein.md`, 해시와 얼굴·발·문자·모바일 크롭 검수는 `art/provenance/laika-papervein.json`에 기록했다.
- 웹 파생본은 `public/art/laika-papervein-640.jpg`와 `public/art/laika-papervein-1280.jpg`다. 생성 원본 PNG는 릴리스 경로에 넣지 않았다.
- `game.manifest.json`에는 잠긴 필드를 유지하고 `credits`, `whyCreated`, `media.makerIllustration`만 추가했다. 실제 제작 모델은 `gpt-5.6-sol`로 기록했다.
- 아케이드 등록용 설계 요약과 체르파 검토 문구는 `/tmp/papervein-public-copy.json`에 준비했다. 첫 검토에서 공개를 멈춘 이력과 첫 플레이 길이가 약속보다 짧았던 차이를 숨기지 않았다.

## 공개 서사 잠금 검증

- `node /Users/rapina/work/toss-game-studio/scripts/prepare-editorial.mjs --game /Users/rapina/work/toss-game-studio/games/2026/2026-07-25-papervein --verify` → `status: verified`, 잠긴 파일 199개 확인.
- `git diff --exit-code HEAD -- .creator-lock.json` → 차이 없음.

## 독립 설계 재검토

- 첫 검토는 `blocked`였다. 실제 포인터로 가까운 구멍만 쉬지 않고 이으면 `3.48초`, 키보드는 `2.43초`에 무파열 완주해 굵은 주름 선택과 건설 리듬을 우회했다.
- 수정 뒤 별도 에이전트가 잠긴 빌드를 새로 검토했고 `pass`했다. 직관 3판은 `68.07–69.18초`, 숙련 3판은 `68.05–68.42초`, 자연 입력 3판은 `68.60–69.63초`에 모두 완주했다. 굵은 주름을 무시한 먼 구멍 우선 3판은 모두 약 20초에 세 번째 파열로 실패했다.
- 포인터 완주 `66.88초`, 키보드 완주 `66.53초`, 무입력 종료 `25.85초`였다. 놓기 전 갈라진 외곽선과 진동 무늬가 실제 파열을 예고했고, 표시 실 잔량과 확정 비용은 같은 놓기 시점의 규칙값에 결속됐다.
- 치명 항목은 0개였다. 남은 차이는 처음 하는 손도 익숙한 손과 비슷한 시간에 끝나, 콘셉트 잠금의 첫 플레이 `90–105초` 약속을 재현하지 못한 점이다.

## 아케이드 공개

- 최종 게임 커밋과 공개 아티팩트 버전: `2a9fb2287750e6c4a66e7d5891d5016837856bb4`.
- 최종 릴리스: 9개 파일, 3,158,186 bytes, code gzip 78,412 bytes, manifest SHA-256 `769ab1439283549bac3d9f684a7fde82e0f7e53b2036849734d89e2689d6b54d`.
- `publish-game`은 게임 테스트 26개, 스모크, 뷰포트, 웹·Toss·아케이드 빌드, 불변 자산 업로드, preview와 production 실제 완주를 모두 통과했다.
- preview 실제 포인터 완주 `65.967986초`, 7/7 봉합, 파열 0, 오류 0. production deployment는 `66.084655초`, 7/7, 파열 1, 오류 0. 운영 URL은 `65.917985초`, 7/7, 파열 0, 오류 0.
- 공개 URL: `https://laika365.vercel.app/play/papervein`.
- Toss `.ait` 산출물은 만들었지만 제출·출시는 운영자 승인 범위라 실행하지 않았다.
- 첫 dry-run은 정상 결과 HUD의 `strokeRect`를 디버그 외곽선으로 오인해 실패했다. 채워진 패널의 엄격히 대칭인 0.5–1px 안쪽 테두리만 허용하도록 검사와 회귀 테스트를 고쳤다.
- 두 번째 dry-run은 코드보다 먼저 만든 `design/targets`의 파일 시각을 source freshness 실패로 보았다. 목표 화면은 캡처 증거의 sourceHash로 결속하고, 증거 없는 일반 이미지는 기존 시각 검사를 유지하도록 고쳤다.
- Vercel production 스모크는 결과 파일을 쓴 뒤 파일 감시 핸들이 늦게 닫혀 프로세스 종료가 약 5분 지연됐다. 결과와 배포는 성공했으며 종료 직전에 자연 해제되어 강제 종료하지 않았다.

## 공개 뒤 지구 평가

- 독립 평가자가 운영 URL에서 한국어 실제 포인터 드래그로 3판을 플레이했다. 브라우저 커넥터가 없어 로컬 Chrome과 Playwright를 사용했고, 운영 iframe에 실제 `move/down/move/up`을 넣었다.
- 세 판 모두 화면상 `종이가 갈라졌다`로 끝났다. 첫 판 한 땀에서 다음 판 두 땀으로 나아졌지만 7개 봉합 성공은 보지 못했다.
- 검은 틈이 주홍 봉합선으로 바뀌는 핵심 반응과 종이결·주름·실의 대비는 분명했다. 반면 `섬유가 느슨해지는 중`은 기다림으로 오독됐고, 기다리는 동안 파열이 쌓였다. 결과의 구멍 번호는 판 위에 없어 다음 순서로 번역하기 어려웠다. 주홍 꼬리와 갈색 매듭이 함께 보이는 첫 잡기 지점도 모호했다.
- 콘솔 오류, 페이지 오류, 요청 실패는 모두 0건이었다. 영어, 소리, 실제 터치, 일시정지·복귀는 평가하지 못했다.
