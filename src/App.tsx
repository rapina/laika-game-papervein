import { useState } from 'react'
import MobileFrame from './components/MobileFrame'
import TitleScreen from './screens/TitleScreen'
import GameScreen from './components/GameScreen'

type Screen = 'title' | 'game'

export default function App() {
    const [screen, setScreen] = useState<Screen>('title')

    return (
        <MobileFrame>
            {screen === 'title' ? (
                <TitleScreen
                    onPlay={() => setScreen('game')}
                    onRanking={() => undefined}
                />
            ) : (
                <GameScreen
                    onGameOver={() => undefined}
                    onExit={() => setScreen('title')}
                />
            )}
        </MobileFrame>
    )
}
