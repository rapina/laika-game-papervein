import { setTimeout as delay } from 'node:timers/promises'

export async function act(page, frame, box) {
    await frame.waitForFunction(() => globalThis.__gameState?.holes?.length === 8)
    const before = await frame.evaluate(() => globalThis.__gameState)
    const from = before.holes[before.endpoint]
    const to = before.holes[1]
    const point = (p) => ({
        x: box.x + p.x / 390 * box.width,
        y: box.y + p.y / 844 * box.height,
    })
    const a = point(from)
    const b = point(to)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 18 })
    await page.mouse.up()
    await delay(500)
    const after = await frame.evaluate(() => globalThis.__gameState)
    return {
        input: 'real pointer drag in sandbox iframe under portal CSP',
        beforeClosed: before.closedCount,
        afterClosed: after.closedCount,
        event: after.event,
        threadSpent: +(before.thread - after.thread).toFixed(3),
    }
}

export async function inspect(frame) {
    return frame.evaluate(() => ({
        state: globalThis.__gameState,
        emittedEvents: globalThis.__events,
    }))
}

export function judge(observed) {
    return {
        realPointerStitch: observed.play?.beforeClosed === 0
            && observed.play?.afterClosed === 1
            && observed.play?.event === 'stitch',
        hostReadyAndStarted: observed.game?.emittedEvents?.some((event) => event.type === 'ready')
            && observed.game?.emittedEvents?.some((event) => event.type === 'started'),
    }
}
