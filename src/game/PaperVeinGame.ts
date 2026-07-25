import { APP_CONFIG } from '../appConfig'
import type { GameCallbacks, GameRuntime } from './types'
import {
    createState,
    renderModel,
    step,
    stitchPreview,
    STABILIZATION_SECONDS,
    TICK_SECONDS,
    type PaperVeinState,
} from './papervein/rules.mjs'

type Locale = 'ko' | 'en'
type Point = { x: number; y: number }

const W = 390
const H = 844
const VERMILION = '#E64B32'
const PAPER = '#e9dfc8'
const INK = '#2a2722'
const HOLES: Point[] = [
    { x: 154, y: 224 }, { x: 228, y: 300 }, { x: 148, y: 376 }, { x: 238, y: 452 },
    { x: 157, y: 528 }, { x: 229, y: 604 }, { x: 151, y: 680 }, { x: 220, y: 756 },
]
const COPY = {
    ko: {
        thread: '실',
        close: '봉합',
        ruptures: '파열',
        grab: '실 끝을 잡아 빈 구멍에 놓기',
        when: '실이 느슨해진 뒤 굵은 주름부터',
        goal: '7개 봉합 · 파열 3회 전',
        stitch: '당겨짐',
        stabilizing: (seconds: number) => `섬유가 느슨해지는 중 ${seconds}초`,
        ready: '느슨해졌다 · 굵은 주름부터',
        resist: '아직 팽팽하다',
        threadLeft: (thread: number) => `실 ${thread.toFixed(1)} 남음`,
        rupture: '파열',
        complete: '한 장이 되었다',
        failedRupture: '종이가 갈라졌다',
        failedThread: '실이 다했다',
        retry: '화면을 탭해 다시 수선',
        correction: (hole: number) => `${hole}번 구멍부터 당겨 보기`,
        language: 'EN',
        mute: '소리',
    },
    en: {
        thread: 'THREAD',
        close: 'CLOSE',
        ruptures: 'RUPTURE',
        grab: 'Drag the loose end to an empty hole',
        when: 'When the strand loosens, follow the bold crease',
        goal: 'Close 7 · before 3 ruptures',
        stitch: 'DRAWN TIGHT',
        stabilizing: (seconds: number) => `STRAND LOOSENING ${seconds}s`,
        ready: 'LOOSE · FOLLOW THE BOLD CREASE',
        resist: 'STILL TAUT',
        threadLeft: (thread: number) => `${thread.toFixed(1)} THREAD LEFT`,
        rupture: 'RUPTURE',
        complete: 'MADE WHOLE',
        failedRupture: 'THE SHEET SPLIT',
        failedThread: 'THREAD SPENT',
        retry: 'TAP TO MEND AGAIN',
        correction: (hole: number) => `Try hole ${hole} first`,
        language: 'KO',
        mute: 'SOUND',
    },
} as const

