import { useEffect, useRef } from 'react'
import type { GameResult } from '../game/types'
import { PaperVeinGame } from '../game/PaperVeinGame'

interface Props {
    onGameOver(result: GameResult): void
    onExit(): void
}

/**
 * Mounts the game runtime and forwards its lifecycle to the shell.
 * Mounts the Paper Vein runtime and keeps the shell contract narrow.
 */
export default function GameScreen({ onGameOver }: Props) {
    const hostRef = useRef<HTMLDivElement>(null)
    const endedRef = useRef(false)

    useEffect(() => {
        const host = hostRef.current
        if (!host) return

        const game = new PaperVeinGame()
        game.mount(host, {
            onGameOver: (result) => {
                if (endedRef.current) return
                endedRef.current = true
                onGameOver(result)
            },
        })

        // Expose runtime state for scripts/smoke.mjs and agent debugging.
        const poll = setInterval(() => {
            ;(globalThis as unknown as Record<string, unknown>).__gameState = game.getDebugState()
        }, 250)

        return () => {
            clearInterval(poll)
            game.destroy()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="screen game-screen">
            <div ref={hostRef} className="game-host" />
        </div>
    )
}
