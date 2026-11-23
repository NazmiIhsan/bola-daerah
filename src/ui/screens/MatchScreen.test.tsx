import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MatchScreen } from './MatchScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import type { MatchState } from '../../game/match/types'

afterEach(() => {
  vi.useRealTimers()
  try { localStorage.clear() } catch { /* ignore */ }
})

const renderMatch = (onFinish = vi.fn()) => {
  render(<LanguageProvider><MatchScreen state={newGame(8, 'kapar')} onFinish={onFinish} /></LanguageProvider>)
  return onFinish
}

test('Skip to end finishes the match; Finish calls onFinish with finished=true', () => {
  const onFinish = renderMatch()
  fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
  expect(screen.getByText('Full-time')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  expect(onFinish).toHaveBeenCalledTimes(1)
  const m: MatchState = onFinish.mock.calls[0][0]
  expect(m.finished).toBe(true)
  expect(m.minute).toBe(90)
})

test('the clock advances while playing', () => {
  vi.useFakeTimers()
  renderMatch()
  act(() => { vi.advanceTimersByTime(3000) })
  expect(screen.getByTestId('clock').textContent).not.toBe("0'")
})

test('making a sub in the pause panel is reflected; the 6th sub is disabled', () => {
  renderMatch()
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  const panel = screen.getByRole('region', { name: 'Team changes' })
  expect(within(panel).getByText('Substitutions left: 5')).toBeInTheDocument()
  for (let i = 0; i < 5; i++) {
    const off = within(panel).getByLabelText('Take off') as HTMLSelectElement
    const on = within(panel).getByLabelText('Bring on') as HTMLSelectElement
    fireEvent.change(off, { target: { value: off.options[1 + i].value } })
    fireEvent.change(on, { target: { value: on.options[0].value } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Make substitution' }))
  }
  expect(within(panel).getByText('Substitutions left: 0')).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Make substitution' })).toBeDisabled()
})

test('changing style in the pause panel applies to the match', () => {
  const onFinish = renderMatch()
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  const panel = screen.getByRole('region', { name: 'Team changes' })
  fireEvent.click(within(panel).getByRole('button', { name: 'Defensive' }))
  fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  const m: MatchState = onFinish.mock.calls[0][0]
  const mine = m.home.clubId === 'kapar' ? m.home : m.away
  expect(mine.tactics.style).toBe('defensive')
})

test('commentary feed shows text in the selected language', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  renderMatch()
  fireEvent.click(screen.getByRole('button', { name: 'Langkau ke akhir' }))
  const feed = screen.getByRole('log')
  expect(feed.textContent).toMatch(/Tamat perlawanan|Semuanya sudah berakhir|Wisel penamat/)
})