function queryLocale(): Locale {
    const requested = new URLSearchParams(location.search).get('lang')
    if (requested === 'ko' || requested === 'en') return requested
    try {
        const stored = localStorage.getItem('papervein-locale')
        if (stored === 'ko' || stored === 'en') return stored
    } catch { /* Arcade sandbox intentionally denies storage. */ }
    return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

function distance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

export class PaperVeinGame implements GameRuntime {
    private canvas: HTMLCanvasElement | null = null
    private ctx: CanvasRenderingContext2D | null = null
    private container: HTMLElement | null = null
    private callbacks: GameCallbacks | null = null
    private state: PaperVeinState
    private locale: Locale
    private readonly seed: number
    private readonly assetBase: string
    private paperImage = new Image()
    private fiberImage = new Image()
    private paperPattern: CanvasPattern | null = null
    private resizeObs: ResizeObserver | null = null
    private raf = 0
    private lastFrame = 0
    private accumulator = 0
    private paused = false
    private hidden = false
    private destroyed = false
    private dragging = false
    private dragPoint: Point | null = null
    private keyboardArmed = false
    private lastCommittedPreview: ReturnType<typeof stitchPreview> = null
    private resultDelivered = false
    private restartAt = 0
    private feedbackLife = 0
    private ruptureLife = 0
    private resistLife = 0
    private audio: AudioContext | null = null
    private muted = false
    private languageButton: HTMLButtonElement | null = null
    private muteButton: HTMLButtonElement | null = null

    constructor(assetBase = '') {
        const parsed = Number(new URLSearchParams(location.search).get('seed') ?? '1')
        this.seed = Number.isFinite(parsed) ? parsed : 1
        this.assetBase = assetBase
        this.locale = queryLocale()
        this.state = createState(this.seed)
    }

    async mount(container: HTMLElement, callbacks: GameCallbacks): Promise<void> {
        this.container = container
        this.callbacks = callbacks
        const canvas = document.createElement('canvas')
        canvas.setAttribute('aria-label', 'Paper Vein / 종이맥')
        canvas.tabIndex = 0
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        container.appendChild(canvas)
        this.installControls()
        this.resizeCanvas()
        this.resizeObs = new ResizeObserver(() => this.resizeCanvas())
        this.resizeObs.observe(container)

        const base = this.assetBase.replace(/\/?$/, '/')
        this.paperImage.src = `${base}assets/paper-fiber.png`
        this.fiberImage.src = `${base}assets/wet-fiber.png`
        await Promise.all([
            this.paperImage.decode().catch(() => undefined),
            this.fiberImage.decode().catch(() => undefined),
        ])
        if (this.destroyed) return
        if (this.ctx && this.paperImage.complete) this.paperPattern = this.ctx.createPattern(this.paperImage, 'repeat')

        canvas.addEventListener('pointerdown', this.onPointerDown)
        canvas.addEventListener('pointermove', this.onPointerMove)
        canvas.addEventListener('pointerup', this.onPointerUp)
        canvas.addEventListener('pointercancel', this.onPointerCancel)
        window.addEventListener('keydown', this.onKeyDown)
        document.addEventListener('visibilitychange', this.onVisibility)
        ;(globalThis as unknown as Record<string, unknown>).__forceGameOver = this.forceGameOver
        ;(globalThis as unknown as Record<string, unknown>).__gameDesignSize = { w: W, h: H }
        ;(globalThis as unknown as Record<string, unknown>).__gameOverUiBoxes = []
        this.lastFrame = performance.now()
        this.raf = requestAnimationFrame(this.frame)
    }

    private installControls() {
        if (!this.container) return
        const lang = document.createElement('button')
        lang.className = 'game-tool game-lang'
        lang.dataset.action = 'lang'
        lang.textContent = COPY[this.locale].language
        lang.addEventListener('click', () => this.setLocale(this.locale === 'ko' ? 'en' : 'ko'))
        this.container.appendChild(lang)
        this.languageButton = lang

        const mute = document.createElement('button')
        mute.className = 'game-tool game-mute'
        mute.dataset.action = 'mute'
        mute.textContent = COPY[this.locale].mute
        mute.addEventListener('click', () => this.setMuted(!this.muted))
        this.container.appendChild(mute)
        this.muteButton = mute
    }

    private resizeCanvas() {
        if (!this.canvas || !this.container) return
        const dpr = Math.min(devicePixelRatio || 1, 3)
        const scale = Math.min(this.container.clientWidth / W, this.container.clientHeight / H)
        const density = dpr * Math.max(1, scale)
        this.canvas.width = Math.round(W * density)
        this.canvas.height = Math.round(H * density)
        this.canvas.style.width = `${W * scale}px`
        this.canvas.style.height = `${H * scale}px`
        this.ctx = this.canvas.getContext('2d')
        this.ctx?.setTransform(density, 0, 0, density, 0, 0)
        if (this.ctx && this.paperImage.complete) this.paperPattern = this.ctx.createPattern(this.paperImage, 'repeat')
        this.draw()
    }

    private localPoint(event: PointerEvent): Point {
        const rect = this.canvas!.getBoundingClientRect()
        return {
            x: (event.clientX - rect.left) * W / rect.width,
            y: (event.clientY - rect.top) * H / rect.height,
        }
    }

    private loosePoint(): Point {
        const p = HOLES[this.state.endpoint]
        const side = this.state.endpoint % 2 ? 1 : -1
        if (this.state.stabilizationRemaining <= 0) return { x: p.x + side * 44, y: p.y + 24 }
        const loosened = 1 - this.state.stabilizationRemaining / STABILIZATION_SECONDS
        const recoil = this.state.materialRecoil * Math.sin(performance.now() * 0.035) * 8
        return {
            x: p.x + side * (8 + 36 * loosened) + recoil,
            y: p.y + 4 + 20 * loosened,
        }
    }

    private onPointerDown = (event: PointerEvent) => {
        this.startAudio()
        const point = this.localPoint(event)
        if (this.state.over) {
            if (performance.now() >= this.restartAt) this.restartRun()
            return
        }
        const endpoint = HOLES[this.state.endpoint]
        const loose = this.loosePoint()
        if (distance(point, endpoint) <= 54 || distance(point, loose) <= 54) {
            this.dragging = true
            this.dragPoint = point
            this.canvas?.setPointerCapture(event.pointerId)
            this.tone(118, 0.035, 0.035)
        }
    }

    private onPointerMove = (event: PointerEvent) => {
        if (!this.dragging) return
        this.dragPoint = this.localPoint(event)
    }

    private onPointerUp = (event: PointerEvent) => {
        if (!this.dragging || this.state.over) return
        const point = this.localPoint(event)
        this.dragging = false
        this.dragPoint = null
        let target = -1
        let nearest = 55
        for (let i = 1; i < HOLES.length; i += 1) {
            if (this.state.stitched[i - 1]) continue
            const d = distance(point, HOLES[i])
            if (d < nearest) { nearest = d; target = i }
        }
        if (target > 0) this.stitch(target)
    }

    private onPointerCancel = () => {
        this.dragging = false
        this.dragPoint = null
    }

    private availableTargets() {
        return Array.from({ length: 7 }, (_, i) => i + 1).filter((hole) => !this.state.stitched[hole - 1])
    }

    private onKeyDown = (event: KeyboardEvent) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'm', 'M'].includes(event.key)) return
        event.preventDefault()
        this.startAudio()
        if (event.key.toLowerCase() === 'm') { this.setMuted(!this.muted); return }
        if (this.state.over) {
            if (event.key === ' ' && performance.now() >= this.restartAt) this.restartRun()
            return
        }
        const targets = this.availableTargets()
        if (event.key.startsWith('Arrow')) {
            const current = Math.max(0, targets.indexOf(this.state.selected))
            const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
            const selected = targets[(current + delta + targets.length) % targets.length]
            this.state = step(this.state, { type: 'select', target: selected })
            return
        }
        if (event.key === ' ') {
            if (!this.keyboardArmed) {
                this.keyboardArmed = true
                this.tone(118, 0.035, 0.035)
            } else {
                this.keyboardArmed = false
                this.stitch(this.state.selected)
            }
        }
    }

    private stitch(target: number) {
        const serial = this.state.eventSerial
        const committedPreview = this.state.stabilizationRemaining <= 0
            ? stitchPreview(this.state, target)
            : null
        this.state = step(this.state, { type: 'stitch', target })
        if (this.state.eventSerial === serial) return
        if (this.state.lastEvent.type === 'resist') {
            this.resistLife = 1
            this.tone(92, 0.08, 0.045, 72)
            return
        }
        this.lastCommittedPreview = committedPreview
        this.feedbackLife = 1
        if (this.state.lastEvent.type === 'rupture') {
            this.ruptureLife = 1
            this.paperCrack()
        } else {
            this.fiberPull()
        }
        this.callbacks?.onScoreChange?.(renderModel(this.state).score)
        this.checkEnd()
    }

    private checkEnd() {
        if (!this.state.over || this.resultDelivered) return
        this.resultDelivered = true
        this.restartAt = performance.now() + 700
        const model = renderModel(this.state)
        ;(globalThis as unknown as Record<string, unknown>).__gameOverUiBoxes = this.state.outcome === 'complete'
            ? [
                { name: 'result-title', x: 48, y: 650, w: 294, h: 42 },
                { name: 'result-restart', x: 45, y: 742, w: 300, h: 38 },
            ]
            : [
                { name: 'result-title', x: 50, y: 318, w: 290, h: 58 },
                { name: 'result-restart', x: 45, y: 686, w: 300, h: 54 },
            ]
        this.callbacks?.onGameOver({ score: model.score, phase: this.state.closedCount })
        if (this.state.outcome === 'complete') this.tone(196, 0.35, 0.08, 293)
        else this.paperCrack()
    }

    private forceGameOver = () => {
        if (this.state.over) return
        this.state = step(this.state, { type: 'debugRupture', target: 2 })
        this.state = step(this.state, { type: 'debugRupture', target: 4 })
        this.state = step(this.state, { type: 'debugRupture', target: 6 })
        this.checkEnd()
    }

    private onVisibility = () => {
        this.hidden = document.visibilityState !== 'visible'
        if (!this.hidden) {
            this.lastFrame = performance.now()
            this.accumulator = 0
        }
        if (this.audio) {
            if (this.hidden) void this.audio.suspend()
            else if (!this.muted) void this.audio.resume()
        }
    }

    private frame = (now: number) => {
        if (this.destroyed) return
        const dt = Math.min(5 * TICK_SECONDS, Math.max(0, (now - this.lastFrame) / 1000))
        this.lastFrame = now
        if (!this.paused && !this.hidden && !this.state.over) {
            this.accumulator += dt
            let steps = 0
            const startSerial = this.state.eventSerial
            while (this.accumulator >= TICK_SECONDS && steps < 5) {
                this.state = step(this.state)
                this.accumulator -= TICK_SECONDS
                steps += 1
            }
            if (this.state.eventSerial !== startSerial) {
                if (this.state.lastEvent.type === 'rupture' || this.state.endedReason === 'ruptures') {
                    this.ruptureLife = 1
                    this.paperCrack()
                }
                this.checkEnd()
            }
        }
        this.feedbackLife = Math.max(0, this.feedbackLife - dt * 2.8)
        this.ruptureLife = Math.max(0, this.ruptureLife - dt * 1.9)
        this.resistLife = Math.max(0, this.resistLife - dt * 2.4)
        this.draw()
        this.raf = requestAnimationFrame(this.frame)
    }

    private draw() {
        const ctx = this.ctx
        if (!ctx) return
        ctx.save()
        ctx.clearRect(0, 0, W, H)
        const bg = ctx.createLinearGradient(0, 0, 0, H)
        bg.addColorStop(0, '#463627')
        bg.addColorStop(1, '#17130f')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, W, H)
        this.drawFrame(ctx)
        this.drawPaper(ctx)
        this.drawHud(ctx)
        if (this.state.guideVisible && !this.state.over) this.drawGuide(ctx)
        if (!this.state.over) this.drawStatus(ctx)
        if (this.state.over) this.drawResult(ctx)
        ctx.restore()
    }

    private drawFrame(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#5a432e'
        ctx.fillRect(17, 128, 20, 676)
        ctx.fillRect(353, 128, 20, 676)
        ctx.fillRect(17, 128, 356, 18)
        ctx.fillRect(17, 786, 356, 18)
        ctx.strokeStyle = 'rgba(242,210,149,.15)'
        ctx.lineWidth = 2
        for (let y = 144; y < 790; y += 34) {
            ctx.beginPath()
            ctx.moveTo(20, y)
            ctx.lineTo(36, y - 5)
            ctx.moveTo(354, y - 4)
            ctx.lineTo(371, y + 2)
            ctx.stroke()
        }
    }

    private drawPaper(ctx: CanvasRenderingContext2D) {
        const lift = this.state.outcome === 'complete' ? 9 : 0
        if (this.state.outcome === 'complete') {
            const glow = ctx.createRadialGradient(195, 460, 70, 195, 460, 340)
            glow.addColorStop(0, 'rgba(255,233,173,.95)')
            glow.addColorStop(1, 'rgba(255,189,99,0)')
            ctx.fillStyle = glow
            ctx.fillRect(20, 120, 350, 690)
        }
        ctx.save()
        const ruptureShake = this.ruptureLife > 0 ? Math.sin(performance.now() * 0.18) * this.ruptureLife * 3 : 0
        const settleRecoil = this.state.materialRecoil * Math.sin(performance.now() * 0.04) * 2.5
        ctx.translate(ruptureShake + settleRecoil, -lift)
        ctx.beginPath()
        ctx.moveTo(42, 151)
        ctx.lineTo(347, 154)
        ctx.lineTo(351, 778)
        ctx.quadraticCurveTo(200, 787 + lift * 1.5, 39, 776)
        ctx.closePath()
        ctx.fillStyle = this.paperPattern ?? PAPER
        ctx.fill()
        ctx.fillStyle = 'rgba(235,222,194,.28)'
        ctx.fill()
        ctx.strokeStyle = '#c2ad87'
        ctx.lineWidth = 3
        ctx.setLineDash([2, 4, 1, 3])
        ctx.stroke()
        ctx.setLineDash([])

        for (let i = 0; i < 7; i += 1) this.drawGap(ctx, i)
        this.drawWrinkles(ctx)
        this.drawStitches(ctx)
        this.drawHoles(ctx)
        this.drawLooseFiber(ctx)
        ctx.restore()
    }

    private drawGap(ctx: CanvasRenderingContext2D, i: number) {
        const a = HOLES[i]
        const b = HOLES[i + 1]
        const openness = this.state.openness[i]
        const stitched = this.state.stitched[i]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy)
        const nx = -dy / len
        const ny = dx / len
        const width = stitched ? 1.4 + openness * 2 : 2 + openness * 7.5
        const wobble = ((this.state.seed + i * 13) % 7) - 3
        const mx = (a.x + b.x) / 2 + nx * wobble
        const my = (a.y + b.y) / 2 + ny * wobble
        ctx.beginPath()
        ctx.moveTo(a.x + nx * width, a.y + ny * width)
        ctx.quadraticCurveTo(mx + nx * width * 1.5, my + ny * width * 1.5, b.x + nx * width, b.y + ny * width)
        ctx.quadraticCurveTo(mx - nx * width * 1.5, my - ny * width * 1.5, a.x - nx * width, a.y - ny * width)
        ctx.closePath()
        ctx.fillStyle = stitched ? 'rgba(66,54,42,.58)' : '#292520'
        ctx.fill()
        ctx.strokeStyle = this.state.ruptureByGap[i] ? '#302b25' : '#9a8769'
        ctx.lineWidth = this.state.ruptureByGap[i] ? 2.6 : 1.2
        if (this.state.ruptureByGap[i]) ctx.setLineDash([5, 3, 2, 4])
        ctx.stroke()
        ctx.setLineDash([])

        const preview = this.currentPreview()
        const previewRisk = preview?.gap === i && preview.wouldRupture
        if (previewRisk) {
            ctx.strokeStyle = 'rgba(42,39,34,.92)'
            ctx.lineWidth = 2.2
            ctx.setLineDash([7, 3, 2, 3])
            for (const offset of [5, 10]) {
                ctx.beginPath()
                ctx.moveTo(a.x + nx * (width + offset), a.y + ny * (width + offset))
                ctx.quadraticCurveTo(
                    mx + nx * (width * 1.5 + offset),
                    my + ny * (width * 1.5 + offset),
                    b.x + nx * (width + offset),
                    b.y + ny * (width + offset),
                )
                ctx.stroke()
            }
            ctx.setLineDash([])
            ctx.lineWidth = 1.4
            for (let j = 0; j < 5; j += 1) {
                const t = 0.2 + j * 0.15
                const x = a.x + dx * t
                const y = a.y + dy * t
                const vibration = j % 2 ? 1 : -1
                ctx.beginPath()
                ctx.moveTo(x + nx * (width + 4), y + ny * (width + 4))
                ctx.lineTo(
                    x + nx * (width + 13) + dx / len * vibration * 3,
                    y + ny * (width + 13) + dy / len * vibration * 3,
                )
                ctx.stroke()
            }
        }

        if (this.state.ruptureByGap[i]) {
            ctx.strokeStyle = 'rgba(42,39,34,.85)'
            ctx.lineWidth = 1.5
            for (let j = 0; j < 3; j += 1) {
                const t = 0.35 + j * 0.15
                const x = a.x + dx * t
                const y = a.y + dy * t
                ctx.beginPath()
                ctx.moveTo(x + nx * (width + 5), y + ny * (width + 5))
                ctx.lineTo(x + nx * (width + 10) + dx / len * 3, y + ny * (width + 10) + dy / len * 3)
                ctx.lineTo(x + nx * (width + 14), y + ny * (width + 14))
                ctx.stroke()
            }
        }
    }

    private drawWrinkles(ctx: CanvasRenderingContext2D) {
        const model = renderModel(this.state)
        for (let i = 0; i < 7; i += 1) {
            if (this.state.stitched[i]) continue
            const a = HOLES[i]
            const b = HOLES[i + 1]
            const x = (a.x + b.x) / 2
            const y = (a.y + b.y) / 2
            const bold = i === model.highestTensionGap
            const settle = this.state.stabilizationRemaining > 0 ? model.stabilizationProgress : 1
            const length = 12 + this.state.tension[i] * 38 + (bold ? 15 * settle : 0)
            ctx.strokeStyle = bold ? `rgba(52,46,38,${0.52 + settle * 0.4})` : 'rgba(74,65,53,.28)'
            ctx.lineWidth = bold ? 2.4 + settle * 1.5 : 1
            for (let w = -1; w <= 1; w += 1) {
                ctx.beginPath()
                const target = HOLES[i + 1]
                const originX = bold ? target.x + (i % 2 ? 1 : -1) * length : x
                const originY = bold ? target.y - 13 + w * 4 : y
                const endX = bold ? target.x + w * 1.5 : x + (i % 2 ? -1 : 1) * length
                const endY = bold ? target.y - 2 : y - 2 + w * 3
                ctx.moveTo(originX, originY)
                ctx.quadraticCurveTo(
                    bold ? target.x + (i % 2 ? 1 : -1) * length * .35 : x + (i % 2 ? -1 : 1) * length * .55,
                    bold ? target.y - 8 : y - 9,
                    endX,
                    endY,
                )
                ctx.stroke()
            }
        }
    }

    private drawStitches(ctx: CanvasRenderingContext2D) {
        ctx.lineCap = 'round'
        for (const stitch of this.state.stitches) {
            const a = HOLES[stitch.from]
            const b = HOLES[stitch.to]
            const life = this.state.lastEvent.type === 'stitch' && this.state.lastEvent.target === stitch.to - 1
                ? this.feedbackLife
                : 0
            const bow = life * 20
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.quadraticCurveTo((a.x + b.x) / 2 + bow, (a.y + b.y) / 2, b.x, b.y)
            ctx.strokeStyle = '#9d2d22'
            ctx.lineWidth = 8
            ctx.stroke()
            ctx.strokeStyle = VERMILION
            ctx.lineWidth = 4.5
            ctx.stroke()
        }
    }

    private drawHoles(ctx: CanvasRenderingContext2D) {
        for (let i = 0; i < HOLES.length; i += 1) {
            const p = HOLES[i]
            const selected = !this.state.over && i === this.state.selected && !this.state.stitched[i - 1]
            ctx.beginPath()
            ctx.arc(p.x, p.y, selected ? 14 : 10, 0, Math.PI * 2)
            ctx.fillStyle = '#b9a37f'
            ctx.fill()
            ctx.beginPath()
            ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2)
            ctx.fillStyle = '#25211d'
            ctx.fill()
            if (selected) {
                ctx.strokeStyle = INK
                ctx.lineWidth = 2
                ctx.setLineDash([3, 3])
                ctx.stroke()
                ctx.setLineDash([])
            }
        }
    }

    private drawLooseFiber(ctx: CanvasRenderingContext2D) {
        const start = HOLES[this.state.endpoint]
        const end = this.dragging && this.dragPoint ? this.dragPoint : this.loosePoint()
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.bezierCurveTo(start.x + (end.x - start.x) * .25, start.y + 22, end.x - 15, end.y + 10, end.x, end.y)
        ctx.strokeStyle = '#9d2d22'
        ctx.lineWidth = 9
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.strokeStyle = VERMILION
        ctx.lineWidth = 5
        ctx.stroke()
        if (this.dragging && this.dragPoint) {
            const closest = this.availableTargets().reduce((best, hole) =>
                distance(this.dragPoint!, HOLES[hole]) < distance(this.dragPoint!, HOLES[best]) ? hole : best,
            this.availableTargets()[0] ?? 1)
            const preview = stitchPreview(this.state, closest)
            if (!preview) return
            ctx.fillStyle = 'rgba(31,27,23,.82)'
            const labelWidth = this.locale === 'ko' ? 106 : 132
            ctx.fillRect(end.x - labelWidth / 2, end.y - 39, labelWidth, 25)
            ctx.fillStyle = '#f1e7d0'
            ctx.font = '12px Galmuri11, monospace'
            ctx.textAlign = 'center'
            ctx.fillText(COPY[this.locale].threadLeft(preview.remainingThread), end.x, end.y - 21)
        }
        if (this.state.stabilizationRemaining > 0) this.drawStabilizationRing(ctx, start)
    }

    private currentPreview() {
        if (!this.dragging || !this.dragPoint) return null
        const targets = this.availableTargets()
        if (!targets.length) return null
        const closest = targets.reduce((best, hole) =>
            distance(this.dragPoint!, HOLES[hole]) < distance(this.dragPoint!, HOLES[best]) ? hole : best,
        targets[0])
        return stitchPreview(this.state, closest)
    }

    private drawStabilizationRing(ctx: CanvasRenderingContext2D, center: Point) {
        const progress = 1 - this.state.stabilizationRemaining / STABILIZATION_SECONDS
        ctx.save()
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgba(42,39,34,.25)'
        ctx.beginPath()
        ctx.arc(center.x, center.y, 18, -Math.PI / 2, Math.PI * 1.5)
        ctx.stroke()
        ctx.strokeStyle = VERMILION
        ctx.beginPath()
        ctx.arc(center.x, center.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
        ctx.stroke()
        ctx.restore()
    }

    private drawHud(ctx: CanvasRenderingContext2D) {
        const c = COPY[this.locale]
        ctx.fillStyle = '#efe5cf'
        ctx.fillRect(28, 30, 334, 74)
        ctx.strokeStyle = '#8c7559'
        ctx.lineWidth = 1
        ctx.strokeRect(28.5, 30.5, 333, 73)
        ctx.fillStyle = INK
        ctx.textBaseline = 'middle'
        ctx.font = '11px Galmuri11, monospace'
        ctx.textAlign = 'left'
        ctx.fillText(c.thread, 44, 49)
        ctx.font = '23px Galmuri14, monospace'
        ctx.fillText(String(Math.round(this.state.thread)), 44, 77)
        ctx.font = '11px Galmuri11, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(c.close, 195, 49)
        ctx.font = '20px Galmuri14, monospace'
        ctx.fillText(`${this.state.closedCount} / 7`, 195, 77)
        ctx.font = '11px Galmuri11, monospace'
        ctx.textAlign = 'right'
        ctx.fillText(c.ruptures, 344, 49)
        ctx.font = '20px Galmuri14, monospace'
        ctx.fillText(`${this.state.ruptures} / 3`, 344, 77)
    }

    private drawGuide(ctx: CanvasRenderingContext2D) {
        const c = COPY[this.locale]
        ctx.fillStyle = 'rgba(239,229,207,.94)'
        ctx.fillRect(49, 111, 292, 86)
        ctx.strokeStyle = '#8c7559'
        ctx.strokeRect(49.5, 111.5, 291, 85)
        ctx.fillStyle = INK
        ctx.textAlign = 'center'
        ctx.font = this.locale === 'ko' ? '12px Galmuri11, monospace' : '11px Galmuri11, monospace'
        ctx.fillText(c.grab, 195, 135)
        ctx.fillText(c.when, 195, 160)
        ctx.fillText(c.goal, 195, 184)
    }

    private drawStatus(ctx: CanvasRenderingContext2D) {
        const isRupture = this.state.lastEvent.type === 'rupture' && this.ruptureLife > 0
        const isStitch = this.state.lastEvent.type === 'stitch' && this.feedbackLife > 0
        const isResist = this.state.lastEvent.type === 'resist' && this.resistLife > 0
        const isReady = this.state.readyCueRemaining > 0 && this.state.lastEvent.type === 'ready'
        const isStabilizing = this.state.stabilizationRemaining > 0
        if (!isRupture && !isStitch && !isResist && !isReady && !isStabilizing) return
        const life = isRupture ? this.ruptureLife
            : isResist ? this.resistLife
                : isReady ? Math.min(1, this.state.readyCueRemaining)
                    : isStabilizing ? 1
                        : this.feedbackLife
        ctx.globalAlpha = Math.min(1, life * 1.8)
        ctx.fillStyle = 'rgba(37,33,29,.86)'
        ctx.fillRect(76, 799, 238, 30)
        ctx.strokeStyle = isRupture || isResist ? '#f1e7d0' : VERMILION
        ctx.lineWidth = 1.5
        ctx.strokeRect(76.5, 799.5, 237, 29)
        ctx.fillStyle = '#f1e7d0'
        ctx.textAlign = 'center'
        ctx.font = this.locale === 'ko' ? '12px Galmuri14, monospace' : '11px Galmuri14, monospace'
        const text = isRupture
            ? COPY[this.locale].rupture
            : isResist
                ? COPY[this.locale].resist
                : isReady
                    ? COPY[this.locale].ready
                    : isStabilizing
                        ? COPY[this.locale].stabilizing(Math.ceil(this.state.stabilizationRemaining))
                        : COPY[this.locale].stitch
        ctx.fillText(text, 195, 815)
        ctx.globalAlpha = 1
    }

    private drawResult(ctx: CanvasRenderingContext2D) {
        const c = COPY[this.locale]
        const model = renderModel(this.state)
        if (this.state.outcome === 'complete') {
            ctx.fillStyle = 'rgba(31,27,23,.58)'
            ctx.fillRect(34, 646, 322, 137)
            ctx.strokeStyle = VERMILION
            ctx.lineWidth = 2
            ctx.strokeRect(35, 647, 320, 135)
            ctx.textAlign = 'center'
            ctx.fillStyle = '#f4ead4'
            ctx.font = this.locale === 'ko' ? '22px Galmuri14, monospace' : '20px Galmuri14, monospace'
            ctx.fillText(c.complete, 195, 678)
            ctx.font = '12px Galmuri11, monospace'
            ctx.fillStyle = '#eadcc0'
            ctx.fillText(`${c.thread} ${Math.round(this.state.thread)} · ${Math.round(this.state.elapsed)}s · ${model.score}`, 195, 708)
            ctx.fillText(c.correction(model.suggestedHole), 195, 735)
            ctx.fillStyle = VERMILION
            ctx.font = this.locale === 'ko' ? '14px Galmuri14, monospace' : '12px Galmuri14, monospace'
            ctx.fillText(c.retry, 195, 764)
            return
        }
        ctx.fillStyle = 'rgba(31,27,23,.84)'
        ctx.fillRect(28, 276, 334, 474)
        ctx.strokeStyle = '#d9c8a9'
        ctx.lineWidth = 2
        ctx.strokeRect(29, 277, 332, 472)
        ctx.textAlign = 'center'
        ctx.fillStyle = '#f4ead4'
        ctx.font = this.locale === 'ko' ? '25px Galmuri14, monospace' : '23px Galmuri14, monospace'
        const title = this.state.endedReason === 'thread' ? c.failedThread : c.failedRupture
        ctx.fillText(title, 195, 350)
        ctx.font = '14px Galmuri11, monospace'
        ctx.fillStyle = '#d7c8aa'
        ctx.fillText(`${c.thread} ${Math.round(this.state.thread)}  ·  ${c.ruptures} ${this.state.ruptures} / 3`, 195, 409)
        ctx.fillText(`${Math.round(this.state.elapsed)}s  ·  ${model.score}`, 195, 441)
        ctx.strokeStyle = 'rgba(239,229,207,.28)'
        ctx.beginPath()
        ctx.moveTo(72, 477)
        ctx.lineTo(318, 477)
        ctx.stroke()
        ctx.fillStyle = '#f4ead4'
        ctx.font = this.locale === 'ko' ? '14px Galmuri11, monospace' : '13px Galmuri11, monospace'
        ctx.fillText(c.correction(model.suggestedHole), 195, 526)
        ctx.fillStyle = VERMILION
        ctx.font = this.locale === 'ko' ? '15px Galmuri14, monospace' : '13px Galmuri14, monospace'
        ctx.fillText(c.retry, 195, 710)
    }

    private startAudio() {
        if (!this.audio) this.audio = new AudioContext()
        if (!this.muted && this.audio.state === 'suspended') void this.audio.resume()
    }

    private tone(freq: number, duration: number, volume: number, second?: number) {
        if (this.muted || !this.audio) return
        const now = this.audio.currentTime
        const gain = this.audio.createGain()
        const oscillator = this.audio.createOscillator()
        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(freq, now)
        if (second) oscillator.frequency.exponentialRampToValueAtTime(second, now + duration)
        gain.gain.setValueAtTime(volume, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
        oscillator.connect(gain).connect(this.audio.destination)
        oscillator.start(now)
        oscillator.stop(now + duration)
    }

    private fiberPull() {
        this.tone(132, 0.13, 0.06, 224)
        setTimeout(() => this.tone(310, 0.07, 0.035), 75)
    }

    private paperCrack() {
        if (this.muted || !this.audio) return
        const now = this.audio.currentTime
        const length = Math.floor(this.audio.sampleRate * 0.12)
        const buffer = this.audio.createBuffer(1, length, this.audio.sampleRate)
        const channel = buffer.getChannelData(0)
        for (let i = 0; i < length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / length)
        const source = this.audio.createBufferSource()
        const filter = this.audio.createBiquadFilter()
        const gain = this.audio.createGain()
        filter.type = 'highpass'
        filter.frequency.value = 1200
        gain.gain.value = 0.09
        source.buffer = buffer
        source.connect(filter).connect(gain).connect(this.audio.destination)
        source.start(now)
    }

    setPaused(value: boolean) {
        this.paused = value
        this.lastFrame = performance.now()
        this.accumulator = 0
        if (this.audio) {
            if (value) void this.audio.suspend()
            else if (!this.muted) void this.audio.resume()
        }
    }

    setMuted(value: boolean) {
        this.muted = value
        if (this.audio) {
            if (value) void this.audio.suspend()
            else void this.audio.resume()
        }
        if (this.muteButton) this.muteButton.dataset.muted = String(value)
    }

    setLocale(locale: Locale) {
        this.locale = locale
        try { localStorage.setItem('papervein-locale', locale) } catch { /* Host owns Arcade locale. */ }
        if (this.languageButton) this.languageButton.textContent = COPY[locale].language
        if (this.muteButton) this.muteButton.textContent = COPY[locale].mute
    }

    restartRun() {
        this.state = createState(this.seed)
        this.resultDelivered = false
        this.restartAt = 0
        this.feedbackLife = 0
        this.ruptureLife = 0
        this.resistLife = 0
        this.dragging = false
        this.keyboardArmed = false
        this.lastCommittedPreview = null
        this.accumulator = 0
        this.lastFrame = performance.now()
        ;(globalThis as unknown as Record<string, unknown>).__gameOverUiBoxes = []
        ;(globalThis as unknown as Record<string, unknown>).__gameResult = undefined
        this.callbacks?.onScoreChange?.(0)
    }

    getDebugState(): Record<string, unknown> {
        const model = renderModel(this.state)
        return {
            over: this.state.over,
            outcome: this.state.outcome,
            score: model.score,
            elapsed: this.state.elapsed,
            thread: this.state.thread,
            ruptures: this.state.ruptures,
            closedCount: this.state.closedCount,
            endpoint: this.state.endpoint,
            selected: this.state.selected,
            guideVisible: this.state.guideVisible,
            guideTiming: COPY[this.locale].when,
            event: this.state.lastEvent.type,
            stabilizationRemaining: this.state.stabilizationRemaining,
            ready: this.state.stabilizationRemaining <= 0,
            rejectedStitches: this.state.rejectedStitches,
            dragPreview: this.currentPreview(),
            lastCommittedPreview: this.lastCommittedPreview,
            holes: HOLES,
            paused: this.paused || this.hidden,
            locale: this.locale,
        }
    }

    destroy(): void {
        if (this.destroyed) return
        this.destroyed = true
        cancelAnimationFrame(this.raf)
        this.resizeObs?.disconnect()
        this.canvas?.removeEventListener('pointerdown', this.onPointerDown)
        this.canvas?.removeEventListener('pointermove', this.onPointerMove)
        this.canvas?.removeEventListener('pointerup', this.onPointerUp)
        this.canvas?.removeEventListener('pointercancel', this.onPointerCancel)
        window.removeEventListener('keydown', this.onKeyDown)
        document.removeEventListener('visibilitychange', this.onVisibility)
        this.languageButton?.remove()
        this.muteButton?.remove()
        this.canvas?.remove()
        void this.audio?.close()
        this.canvas = null
        this.ctx = null
    }
}

if (APP_CONFIG.designWidth !== W || APP_CONFIG.designHeight !== H) {
    console.warn('Paper Vein design size differs from APP_CONFIG')
}
