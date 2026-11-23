import { render, screen } from '@testing-library/react'
import { ClubScreen } from './ClubScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import { applyReaction } from '../../game/reactions'
import type { GameState } from '../../game/types'

afterEach(() => { try { localStorage.clear() } catch { /* ignore */ } })
const show = (s: GameState) => render(<LanguageProvider><ClubScreen state={s} /></LanguageProvider>)

test('shows balance in RM, expectation, and a fan meter', () => {
  const s = applyReaction(newGame(1, 'petaling'), { fanDelta: 7, boardDelta: 0, reasons: [{ key: 'fans.reason.derbyWin', params: { oppId: 'klang', score: '2–1' } }] })
  show(s)
  expect(screen.getByText('RM 1,600,000')).toBeInTheDocument()
  expect(screen.getByText(/Win the league/)).toBeInTheDocument()
  expect(screen.getByRole('meter', { name: 'Fan mood' })).toHaveAttribute('aria-valuenow', '67')
  expect(screen.getByText(/Klang/)).toBeInTheDocument()
  expect(screen.getByText('+7')).toBeInTheDocument()
})

test('negative balance is styled as negative', () => {
  const s = newGame(1, 'kapar')
  show({ ...s, finance: { ...s.finance, balance: -25000 } })
  const bal = screen.getByText('-RM 25,000')
  expect(bal.className).toMatch(/neg/)
})

test('expectation text follows the language', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  show(newGame(1, 'petaling'))
  expect(screen.getByText(/Menjuarai liga/)).toBeInTheDocument()
})
