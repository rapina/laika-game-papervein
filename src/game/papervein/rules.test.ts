import { describe, expect, it } from 'vitest'
import {
    createState,
    renderModel,
    step,
    stitchPreview,
    STABILIZATION_SECONDS,
    TICK_SECONDS,
} from './rules.mjs'

const tick = (state: ReturnType<typeof createState>, seconds: number) => {
    let next = state
    for (let i = 0; i < Math.round(seconds / TICK_SECONDS); i += 1) next = step(next)
    return next
}

const stitch = (state: ReturnType<typeof createState>, target: number) =>
    step(state, { type: 'stitch', target })

const settle = (state: ReturnType<typeof createState>) => {
    let next = state
    while (!next.over && next.stabilizationRemaining > 0) next = step(next)
    return next
}

describe('Paper Vein deterministic rules', () => {
    it('replays identical seed and inputs exactly', () => {
        let a = createState(20260725)
        let b = createState(20260725)
        for (const target of [2, 1, 4, 3]) {
            a = settle(stitch(a, target))
            b = settle(stitch(b, target))
        }
        expect(a).toEqual(b)
    })

    it('ruptures for the first time before twenty seconds with no input', () => {
        const initial = createState(19)
        const idle = tick(initial, 20)
        expect(idle.ruptures).toBeGreaterThanOrEqual(1)
        expect(idle.firstRuptureAt).toBeGreaterThan(0)
        expect(idle.firstRuptureAt).toBeLessThanOrEqual(20)
    })

    it('preserves the default state near danger while drifting away without input', () => {
        const initial = createState(33)
        const model0 = renderModel(initial)
        const later = tick(initial, 5)
        const model1 = renderModel(later)
        expect(model0.maxOpenness).toBeGreaterThan(0.68)
        expect(model1.maxOpenness).toBeGreaterThan(model0.maxOpenness)
    })

    it('makes stitch order change tension and thread outcomes', () => {
        const run = (order: number[]) => order.reduce((s, target) => settle(stitch(s, target)), createState(7))
        const near = run([1, 2, 3, 4, 5, 6, 7])
        const crossing = run([7, 1, 6, 2, 5, 3, 4])
        expect(renderModel(near).tensions).not.toEqual(renderModel(crossing).tensions)
        expect(near.thread).not.toBe(crossing.thread)
    })

    it('allows a complete seven-gap construction path', () => {
        let state = createState(7)
        for (const target of [1, 2, 3, 4, 5, 6, 7]) state = settle(stitch(state, target))
        expect(state.over).toBe(true)
        expect(state.outcome).toBe('complete')
        expect(state.closedCount).toBe(7)
        expect(state.elapsed).toBeGreaterThanOrEqual(60)
        expect(state.elapsed).toBeLessThanOrEqual(80)
        expect(state.elapsed).toBeCloseTo(STABILIZATION_SECONDS * 7, 1)
    })

    it('resets guide after two consecutive ruptures following two successes', () => {
        let state = createState(5)
        state = settle(stitch(state, 1))
        state = settle(stitch(state, 2))
        expect(state.guideVisible).toBe(false)
        state = step(state, { type: 'debugRupture', target: 4 })
        state = step(state, { type: 'debugRupture', target: 5 })
        expect(state.guideVisible).toBe(true)
    })

    it('rejects an early second stitch with material feedback and accepts it after readiness', () => {
        let state = stitch(createState(11), 1)
        const afterFirst = state
        state = stitch(state, 2)
        expect(state.closedCount).toBe(1)
        expect(state.thread).toBe(afterFirst.thread)
        expect(state.lastEvent.type).toBe('resist')
        expect(state.materialRecoil).toBe(1)
        expect(state.rejectedStitches).toBe(1)
        state = settle(state)
        expect(state.stabilizationRemaining).toBe(0)
        expect(state.lastEvent.type).toBe('ready')
        state = stitch(state, 2)
        expect(state.closedCount).toBe(2)
        expect(state.lastEvent.type).toBe('stitch')
    })

    it('uses the exact cost formula for preview and the eventual deduction', () => {
        let state = createState(17)
        state = {
            ...state,
            tension: state.tension.map((value, i) => i === 4 ? 0.37 : value),
            ruptureByGap: state.ruptureByGap.map((value, i) => i === 4 ? 2 : value),
        }
        const preview = stitchPreview(state, 5)
        const expected = 5 + 2.4 * 5 + 4 * 0.37 + 1.5 * 2
        expect(preview?.cost).toBeCloseTo(expected, 6)
        expect(preview?.remainingThread).toBeCloseTo(100 - expected, 6)
        const stitched = stitch(state, 5)
        expect(state.thread - stitched.thread).toBeCloseTo(preview!.cost, 6)
    })

    it('warns from predicted post-stitch tension before a dangerous release', () => {
        const state = createState(23)
        const far = stitchPreview(state, 7)
        expect(far?.predictedTension).toBeGreaterThanOrEqual(0.72)
        expect(far?.wouldRupture).toBe(true)
        const near = stitchPreview(state, 1)
        expect(near?.wouldRupture).toBe(false)
    })
})
