# 종이맥 / Paper Vein

## 한국어

벌어지는 젖은 종이의 틈을 한 가닥의 섬유로 꿰매는 한 손 건설 게임이다. 느슨한 실 끝을 빈 구멍까지 드래그해 놓는다. 먼 봉합은 여러 틈을 크게 당기지만 실을 더 쓰고 주변 장력을 높인다. 7개 틈을 모두 닫기 전에 세 번째 파열이 나거나 실이 다하면 실패한다.

키보드는 방향키로 구멍을 고르고 Space로 실을 집고 놓는다. M은 음소거다. 결과 화면은 700ms 뒤 화면 탭이나 Space로 다시 시작한다.

```bash
npm ci
npm test
npm run build:web
npm run smoke
node scripts/viewport-smoke.mjs
node scripts/playability-sim.mjs
node scripts/capture-evidence.mjs
npm run build:arcade
npm run csp
```

결정론 규칙은 `src/game/papervein/rules.mjs`, 브라우저 런타임은 `src/game/PaperVeinGame.ts`에 있다. 검증 증거는 `verification/`과 `smoke-result.json`에 남는다.

## English

Paper Vein is a one-handed construction game about binding a wet sheet that keeps opening with one strand. Drag the loose end to an empty hole and release. Long stitches draw several gaps at once, but spend more thread and raise nearby tension. You fail if the third rupture occurs or the thread runs out before all seven gaps close.

Use the arrow keys to choose a hole and Space to pick up or release the strand. M toggles mute. After the 700ms result guard, tap the result screen or press Space to restart.

```bash
npm ci
npm test
npm run build:web
npm run smoke
node scripts/viewport-smoke.mjs
node scripts/playability-sim.mjs
node scripts/capture-evidence.mjs
npm run build:arcade
npm run csp
```

The deterministic rules live in `src/game/papervein/rules.mjs`; the browser runtime is `src/game/PaperVeinGame.ts`. Committed evidence lives in `verification/` and `smoke-result.json`.

## License

- Code: MIT
- Documentation: CC BY 4.0
- Original project artwork: CC0 1.0
- Galmuri fonts: SIL Open Font License 1.1
