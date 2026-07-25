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

async function openRun(browser, seed) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
    const consoleErrors = []
    const pageErrors = []
    const failedRequests = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`))
    await page.goto(`http://127.0.0.1:${PORT}/autoplay.html?seed=${seed}&lang=ko`, { waitUntil: 'networkidle' })
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
    await delay(350)
    return page.evaluate(() => globalThis.__gameState)
}

const dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--force'], {
    cwd: ROOT, shell: true, stdio: 'pipe', detached: process.platform !== 'win32',
})
const observations = {
    sourceHash: sourceHash(),
    input: 'real Playwright pointer move/down/move/up on the rendered canvas',
    guideAnswers: {
        input: 'Drag the vermilion loose end to an empty pressed hole.',
        timing: 'Act toward the boldest physical crease.',
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

    const success = await openRun(browser, 7)
    observations.captures.success = await dragTo(success.page, 1)
    await success.page.screenshot({ path: `${OUT}/verb-success.png` })
    observations.consoleErrors.push(...success.consoleErrors)
    observations.pageErrors.push(...success.pageErrors)
    observations.failedRequests.push(...success.failedRequests)
    await success.page.close()

    const fail = await openRun(browser, 7)
    observations.captures.rupture = await dragTo(fail.page, 7)
    await fail.page.screenshot({ path: `${OUT}/verb-fail.png` })
    observations.consoleErrors.push(...fail.consoleErrors)
    observations.pageErrors.push(...fail.pageErrors)
    observations.failedRequests.push(...fail.failedRequests)
    await fail.page.close()

    const completed = await openRun(browser, 7)
    for (const target of [1, 2, 3, 4, 5, 6, 7]) await dragTo(completed.page, target)
    await completed.page.waitForFunction(() => globalThis.__gameState?.outcome === 'complete')
    observations.captures.complete = await completed.page.evaluate(() => globalThis.__gameState)
    await completed.page.screenshot({ path: `${OUT}/game-complete-ko.png` })
    observations.consoleErrors.push(...completed.consoleErrors)
    observations.pageErrors.push(...completed.pageErrors)
    observations.failedRequests.push(...completed.failedRequests)
    await completed.page.close()

    const ending = await openRun(browser, 7)
    for (const target of [7, 1, 6, 2, 5]) {
        const state = await dragTo(ending.page, target)
        if (state.over) break
        await delay(800)
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

    observations.pass = observations.captures.success.closedCount === 1
        && observations.captures.rupture.ruptures >= 1
        && observations.captures.complete.outcome === 'complete'
        && observations.captures.complete.closedCount === 7
        && observations.captures.gameOver.over === true
        && observations.consoleErrors.length === 0
        && observations.pageErrors.length === 0
        && observations.failedRequests.length === 0
    writeFileSync(`${OUT}/capture-result.json`, `${JSON.stringify(observations, null, 2)}\n`)
    console.log(JSON.stringify(observations, null, 2))
    if (!observations.pass) process.exitCode = 1
} finally {
    if (dev.pid) {
        try { process.kill(-dev.pid, 'SIGKILL') } catch { try { dev.kill('SIGKILL') } catch { /* gone */ } }
    }
}
