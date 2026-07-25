import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'
import { sourceHash } from './source-hash.mjs'

const PORT = 4194
const ROOT = new URL('..', import.meta.url).pathname
const OUT = `${ROOT}verification`
mkdirSync(OUT, { recursive: true })

async function launchBrowser() {
    const options = { headless: true, args: ['--disable-gpu', '--no-sandbox'] }
    if (process.env.CHROME) return chromium.launch({ ...options, executablePath: process.env.CHROME })
    try { return await chromium.launch({ ...options, channel: 'chrome' }) } catch { return chromium.launch(options) }
}

async function waitForServer() {
    for (let i = 0; i < 120; i += 1) {
        try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) return } catch { /* retry */ }
        await delay(250)
    }
    throw new Error('capture server did not start')
}

async function openRun(browser, seed, lang = 'ko') {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        locale: lang === 'ko' ? 'ko-KR' : 'en-US',
    })
    const consoleErrors = []
    const pageErrors = []
    const failedRequests = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`))
    await page.goto(`http://127.0.0.1:${PORT}/autoplay.html?seed=${seed}&lang=${lang}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('canvas')
    await page.waitForFunction(() => globalThis.__gameState?.holes?.length === 8)
    return { page, consoleErrors, pageErrors, failedRequests }
}

async function dragTo(page, target) {
    const box = await page.locator('canvas').boundingBox()
    const state = await page.evaluate(() => globalThis.__gameState)
    const from = state.holes[state.endpoint]
    const to = state.holes[target]
    const point = (p) => ({ x: box.x + p.x / 390 * box.width, y: box.y + p.y / 844 * box.height })
    const a = point(from)
    const b = point(to)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 18 })
    await page.mouse.up()
    await page.waitForFunction(
        ({ serial, rejected }) => {
            const current = globalThis.__gameState
            return current?.closedCount !== serial
                || current?.rejectedStitches !== rejected
                || current?.over === true
        },
        { serial: state.closedCount, rejected: state.rejectedStitches },
        { timeout: 3000 },
    )
    return page.evaluate(() => globalThis.__gameState)
}

async function waitUntilReady(page) {
    await page.waitForFunction(
        () => globalThis.__gameState?.ready === true || globalThis.__gameState?.over === true,
        undefined,
        { timeout: 12_000 },
    )
    return page.evaluate(() => globalThis.__gameState)
}

async function holdDragTo(page, target) {
    const box = await page.locator('canvas').boundingBox()
    const state = await page.evaluate(() => globalThis.__gameState)
    const from = state.holes[state.endpoint]
    const to = state.holes[target]
    const point = (p) => ({ x: box.x + p.x / 390 * box.width, y: box.y + p.y / 844 * box.height })
    const a = point(from)
    const b = point(to)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 18 })
    await page.waitForFunction(
        (expected) => globalThis.__gameState?.dragPreview?.target === expected,
        target,
        { timeout: 3000 },
    )
    return {
        before: state,
        preview: await page.evaluate(() => globalThis.__gameState.dragPreview),
    }
}

const dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--force'], {
    cwd: ROOT, shell: true, stdio: 'pipe', detached: process.platform !== 'win32',
})
const observations = {
    sourceHash: sourceHash(),
    input: 'real Playwright pointer move/down/move/up on the rendered canvas',
    guideAnswers: {
        input: 'Drag the vermilion loose end to an empty pressed hole.',
        timing: 'Wait until the vermilion strand loosens, then follow the boldest physical crease.',
        goal: 'Close 7 gaps before 3 ruptures or the thread is spent.',
    },
    captures: {},
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
}

