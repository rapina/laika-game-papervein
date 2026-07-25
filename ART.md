# ART — 종이맥 / Paper Vein

## 매체

손으로 뜬 두꺼운 종이와 젖은 닥섬유를 생성한 래스터 원재료로 만들고, 런타임에서 2D 경로 변형·마스크·주름 선과 합성한다. 목표 화면은 구현 기준일 뿐 게임 UI 자산으로 읽지 않는다. 대표 색 `#E64B32`는 실과 현재 봉합 상태에만 쓴다.

생성 도구는 OpenAI `image_gen`이다. 모든 원본 PNG를 저장소에 보존했다.

## 목표 화면

공통 생성 방향: 390×844 세로 모바일 캡처, 낮은 수선틀, 젖은 닥종이, 8개 눌린 구멍과 7개 틈, 주홍 섬유, 촬영·스캔한 재료를 2D 변형 메시로 합성할 수 있는 정면 구도. 바늘·인벤토리·배지·장식 파티클은 제외했다.

| 화면 | 원본 SHA-256 | 390×844 SHA-256 | 프롬프트의 장면 차이 |
|---|---|---|---|
| `design/targets/first-play.png` | `4f621b9e895f667b8f7056ea173a7f9175ac3af1deb119330f6c260171b261ac` | `4cf96e48a8c1667a3519bea8b5173667af407df8243024ce029259cc24bc0ac0` | 실 100, 7개 봉합과 파열 3회, 잡기·시점·목표 3답이 보이는 첫 화면 |
| `design/targets/verb-success.png` | `59e96ebaa8e0dac2730835b2a18ab4422b79ec2f7f871a0eafcbd9ad4543dc7a` | `188a82d02153df5f316bb8a67246abce103389f3fcebd69581bdf3c158e959e7` | 가까운 봉합 직후 가장자리가 접히고 실이 팽팽해진 순간 |
| `design/targets/verb-fail.png` | `4d0c012ed90541eb4eadf2594c9a23a16ca26ce268c0d4acfc56d02f32be21cb` | `ce51113923c975dee3ee9e1f8965e6bf29f4bf8733f21317d22d7cb92b07cd30` | 먼 봉합 직후 종이 조각이 들리고 갈라진 이중 외곽선·진동 무늬가 생긴 순간 |
| `design/targets/game-over.png` | `c21cebce04b8ab6217c74d073e3226edf6663f913b2e5c08c5a17fd63bca3133` | `58e10d6f2129f51221e242bec477468db460f7ecbca6a99d796d7019111d98a8` | 종이가 들리고 역광에서 주홍 봉합선이 잎맥 구조로 보이는 성공 결과 |

원본은 `design/targets/originals/`의 같은 이름 `*-original.png`다. 원본을 높이 844px로 축소하고 중앙을 390px로 잘라 목표 화면을 만들었다. 보간은 macOS `sips` 기본 고품질 보간이다.

### 목표 화면 프롬프트

- 첫 화면: “Portrait 390×844 mobile game target screenshot. A low sunlit repair frame holds thick wet handmade Korean mulberry paper with scanned fibrous texture, seven opening tears between eight pressed holes, one loose vermilion wet fiber tied at the first hole. Integrated HUD: thread 100, seven stitches, three rupture notches. Show bilingual guidance for dragging the loose end, following the bold crease, and closing seven before three ruptures. No needle, inventory, badges, particles, or watermark.”
- 성공: “Portrait 390×844 target screenshot immediately after a successful stitch. The chosen tear’s deckled edges visibly fold inward and close; the vermilion strand overshoots then snaps taut; neighboring creases bend toward it. HUD thread 87, 1/7, 0/3 and status DRAWN TIGHT. No glow or celebratory particles.”
- 파열: “Portrait 390×844 target screenshot at rupture after a risky long stitch. One tear physically splits wider, deckled edges recoil asymmetrically, an attached flap bends back, and charcoal zigzag vibration marks follow the double outline. The fiber bows slack. HUD thread 51, 4/7, 1/3 and status RUPTURE. Danger is not color-only.”
- 결과: “Portrait 390×844 successful game-over screenshot. The repaired sheet lifts from the frame and warm backlight reveals dense fibers and seven vermilion seams as one leaf-vein structure. A restrained result layer shows MADE WHOLE, remaining thread, rupture count, and TAP TO MEND AGAIN. No confetti, leaderboard, buttons, or badges.”

## 실제 게임 자산

