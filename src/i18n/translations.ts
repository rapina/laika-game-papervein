export type Locale = 'ko' | 'en'

/**
 * Shell UI strings. Game content strings (rules, dialog, item names, …)
 * belong in separate per-domain files merged in i18n/index.ts — see how
 * DEAD HAND split codex/dialog/gameUi translations.
 */
export const translations: Record<Locale, Record<string, string>> = {
    ko: {
        'title.name': '종이맥',
        'title.tagline': '벌어지는 틈을 한 가닥으로',
        'title.play': '수선 시작',
        'title.ranking': '기록',
        'game.exit': '나가기',
        'ranking.title': '랭킹',
        'ranking.best': '최고 기록!',
        'ranking.empty': '아직 기록이 없습니다',
        'ranking.retry': '다시 하기',
        'ranking.menu': '메뉴로',
        'error.title': '오류',
        'error.leaderboard': '리더보드를 열 수 없습니다.',
    },
    en: {
        'title.name': 'PAPER VEIN',
        'title.tagline': 'Bind every opening with one strand',
        'title.play': 'BEGIN MENDING',
        'title.ranking': 'RECORDS',
        'game.exit': 'EXIT',
        'ranking.title': 'RANKING',
        'ranking.best': 'NEW BEST!',
        'ranking.empty': 'No records yet',
        'ranking.retry': 'RETRY',
        'ranking.menu': 'MENU',
        'error.title': 'Error',
        'error.leaderboard': 'Could not open the leaderboard.',
    },
}
