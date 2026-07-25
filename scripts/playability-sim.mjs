/**
 * 플레이 가능성 게이트 — 공용 템플릿.
 *
 *   node scripts/playability-sim.mjs [runsPerPolicy]
 *
 * 사람 모델 시뮬로 "사람이 이 게임을 플레이할 수 있는가"를 수치로 검증한다.
 * 이 파일은 `launchpad`에서 내려오는 정본이다. 게임마다 다시 짜지 말고,
 * 아래 ADAPTER 절만 이 게임의 규칙에 맞게 채운다. 나머지(노이즈 모델,
 * 시행 루프, 통계, 게이트 판정, 결과 결속)는 공용이라 손대지 않는다.
 *
 * 왜 공용인가: 연번 13·14·15에서 뷰포트·플레이·CSP 하네스가 저마다 게임
 * 안에서 태어나 다음 게임에 전파되지 않았고, 매번 처음부터 다시 짜였다.
 * 이 게이트도 같은 길을 가고 있었다 — 최근 여섯 편의 결과 파일이 저마다
 * 다른 경로에 있거나 아예 커밋되지 않았고, 어느 게이트도 그 파일을 읽지
 * 않았다. 그래서 결과를 **한 경로**(`verification/playability-result.json`)에
 * **smoke와 같은 sourceHash로 결속**해 쓰고, 게시가 그것을 읽어 검사한다.
 *
 * 무결성 두 가지는 구조로 지킨다.
 *  1. 실제 스텝 함수를 틱 단위로 부른다(판정·시간을 닫힌 공식으로 재유도 금지).
 *  2. 정책은 화면에 렌더되는 값만 읽고, 그 위에 사람 수준의 지각 오차를 얹는다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceHash } from './source-hash.mjs'

// ── 공용: 결정론 난수와 노이즈 ──────────────────────────────────────────────

export function seededRandom(seed) {
    let state = (seed >>> 0) || 1
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export function gaussian(random) {
    const u = Math.max(random(), Number.EPSILON)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

/**
 * 손떨림 — Ornstein-Uhlenbeck 과정. 정상 분산을 지정한 값에 **정확히** 맞춘다.
 * 이걸 안 맞추면 지정한 15% 오차가 실제로는 1.5%로 눌려, "질 수 없는 게임"이
 * 아닌데 그렇게 판정될 뻔했다(연번 11). 정상 표준편차 = stepSigma × sqrt(tau/(2·dt))
 * 이므로 역으로 stepSigma를 잡는다. `selfCheck`가 실제 뽑힌 분산을 되재서
 * 이 보정이 실제로 작동했는지 비율로 보여 준다.
 */
export function makeTremor(random, targetSd, stepMs, tauSeconds = 0.25) {
    const dt = stepMs / 1000
    const decay = Math.exp(-dt / tauSeconds)
    const stepSigma = targetSd * Math.sqrt(1 - decay * decay)
    let x = 0
    let y = 0
    return () => {
        x = x * decay + stepSigma * gaussian(random)
        y = y * decay + stepSigma * gaussian(random)
        return { x, y }
    }
}

