import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YouthScreen, type YouthActions } from './YouthScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame, overall } from '../../game/generate'
import { squad } from '../../game/market'
import type { GameState } from '../../game/types'

afterEach(() => { try { localStorage.clear() } catch { /* ignore */ } })
const base = newGame(6, 'kapar')
const kid = base.youth.intake[0]
const name = `${kid.firstName} ${kid.lastName}`

function show(s: GameState, outcome: ReturnType<YouthActions['sign']> = { kind: 'signed' }) {
  const actions = { train: vi.fn(), sign: vi.fn(() => outcome), release: vi.fn() }
  render(<LanguageProvider><YouthScreen state={s} actions={actions} /></LanguageProvider>)
  return { user: userEvent.setup(), actions }
}
const card = () => screen.getByText(name).closest('li')!

test('training focus shows the current choice and changes it', async () => {
  const { user, actions } = show(base)
  expect(screen.getByRole('button', { name: /Balanced/ })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: /Youth development/ }))
  expect(actions.train).toHaveBeenCalledWith('youth')
})

test('candidates show a scout range in stars, never the raw potential', () => {
  show(base)
  expect(within(card()).getByLabelText(/Potential: .* to .* stars/)).toBeInTheDocument()
  expect(card().textContent).not.toMatch(new RegExp(`\\b${kid.potential}\\b.*potential`, 'i'))
})

test('promoting and releasing call through and report', async () => {
  const { user, actions } = show(base)
  await user.click(within(card()).getByRole('button', { name: 'Promote' }))
  expect(actions.sign).toHaveBeenCalledWith(kid.id)
  expect(screen.getByRole('status')).toHaveTextContent(`${name} joins the squad`)
  await user.click(within(card()).getByRole('button', { name: 'Release' }))
  expect(actions.release).toHaveBeenCalledWith(kid.id)
})

test('a refused promotion says why', async () => {
  const { user } = show(base, { kind: 'refused', reason: 'squadFull' })
  await user.click(within(card()).getByRole('button', { name: 'Promote' }))
  expect(screen.getByRole('status')).toHaveTextContent('squad is full')
})

test('an empty intake is explained', () => {
  show({ ...base, youth: { intake: [] } })
  expect(screen.getByText(/No candidates right now/)).toBeInTheDocument()
})

test('young squad players are listed with appearances and progress', () => {
  const p = squad(base, 'kapar').find((x) => x.age <= 21)!
  show({ ...base, players: { ...base.players, [p.id]: { ...p, apps: 9, ovrStart: overall(p) - 1.5 } } })
  const row = screen.getByText(`${p.firstName} ${p.lastName}`).closest('tr')!
  expect(within(row).getByText('9')).toBeInTheDocument()
  expect(within(row).getByText('+1.5')).toBeInTheDocument()
})

test('Malay', () => {
  localStorage.setItem('bola-daerah.lang', 'ms')
  show(base)
  expect(screen.getByRole('button', { name: /Pembangunan belia/ })).toBeInTheDocument()
})
