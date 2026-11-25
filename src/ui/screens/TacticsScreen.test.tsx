import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { TacticsScreen } from './TacticsScreen'
import { newGame } from '../../game/generate'
import type { GameState, Tactics } from '../../game/types'

let latest: Tactics
function Harness({ initial }: { initial: GameState }) {
  const [s, setS] = useState(initial)
  return <TacticsScreen state={s} onChange={(t) => { latest = t; setS({ ...s, tactics: { ...s.tactics, [s.userClubId]: t } }) }} />
}
const fullName = (s: GameState, id: string) => `${s.players[id].firstName} ${s.players[id].lastName}`

test('changing formation re-slots players and keeps 11 in the lineup', async () => {
  const s = newGame(4, 'kapar')
  const user = userEvent.setup()
  render(<Harness initial={s} />)
  await user.selectOptions(screen.getByLabelText('Formation'), '4-3-3')
  expect(latest.formation).toBe('4-3-3')
  expect(latest.lineup).toHaveLength(11)
  expect(new Set(latest.lineup)).toEqual(new Set(s.tactics.kapar.lineup))
})

test('style buttons update tactics.style', async () => {
  const user = userEvent.setup()
  render(<Harness initial={newGame(4, 'kapar')} />)
  await user.click(screen.getByRole('button', { name: 'Counter' }))
  expect(latest.style).toBe('counter')
})

test('swapping a starter with a bench player updates lineup/subs', async () => {
  const s = newGame(4, 'kapar')
  const user = userEvent.setup()
  render(<Harness initial={s} />)
  const starter = s.tactics.kapar.lineup[3]
  const sub = s.tactics.kapar.subs[0]
  await user.click(within(screen.getByTestId('pitch')).getByRole('button', { name: new RegExp(fullName(s, starter)) }))
  await user.click(within(screen.getByTestId('bench')).getByRole('button', { name: new RegExp(fullName(s, sub)) }))
  expect(latest.lineup[3]).toBe(sub)
  expect(latest.subs).toContain(starter)
  expect(latest.subs).not.toContain(sub)
})

test('injured/suspended players are marked and cannot be put in the lineup', async () => {
  const base = newGame(4, 'kapar')
  const hurtId = base.tactics.kapar.subs[1]
  const s: GameState = { ...base, players: { ...base.players, [hurtId]: { ...base.players[hurtId], injuredWeeks: 2 } } }
  const user = userEvent.setup()
  render(<Harness initial={s} />)
  const hurtBtn = within(screen.getByTestId('bench')).getByRole('button', { name: new RegExp(fullName(s, hurtId)) })
  expect(hurtBtn).toHaveTextContent(/Injured/)
  latest = s.tactics.kapar
  await user.click(within(screen.getByTestId('pitch')).getByRole('button', { name: new RegExp(fullName(s, s.tactics.kapar.lineup[2])) }))
  await user.click(hurtBtn)
  expect(latest.lineup).not.toContain(hurtId)
})

test('Auto-pick button fills the best XI', async () => {
  const base = newGame(4, 'kapar')
  const s: GameState = { ...base, tactics: { ...base.tactics, kapar: { ...base.tactics.kapar, lineup: base.tactics.kapar.lineup.slice(0, 8) } } }
  const user = userEvent.setup()
  render(<Harness initial={s} />)
  expect(screen.getByText(/only 8 players/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Auto-pick best XI' }))
  expect(latest.lineup).toHaveLength(11)
  expect(screen.queryByText(/only 8 players/)).not.toBeInTheDocument()
})

test('strength bars update when lineup changes', async () => {
  const s = newGame(4, 'kapar')
  const user = userEvent.setup()
  render(<Harness initial={s} />)
  const attack = () => Number(screen.getByRole('meter', { name: 'Attack' }).getAttribute('aria-valuenow'))
  const before = attack()
  // put the goalkeeper up front: swap GK with a forward slot
  const gk = s.tactics.kapar.lineup[0]
  const fw = s.tactics.kapar.lineup[10]
  const pitch = within(screen.getByTestId('pitch'))
  await user.click(pitch.getByRole('button', { name: new RegExp(fullName(s, gk)) }))
  await user.click(pitch.getByRole('button', { name: new RegExp(fullName(s, fw)) }))
  expect(attack()).not.toBe(before)
})

test('the tactics screen says what a formation is good and bad against', async () => {
  const user = userEvent.setup()
  render(<Harness initial={newGame(4, 'kapar')} />)
  await user.selectOptions(screen.getByLabelText('Formation'), '3-5-2')
  expect(screen.getByText('Strong against 4-4-2, 4-2-3-1. Weak against 4-3-3, 4-5-1.')).toBeInTheDocument()
})
