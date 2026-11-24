import { render, screen } from '@testing-library/react'
import { TacticsScreen } from '../screens/TacticsScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame, ratingAt } from '../../game/generate'
import { slotRoles } from '../../game/tactics'

const s0 = newGame(6, 'kapar')
const tac = s0.tactics.kapar
const id = tac.lineup[2]
const s = { ...s0, players: { ...s0.players, [id]: { ...s0.players[id], fitness: 41 } } }
const p = s.players[id]
const role = slotRoles(tac.formation)[2]

test('each player on the pitch has a face, the rating in that role, and fitness', () => {
  render(<LanguageProvider><TacticsScreen state={s} onChange={vi.fn()} /></LanguageProvider>)
  const pitch = screen.getByTestId('pitch')
  expect(pitch.querySelectorAll('.avatar')).toHaveLength(11)
  const rating = Math.round(ratingAt(p, role))
  const btn = screen.getByRole('button', { name: `${p.firstName} ${p.lastName} (${role}), rating ${rating}, fitness 41%` })
  expect(btn).toHaveTextContent(String(rating))
  expect(btn.querySelector('.meter.danger')).toBeInTheDocument()
})

test('the hint suits touch and mouse', () => {
  render(<LanguageProvider><TacticsScreen state={s} onChange={vi.fn()} /></LanguageProvider>)
  expect(screen.queryByText(/click/i)).not.toBeInTheDocument()
})