| 파일 | 원본 크기 / SHA-256 | 릴리스 크기 / SHA-256 | 후가공과 사용 |
|---|---|---|---|
| `assets/generated/title-key-original.png` | 853×1844 / `e5c61e745a16cde141ea2a6553054f54f7cd61594f12f59a9fd2a3ee3acb671b` | `public/assets/title-key.png`, 390×844 / `db576d5bc496f27b41d1cb5d2e1199d78af0dd5e819b63b6130aa02486989d42` | 높이 축소·중앙 크롭. 타이틀 배경에 실제 사용. |
| `assets/generated/paper-fiber-original.png` | 1254×1254 / `7e543fa9455eb6f263464c1be3dbad5a6eede6e3289f0203b297c83af7735de3` | `public/assets/paper-fiber.png`, 512×512 / `e23b8a2abfc5b0f3df5cfd6e7e1a3619c439df8daeb5497a048634b105e1c59b` | 512px 축소. 캔버스 종이 경로 안의 반복 패턴으로 사용. |
| `assets/generated/wet-fiber-original.png` | 1254×1254 / `881a2e3ffeb0e8c970e799bee8f9de23d6743245cdb1c1929e92ffdd9d537c7b` | `public/assets/wet-fiber.png`, 512×512 / `9a2c0a1d05b0719bd16d1a3627367b39f710795f5cc74808061a1c0064dd7153` | 512px 축소. 섬유 표면 색·결 참고와 릴리스 원재료로 포함. 실의 최종 형태는 판정 경로를 따라 절차 렌더. |

### 실제 자산 프롬프트

- 타이틀 키: “Portrait key illustration with no typography. One thick wet handmade Korean mulberry paper sheet on a low wooden repair frame in morning sunlight. Seven gentle tears, eight pressed holes, one loose vermilion fiber. Scanned fiber texture, deckled edges, lint, glue traces, charcoal tear interiors, generous dark space at top. No hands, needle, tools, particles, or watermark.”
- 종이: “Square raw material texture. Extreme close scan of thick wet handmade Korean mulberry paper, warm off-white, long plant fibers, slight translucency, lint and subtle dry rice-glue traces. Flat diffuse light. No holes, tears, thread, objects, typography, vignette, or watermark.”
- 섬유: “Square raw material texture. Macro scan of parallel wet hand-twisted Korean mulberry fiber strands with fuzz and wet sheen, dyed vermilion #E64B32 over neutral charcoal for masking. No knots, needle, paper, typography, or watermark.”

## 절차 아트

- 종이 외곽, 구멍, 틈: Canvas 2D 경로. 틈 벌어짐은 실제 `openness`, 주름 길이는 실제 `tension`을 읽는다.
- 봉합: 규칙 상태의 실제 `from → to` 기록을 주홍 이중 곡선으로 그린다.
- 파열: 갈라진 이중 외곽선, 종이 반동, 짧은 진동 무늬를 함께 쓴다.
- 장식: 프레임의 나뭇결과 종이 미세 떨림만 비판정이다.

## 사운드

외부 음원은 사용하지 않는다. 첫 포인터/키 입력 뒤에만 `AudioContext`를 만든다.

- 집기: 118Hz 삼각파 35ms.
- 당김: 132→224Hz 섬유 마찰음 뒤 310Hz 장력음.
- 파열: 120ms 노이즈를 1.2kHz 하이패스로 거른 마른 종이음.
- 성공: 196→293Hz 350ms.

음소거, 숨김, 호스트 일시정지, 재시작에서 같은 컨텍스트를 제어한다. 반복 배경음과 장식음은 없다.

## 공개 제작자 일러스트

- 대표 행동: 라이카가 젖은 닥종이 한 장을 앞발로 받치고, 느슨해진 주홍 섬유 한 가닥을 다음 구멍으로 당겨 봉합한다.
- 참조: `brand/art/laika-base.png`, `laika-base-v1`, SHA-256 `820e6d43e915c4e9e32ddcd3cc14d0f2537d99f6d8d397bbd40fc416137a6712`.
- 생성: Codex 내장 `image_gen`에 베이스 PNG를 실제 이미지 참조로 전달했다. 재현 프롬프트는 `art/prompts/laika-papervein.md`에 보존했다.
- 원본: `art/source/laika-papervein.png`, 1402×1122, SHA-256 `c584ce96832506471451b98fec8a63adf54652afe7bd739a0b3f605767a1d55c`. 생성 원본 PNG는 릴리스에 포함하지 않는다.
- 후가공: `sips`로 너비를 축소하고 JPEG로 변환했다. 1280px는 품질 86, 640px는 품질 84를 사용했으며 자르기, 합성, 색 변경은 하지 않았다.

| 웹 파일 | 크기 | SHA-256 |
|---|---:|---|
| `public/art/laika-papervein-640.jpg` | 640×512 | `5ef93af008f0cb3f270867dbd7370ea6168bec695b50e1b7086288b9e3136507` |
| `public/art/laika-papervein-1280.jpg` | 1280×1024 | `f555f124c84518cda03b90c16652e3927f3842afc9f8ae2bafd47551eeb72369` |

시각 검수에서 베이스의 얼굴 무늬, 뾰족 귀, 흰 가슴과 앞발, 크림 하네스, 주황 연결구를 확인했다. 네 발과 관절은 자연스럽고 여분의 발이나 사람 손이 없다. 젖은 종이 한 장과 주홍 섬유 한 가닥 외에 바늘이나 다른 도구가 없다. 문자, 로고, 서명, 가짜 기록 표식도 보이지 않는다. 중앙 4:5 모바일 크롭에서도 얼굴, 하네스 연결구, 종이를 받치는 앞발, 젖은 종이와 주홍 섬유가 함께 읽힌다. 세부 검수 기록은 `art/provenance/laika-papervein.json`에 남겼다.
