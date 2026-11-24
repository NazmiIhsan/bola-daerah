import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from './Dashboard'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import { matchTactics, playMatchday, userFixture } from '../../game/season'
import type { GameApi } from '../useGame'
import type { GameState } from '../../game/types'

afterEach(() => localStorage.clear())
function show(state: GameState) {
  const onGo = vi.fn()
  render(<LanguageProvider><Dashboard game={{ state } as unknown as GameApi} onPlayMatch={vi.fn()} onGo={onGo} /></LanguageProvider>)
  return onGo
}
const played = (n: number) => { let s = newGame(3, 'kapar'); for (let i = 0; i < n; i++) s = { ...playMatchday(s), press: null }; return s }

test('next match shows both clubs with place and form', () => {
  const s = played(4)
  show(s)
  const next = screen.getByRole('region', { name: 'Next match' })
  expect(within(next).getAllByText(/^(1st|2nd|3rd|\d+th)$/)).toHaveLength(2)
  expect(within(next).getAllByRole('img', { name: /^Form: / })).toHaveLength(2)
})

test('mini table shows five clubs around the user', () => {
  show(played(4))
  const rows = within(screen.getByRole('region', { name: 'League position' })).getAllByRole('row')
  expect(rows).toHaveLength(5)
  expect(rows.filter((r) => r.classList.contains('me'))).toHaveLength(1)
})

test('alerts take you to the right screen', async () => {
  const s = newGame(3, 'kapar')
  const onGo = show({ ...s, board: { ...s.board, confidence: 10 } })
  const list = screen.getByRole('region', { name: 'To do' })
  await userEvent.click(within(list).getByRole('button', { name: /board is losing patience/i }))
  expect(onGo).toHaveBeenCalledWith('club')
})

test('result letters are translated', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  const s = played(4)
  show(s)
  const letters = [...document.querySelectorAll('.pill')].map((p) => p.textContent)
  expect(letters.length).toBeGreaterThan(3)
  for (const l of letters) expect(['M', 'S', 'K']).toContain(l)
})

test('next match says how the opponent will probably line up', () => {
  const s = played(4)
  const f = userFixture(s)!
  const rival = f.homeId === 'kapar' ? f.awayId : f.homeId
  const { formation, style } = matchTactics(s)[rival]
  show(s)
  const word = { attacking: 'Attacking', balanced: 'Balanced', defensive: 'Defensive', counter: 'Counter' }[style]
  expect(within(screen.getByRole('region', { name: 'Next match' })).getByText(`Expected from ${s.clubs[rival].name}: ${formation} · ${word}`)).toBeInTheDocument()
})

test('the opponent’s likely line-up is translated', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  show(played(4))
  expect(screen.getByText(/^Jangkaan .+: \d(-\d)+ · (Menyerang|Seimbang|Bertahan|Serang balas)$/)).toBeInTheDocument()
})