try {
    await waitForServer()
    const browser = await launchBrowser()

    const first = await openRun(browser, 7)
    await first.page.screenshot({ path: `${OUT}/first-play-ko.png` })
    observations.captures.firstPlay = await first.page.evaluate(() => globalThis.__gameState)
    observations.consoleErrors.push(...first.consoleErrors)
    observations.pageErrors.push(...first.pageErrors)
    observations.failedRequests.push(...first.failedRequests)
    await first.page.close()

    const firstEnglish = await openRun(browser, 7, 'en')
    await firstEnglish.page.screenshot({ path: `${OUT}/first-play-en.png` })
    observations.captures.firstPlayEnglish = await firstEnglish.page.evaluate(() => globalThis.__gameState)
    observations.consoleErrors.push(...firstEnglish.consoleErrors)
    observations.pageErrors.push(...firstEnglish.pageErrors)
    observations.failedRequests.push(...firstEnglish.failedRequests)
    await firstEnglish.page.close()

    const success = await openRun(browser, 7)
    observations.captures.success = await dragTo(success.page, 1)
    await success.page.screenshot({ path: `${OUT}/verb-success.png` })
    observations.consoleErrors.push(...success.consoleErrors)
    observations.pageErrors.push(...success.pageErrors)
    observations.failedRequests.push(...success.failedRequests)
    await success.page.close()

    const fail = await openRun(browser, 7)
    const heldRisk = await holdDragTo(fail.page, 7)
    observations.captures.riskPreview = heldRisk.preview
    await fail.page.screenshot({ path: `${OUT}/verb-risk-preview.png` })
    await fail.page.mouse.up()
    await fail.page.waitForFunction(() => globalThis.__gameState?.ruptures >= 1, undefined, { timeout: 3000 })
    observations.captures.rupture = await fail.page.evaluate(() => globalThis.__gameState)
    observations.previewConsistency = {
        target: heldRisk.preview.target,
        displayedFormulaCost: heldRisk.preview.cost,
        displayedRemainingThread: heldRisk.preview.remainingThread,
        committedFormulaCost: observations.captures.rupture.lastCommittedPreview.cost,
        committedRemainingThread: observations.captures.rupture.lastCommittedPreview.remainingThread,
        actualThreadSpent: +(heldRisk.before.thread - observations.captures.rupture.thread).toFixed(6),
        predictedTension: heldRisk.preview.predictedTension,
        warnedBeforeRelease: heldRisk.preview.wouldRupture,
        rupturedAfterRelease: observations.captures.rupture.ruptures > heldRisk.before.ruptures,
        visibleAndCommittedRemainingMatchAtDisplayedPrecision:
            heldRisk.preview.remainingThread.toFixed(1)
            === observations.captures.rupture.lastCommittedPreview.remainingThread.toFixed(1),
    }
    await fail.page.screenshot({ path: `${OUT}/verb-fail.png` })
    observations.consoleErrors.push(...fail.consoleErrors)
    observations.pageErrors.push(...fail.pageErrors)
    observations.failedRequests.push(...fail.failedRequests)
    await fail.page.close()

    const recovery = await openRun(browser, 13)
    const firstRecovery = await dragTo(recovery.page, 1)
    const rejected = await dragTo(recovery.page, 2)
    await recovery.page.screenshot({ path: `${OUT}/cooldown-recoil-ko.png` })
    const ready = await waitUntilReady(recovery.page)
    await recovery.page.screenshot({ path: `${OUT}/ready-bold-crease-ko.png` })
    const recovered = await dragTo(recovery.page, 2)
    observations.captures.cooldownRecovery = {
        afterFirst: firstRecovery,
        rejected,
        ready,
        recovered,
        pointerPolicy: 'same rendered drag is rejected while taut, then succeeds after actual readiness',
    }
    observations.consoleErrors.push(...recovery.consoleErrors)
    observations.pageErrors.push(...recovery.pageErrors)
    observations.failedRequests.push(...recovery.failedRequests)
    await recovery.page.close()

    const completed = await openRun(browser, 7)
    for (const target of [1, 2, 3, 4, 5, 6, 7]) {
        await dragTo(completed.page, target)
        await waitUntilReady(completed.page)
    }
    await completed.page.waitForFunction(() => globalThis.__gameState?.outcome === 'complete', undefined, { timeout: 12_000 })
    observations.captures.complete = await completed.page.evaluate(() => globalThis.__gameState)
    await completed.page.screenshot({ path: `${OUT}/game-complete-ko.png` })
    observations.consoleErrors.push(...completed.consoleErrors)
    observations.pageErrors.push(...completed.pageErrors)
    observations.failedRequests.push(...completed.failedRequests)
    await completed.page.close()

    const ending = await openRun(browser, 7)
    for (const target of [7, 1, 6]) {
        const state = await dragTo(ending.page, target)
        if (state.over) break
        await waitUntilReady(ending.page)
    }
    await ending.page.waitForFunction(() => globalThis.__gameState?.over === true)
    await delay(120)
    observations.captures.gameOver = await ending.page.evaluate(() => globalThis.__gameState)
    observations.gameOverAnswers = {
        ended: 'The opaque result sheet and final title replace live play.',
        restart: 'The screen says to tap to mend again.',
    }
    await ending.page.screenshot({ path: `${OUT}/game-over-ko.png` })
    observations.consoleErrors.push(...ending.consoleErrors)
    observations.pageErrors.push(...ending.pageErrors)
    observations.failedRequests.push(...ending.failedRequests)
    await ending.page.close()
    await browser.close()

    observations.checks = {
        guideTimingKo: observations.captures.firstPlay.guideTiming.includes('느슨'),
        guideTimingEn: observations.captures.firstPlayEnglish.guideTiming.includes('loosens'),
        pointerStitch: observations.captures.success.closedCount === 1,
        ruptureObserved: observations.captures.rupture.ruptures >= 1,
        riskWarnedBeforeRelease: observations.captures.riskPreview.wouldRupture === true,
        committedPreviewMatchesDeduction: Math.abs(
            observations.previewConsistency.committedFormulaCost
            - observations.previewConsistency.actualThreadSpent,
        ) < 0.000001,
        displayedRemainingMatchesCommit:
            observations.previewConsistency.visibleAndCommittedRemainingMatchAtDisplayedPrecision,
        cooldownRejectedWithoutProgress:
            observations.captures.cooldownRecovery.rejected.closedCount === 1
            && observations.captures.cooldownRecovery.rejected.rejectedStitches === 1,
        pointerRecoveredAfterReadiness: observations.captures.cooldownRecovery.recovered.closedCount === 2,
        completedSeven: observations.captures.complete.outcome === 'complete'
            && observations.captures.complete.closedCount === 7,
        completedInPromisedWindow: observations.captures.complete.elapsed >= 60
            && observations.captures.complete.elapsed <= 80,
        failureGameOver: observations.captures.gameOver.over === true,
        noErrors: observations.consoleErrors.length === 0
            && observations.pageErrors.length === 0
            && observations.failedRequests.length === 0,
    }
    observations.pass = Object.values(observations.checks).every(Boolean)
    writeFileSync(`${OUT}/capture-result.json`, `${JSON.stringify(observations, null, 2)}\n`)
    console.log(JSON.stringify(observations, null, 2))
    if (!observations.pass) process.exitCode = 1
} finally {
    if (dev.pid) {
        try { process.kill(-dev.pid, 'SIGKILL') } catch { try { dev.kill('SIGKILL') } catch { /* gone */ } }
    }
}
