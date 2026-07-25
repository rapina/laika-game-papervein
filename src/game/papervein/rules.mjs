export const TICK_SECONDS = 1 / 60
export const HOLE_COUNT = 8
export const GAP_COUNT = 7
export const MAX_THREAD = 100
export const MAX_RUPTURES = 3

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const round6 = (value) => Math.round(value * 1_000_000) / 1_000_000

function seededOffsets(seed) {
    let value = (seed >>> 0) || 1
    return Array.from({ length: GAP_COUNT }, () => {
        value = (value + 0x6d2b79f5) >>> 0
        let t = value
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    })
}

export function createState(seed = 1) {
    const offsets = seededOffsets(seed)
    return {
        version: 1,
        seed: seed >>> 0,
        elapsed: 0,
        tick: 0,
        endpoint: 0,
        selected: 1,
        thread: MAX_THREAD,
        openness: offsets.map((n, i) => round6(0.69 + n * 0.046 + i * 0.0015)),
        tension: offsets.map((n) => round6(0.04 + n * 0.045)),
        stitched: Array(GAP_COUNT).fill(false),
        stitches: [],
        ruptureByGap: Array(GAP_COUNT).fill(0),
        ruptures: 0,
        ruptureCooldown: 0,
        firstRuptureAt: null,
        closedCount: 0,
        successfulStitches: 0,
        consecutiveRuptures: 0,
        guideVisible: true,
        over: false,
        outcome: null,
        endedReason: null,
        eventSerial: 0,
        lastEvent: { type: 'start', target: 0, strength: 0 },
    }
}

function finish(state, outcome, endedReason) {
    return {
        ...state,
        over: true,
        outcome,
        endedReason,
        eventSerial: state.eventSerial + 1,
        lastEvent: { type: outcome, target: state.endpoint, strength: 1 },
    }
}

function rupture(state, target, forced = false) {
    if (state.over) return state
    const openness = [...state.openness]
    const tension = [...state.tension]
    const ruptureByGap = [...state.ruptureByGap]
    for (let i = 0; i < GAP_COUNT; i += 1) {
        if (i !== target && !state.stitched[i]) openness[i] = round6(Math.max(0.08, openness[i] - 0.06))
    }
    openness[target] = 0.62
    tension[target] = 0.38
    ruptureByGap[target] += 1
    const ruptures = state.ruptures + 1
    const firstRuptureAt = state.firstRuptureAt ?? state.elapsed
    const consecutiveRuptures = state.consecutiveRuptures + 1
    let next = {
        ...state,
        openness,
        tension,
        ruptureByGap,
        ruptures,
        ruptureCooldown: 4,
        firstRuptureAt,
        consecutiveRuptures,
        guideVisible: state.guideVisible || consecutiveRuptures >= 2,
        eventSerial: state.eventSerial + 1,
        lastEvent: { type: 'rupture', target, strength: forced ? 1 : openness[target] },
    }
    if (ruptures >= MAX_RUPTURES) next = finish(next, 'failed', 'ruptures')
    return next
}

