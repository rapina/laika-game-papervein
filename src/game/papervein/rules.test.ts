import { describe, expect, it } from 'vitest'
import { createState, renderModel, step, TICK_SECONDS } from './rules.mjs'

const tick = (state: ReturnType<typeof createState>, seconds: number) => {
    let next = state
    for (let i = 0; i < Math.round(seconds / TICK_SECONDS); i += 1) next = step(next)
    return next
}

const stitch = (state: ReturnType<typeof createState>, target: number) =>
    step(state, { type: 'stitch', target })

describe('Paper Vein deterministic rules', () => {
    it('replays identical seed and inputs exactly', () => {
        let a = createState(20260725)
        let b = createState(20260725)
        for (const target of [2, 1, 4, 3]) {
            a = tick(stitch(a, target), 6)
            b = tick(stitch(b, target), 6)
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
        const run = (order: number[]) => order.reduce((s, target) => tick(stitch(s, target), 3), createState(7))
        const near = run([1, 2, 3, 4, 5, 6, 7])
        const crossing = run([7, 1, 6, 2, 5, 3, 4])
        expect(renderModel(near).tensions).not.toEqual(renderModel(crossing).tensions)
        expect(near.thread).not.toBe(crossing.thread)
    })

    it('allows a complete seven-gap construction path', () => {
        let state = createState(7)
        for (const target of [1, 2, 3, 4, 5, 6, 7]) state = stitch(tick(state, 9), target)
        expect(state.over).toBe(true)
        expect(state.outcome).toBe('complete')
        expect(state.closedCount).toBe(7)
        expect(state.elapsed).toBeGreaterThanOrEqual(60)
        expect(state.elapsed).toBeLessThanOrEqual(80)
    })

    it('resets guide after two consecutive ruptures following two successes', () => {
        let state = createState(5)
        state = stitch(state, 1)
        state = stitch(state, 2)
        expect(state.guideVisible).toBe(false)
        state = step(state, { type: 'debugRupture', target: 4 })
        state = step(state, { type: 'debugRupture', target: 5 })
        expect(state.guideVisible).toBe(true)
    })
})
