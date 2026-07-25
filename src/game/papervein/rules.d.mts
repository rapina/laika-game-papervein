export const TICK_SECONDS: number
export const HOLE_COUNT: number
export const GAP_COUNT: number
export const MAX_THREAD: number
export const MAX_RUPTURES: number

export type PaperVeinOutcome = 'complete' | 'failed' | null
export type PaperVeinEvent = {
    type: 'start' | 'stitch' | 'rupture' | 'complete' | 'failed'
    target: number
    strength: number
}
export type PaperVeinState = {
    version: number
    seed: number
    elapsed: number
    tick: number
    endpoint: number
    selected: number
    thread: number
    openness: number[]
    tension: number[]
    stitched: boolean[]
    stitches: Array<{ from: number; to: number }>
    ruptureByGap: number[]
    ruptures: number
    ruptureCooldown: number
    firstRuptureAt: number | null
    closedCount: number
    successfulStitches: number
    consecutiveRuptures: number
    guideVisible: boolean
    over: boolean
    outcome: PaperVeinOutcome
    endedReason: string | null
    eventSerial: number
    lastEvent: PaperVeinEvent
}
export type PaperVeinInput =
    | { type: 'stitch'; target: number }
    | { type: 'select'; target: number }
    | { type: 'debugRupture'; target: number }
    | { type: 'restart' }
    | { type: 'tick' }
    | null

export function createState(seed?: number): PaperVeinState
export function step(state: PaperVeinState, input?: PaperVeinInput): PaperVeinState
export function renderModel(state: PaperVeinState): {
    openness: number[]
    tensions: number[]
    stitched: boolean[]
    ruptureByGap: number[]
    maxOpenness: number
    highestTensionGap: number
    suggestedHole: number
    score: number
    thread: number
    ruptures: number
    closedCount: number
    elapsed: number
    over: boolean
    outcome: PaperVeinOutcome
}