function applyStitch(state, target) {
    if (state.over || !Number.isInteger(target) || target < 1 || target >= HOLE_COUNT) return state
    const gap = target - 1
    if (state.stitched[gap]) return state
    const distance = Math.abs(state.endpoint - target)
    const cost = 5 + 2.4 * distance + 4 * state.tension[gap] + 1.5 * state.ruptureByGap[gap]
    if (cost > state.thread) return finish({ ...state, thread: 0 }, 'failed', 'thread')

    const openness = [...state.openness]
    const tension = [...state.tension]
    const stitched = [...state.stitched]
    const stitches = [...state.stitches, { from: state.endpoint, to: target }]
    const lo = Math.min(state.endpoint, target)
    const hi = Math.max(state.endpoint, target)

    for (let i = 0; i < GAP_COUNT; i += 1) {
        if (stitched[i]) continue
        const pathPull = i >= lo && i < hi ? 0.16 + 0.025 * distance : 0
        const neighborPull = (0.075 + 0.012 * distance) / (1 + Math.abs(i - gap))
        const sheetPull = 0.07 + 0.01 * distance
        openness[i] = round6(Math.max(0.08, openness[i] - pathPull - neighborPull - sheetPull))
        tension[i] = round6(clamp(
            tension[i] + (0.065 * distance) / (1 + Math.abs(i - gap)),
            0,
            1.2,
        ))
    }
    openness[gap] = 0.08
    tension[gap] = round6(clamp(tension[gap] + 0.08 + 0.035 * distance, 0, 1.2))
    stitched[gap] = true
    const closedCount = stitched.filter(Boolean).length
    const successfulStitches = state.successfulStitches + 1
    let next = {
        ...state,
        endpoint: target,
        selected: findNextEmpty(stitched, target),
        thread: round6(Math.max(0, state.thread - cost)),
        openness,
        tension,
        stitched,
        stitches,
        closedCount,
        successfulStitches,
        consecutiveRuptures: 0,
        guideVisible: successfulStitches < 2,
        eventSerial: state.eventSerial + 1,
        lastEvent: { type: 'stitch', target: gap, strength: clamp(distance / 7, 0.15, 1) },
    }
    if (tension[gap] >= 0.72) next = rupture(next, gap, true)
    if (!next.over && closedCount === GAP_COUNT) next = finish(next, 'complete', 'mended')
    return next
}

function findNextEmpty(stitched, fromHole) {
    for (let offset = 1; offset < HOLE_COUNT; offset += 1) {
        const hole = ((fromHole - 1 + offset) % GAP_COUNT) + 1
        if (!stitched[hole - 1]) return hole
    }
    return fromHole
}

function advance(state) {
    if (state.over) return state
    const openness = [...state.openness]
    const tension = [...state.tension]
    let next = {
        ...state,
        tick: state.tick + 1,
        elapsed: round6(state.elapsed + TICK_SECONDS),
        ruptureCooldown: Math.max(0, round6(state.ruptureCooldown - TICK_SECONDS)),
        openness,
        tension,
    }
    for (let i = 0; i < GAP_COUNT; i += 1) {
        const openingRate = state.stitched[i] ? 0.0012 : 0.0155 + tension[i] * 0.0035
        openness[i] = round6(openness[i] + openingRate * TICK_SECONDS)
        tension[i] = round6(Math.max(0.025, tension[i] - 0.006 * TICK_SECONDS))
    }
    let breakingGap = -1
    let highest = 1
    for (let i = 0; i < GAP_COUNT; i += 1) {
        if (openness[i] >= highest) {
            highest = openness[i]
            breakingGap = i
        }
    }
    if (breakingGap >= 0 && state.ruptureCooldown <= 0) next = rupture(next, breakingGap)
    return next
}

export function step(state, input = null) {
    let next = state
    if (input?.type === 'stitch') next = applyStitch(next, input.target)
    if (input?.type === 'select') {
        next = { ...next, selected: clamp(Math.round(input.target), 1, 7) }
    }
    if (input?.type === 'debugRupture') next = rupture(next, clamp(input.target - 1, 0, 6), true)
    if (input?.type === 'restart') next = createState(state.seed)
    if (input?.type === 'tick' || input === null) next = advance(next)
    return next
}

export function renderModel(state) {
    let highestTensionGap = state.stitched.findIndex((value) => !value)
    if (highestTensionGap < 0) highestTensionGap = 0
    for (let i = 0; i < GAP_COUNT; i += 1) {
        if (!state.stitched[i] && state.tension[i] > state.tension[highestTensionGap]) highestTensionGap = i
    }
    const maxOpenness = Math.max(...state.openness)
    const score = Math.max(0, Math.round(
        state.closedCount * 10_000 + state.thread * 100 - state.ruptures * 1_000 - state.elapsed,
    ))
    return {
        openness: [...state.openness],
        tensions: [...state.tension],
        stitched: [...state.stitched],
        ruptureByGap: [...state.ruptureByGap],
        maxOpenness,
        highestTensionGap,
        suggestedHole: highestTensionGap + 1,
        score,
        thread: state.thread,
        ruptures: state.ruptures,
        closedCount: state.closedCount,
        elapsed: state.elapsed,
        over: state.over,
        outcome: state.outcome,
    }
}