export function stats(values) {
    if (values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length
    const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / sorted.length
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
    return {
        n: sorted.length,
        mean: +mean.toFixed(3),
        sd: +Math.sqrt(variance).toFixed(3),
        min: +sorted[0].toFixed(3),
        p10: +q(0.1).toFixed(3),
        median: +q(0.5).toFixed(3),
        p90: +q(0.9).toFixed(3),
        max: +sorted[sorted.length - 1].toFixed(3),
    }
}

// ── 공용: 게이트 판정 ───────────────────────────────────────────────────────
//
// 통과 기준은 creator-workflow.md의 "플레이 가능성 게이트"에서 온다. 게임이
// 이 문턱을 조용히 낮추지 못하도록 여기 코드로 둔다. summary는 ADAPTER가
// 각 정책을 요약해 만든 객체다(아래 요구 필드 참조).
//
//   intuitive/skilled/noInput = {
//     completionRate,        // 0~1, 세션 안에 완주한 비율
//     meanJudgments,         // 평균 핵심 판정 횟수
//     endedByJudgementRate,  // 성공/실패 판정으로 끝난 비율(시간초과 아님)
//     spentFailureBudgetRate,// 실패 예산을 소진한 비율
//     survivedFraction,      // (noInput) 무입력으로 판의 어디까지 살아남았나 0~1
//     scoreMedian,           // 점수 중앙값(두 정책 구분용)
//   }
export const IDLE_FATAL_FRACTION = 1 / 3

export function evaluateGates({ profile = 'challenge', intuitive, skilled, noInput, evidence = {} }) {
    const failed = []
    if (profile !== 'challenge') {
        if (!(evidence.meaningfulActions >= 3)) failed.push('tooFewMeaningfulActions')
        if (!(evidence.distinctOutcomes >= 2)) failed.push('outcomesDoNotDiffer')
        if (!(evidence.resetWorks === true)) failed.push('resetDoesNotWork')
        if (['puzzle', 'strategy', 'construction'].includes(profile)) {
            if (!(evidence.reachableGoal === true)) failed.push('goalNotReachable')
            if (!(evidence.choiceChangesState === true)) failed.push('choiceDoesNotChangeState')
        }
        if (['exploration', 'toy'].includes(profile)) {
            if (!(evidence.discoverableReactions >= 3)) failed.push('tooFewDiscoverableReactions')
        }
        return { pass: failed.length === 0, failedGates: failed }
    }
    // 직관: 핵심 판정을 여러 번 겪고, 성공/실패로 끝난다(시간초과 종료 아님).
    if (!(intuitive.meanJudgments >= 3)) failed.push('intuitiveExperiencesJudgments')
    if (!(intuitive.endedByJudgementRate >= 0.9)) failed.push('intuitiveEndsByJudgement')
    // 포화 상한: 직관이 전부 완주 + 실패 예산 0 소모면 "질 수 없는 게임".
    if (intuitive.completionRate >= 1 && intuitive.spentFailureBudgetRate <= 0) {
        failed.push('intuitiveSaturated')
    }
    // 숙련: 세션 안에 완주할 수 있다.
    if (!(skilled.completionRate > 0)) failed.push('skilledCanComplete')
    // 숙련 긴장: 완주가 포화(성공률 100%)면 미달.
    if (skilled.completionRate >= 1) failed.push('skilledSaturated')
    // 무입력: 판의 앞 1/4을 넘겨 살아남으면 화면보호기다.
    if (!(noInput.survivedFraction <= IDLE_FATAL_FRACTION)) failed.push('idleSurvivesTooLong')
    // 두 정책의 점수 분포가 구분된다.
    if (skilled.scoreMedian !== undefined && intuitive.scoreMedian !== undefined) {
        if (!(skilled.scoreMedian > intuitive.scoreMedian)) failed.push('policiesScoreIndistinct')
    }
    return { pass: failed.length === 0, failedGates: failed }
}

// ── 공용: 결과를 고정 경로에 결속해 쓴다 ───────────────────────────────────

export const RESULT_PATH = 'verification/playability-result.json'

export function writeResult(gameRoot, body) {
    const path = join(gameRoot, RESULT_PATH)
    mkdirSync(dirname(path), { recursive: true })
    const withHash = { sourceHash: sourceHash(gameRoot), ...body }
    writeFileSync(path, `${JSON.stringify(withHash, null, 2)}\n`)
    return { path, sourceHash: withHash.sourceHash }
}

// ── ADAPTER: 이 게임의 규칙만 여기서 채운다 ─────────────────────────────────
//
// 게임을 만들 때 이 절을 지우고, 이 게임의 `src/game/<slug>/rules`에서 실제
// 스텝 함수를 import해 세 정책(intuitive·skilled·noInput)을 각 500회 이상
// 돌린 뒤, 위 evaluateGates에 넘기고 writeResult로 결과를 쓴다. 예:
//
//   import { createState, renderModel, step, STEP_MS } from '../src/game/<slug>/rules.mjs'
//   ... 정책 손(perceive + 반응지연)으로 step()을 틱마다 호출 ...
//   const summary = { intuitive, skilled, noInput }   // 위 요구 필드
//   const gate = evaluateGates({ profile: 'challenge', ...summary })
// 다른 구조는 profile과 evidence를 전달한다. 예:
//   evaluateGates({
//     profile: 'toy',
//     evidence: { meaningfulActions: 8, distinctOutcomes: 5, resetWorks: true, discoverableReactions: 5 },
//   })
//   const { sourceHash } = writeResult(gameRoot, { pass: gate.pass, failedGates: gate.failedGates, ...summary })
//   if (!gate.pass) process.exit(1)
//
// 이 템플릿은 아직 게임이 없으므로, 어댑터가 채워지지 않으면 실패한다.
// 뷰포트 게이트가 자리표시 게임에서 실패하는 것과 같은 뜻이다 — 게이트
// 고장이 아니라 아직 게임이 없다는 뜻이니, 게이트를 끄지 말고 게임을 채운다.

import { createState, renderModel, step, TICK_SECONDS } from '../src/game/papervein/rules.mjs'

const available = (state) => Array.from({ length: 7 }, (_, i) => i + 1)
    .filter((hole) => !state.stitched[hole - 1])

function nearest(state, targets) {
    return [...targets].sort((a, b) => Math.abs(state.endpoint - a) - Math.abs(state.endpoint - b))[0]
}

function chooseGuided(state, targets) {
    if (state.closedCount === 0) return nearest(state, targets)
    const suggested = renderModel(state).suggestedHole
    return targets.includes(suggested) ? suggested : nearest(state, targets)
}

function chooseIgnoringCrease(state, targets) {
    return [...targets].sort((a, b) => Math.abs(state.endpoint - b) - Math.abs(state.endpoint - a))[0]
}

function run(seed, choose, actionEvery = 9) {
    let state = createState(seed)
    let nextAction = actionEvery
    const order = []
    while (!state.over && state.elapsed < 110) {
        if (state.elapsed >= nextAction) {
            const targets = available(state)
            if (!targets.length) break
            const target = choose(state, targets)
            order.push(target)
            state = step(state, { type: 'stitch', target })
            nextAction += actionEvery
        } else {
            state = step(state)
        }
    }
    return { state, model: renderModel(state), order }
}

function summarize(runs) {
    const scores = runs.map((run) => run.model.score).sort((a, b) => a - b)
    return {
        runs: runs.length,
        completionRate: runs.filter((run) => run.state.outcome === 'complete').length / runs.length,
        meanThread: +(runs.reduce((sum, run) => sum + run.state.thread, 0) / runs.length).toFixed(3),
        meanRuptures: +(runs.reduce((sum, run) => sum + run.state.ruptures, 0) / runs.length).toFixed(3),
        scoreMedian: scores[Math.floor(scores.length / 2)],
        meanElapsed: +(runs.reduce((sum, run) => sum + run.state.elapsed, 0) / runs.length).toFixed(3),
    }
}

function idleBaseline(seed = 7) {
    let state = createState(seed)
    while (!state.over && state.elapsed < 110) state = step(state)
    return {
        firstRuptureSeconds: state.firstRuptureAt,
        terminalSeconds: state.elapsed,
        ruptures: state.ruptures,
        outcome: state.outcome,
    }
}

function main() {
    const requested = Number(process.argv[2] || 500)
    const runs = Math.max(500, Number.isFinite(requested) ? Math.floor(requested) : 500)
    const guidedRuns = []
    const ignoreRuns = []
    for (let i = 0; i < runs; i += 1) {
        guidedRuns.push(run(20_260_725 + i, chooseGuided))
        ignoreRuns.push(run(20_260_725 + i, chooseIgnoringCrease))
    }
    const guided = summarize(guidedRuns)
    const ignoringCrease = summarize(ignoreRuns)
    const initial = createState(91)
    const nearChoice = step(initial, { type: 'stitch', target: 1 })
    const farChoice = step(initial, { type: 'stitch', target: 7 })
    const signatures = new Set([
        `${nearChoice.thread}|${nearChoice.ruptures}|${nearChoice.outcome}`,
        `${farChoice.thread}|${farChoice.ruptures}|${farChoice.outcome}`,
        `${guidedRuns[0].state.thread}|${guidedRuns[0].state.ruptures}|${guidedRuns[0].state.outcome}`,
    ])
    const evidence = {
        meaningfulActions: 7,
        distinctOutcomes: signatures.size,
        resetWorks: JSON.stringify(createState(44)) === JSON.stringify(step(run(44, chooseGuided).state, { type: 'restart' })),
        reachableGoal: guided.completionRate > 0,
        choiceChangesState: nearChoice.thread !== farChoice.thread
            && JSON.stringify(nearChoice.tension) !== JSON.stringify(farChoice.tension),
    }
    const gate = evaluateGates({ profile: 'construction', evidence })
    const depthAdvantagePoints = +((guided.completionRate - ignoringCrease.completionRate) * 100).toFixed(1)
    const body = {
        profile: 'construction',
        pass: gate.pass && depthAdvantagePoints >= 25,
        failedGates: [...gate.failedGates, ...(depthAdvantagePoints >= 25 ? [] : ['depthAxisNotMaterial'])],
        tickSeconds: TICK_SECONDS,
        actionIntervalSeconds: 9,
        evidence,
        guided,
        ignoringCrease,
        depthAB: {
            sameSeeds: runs,
            completionAdvantagePercentagePoints: depthAdvantagePoints,
            axis: 'follow the rendered bold crease instead of choosing the farthest unmarked hole',
        },
        representative: {
            guidedOrder: guidedRuns[0].order,
            guidedResult: guidedRuns[0].model,
            ignoringOrder: ignoreRuns[0].order,
            ignoringResult: ignoreRuns[0].model,
        },
        idle: idleBaseline(),
        limitations: [
            'The construction simulation models one action every nine seconds; it does not model pointer aiming error.',
            'Decorative fiber flutter and paper micro-shake are intentionally outside the deterministic step.',
        ],
    }
    const written = writeResult('.', body)
    console.log(JSON.stringify({ ...body, sourceHash: written.sourceHash }, null, 2))
    if (!body.pass) process.exit(1)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main()
