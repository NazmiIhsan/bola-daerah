import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { PreMatchScreen } from './PreMatchScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import { matchTactics, userFixture } from '../../game/season'
import { FORMATIONS, matchup } from '../../game/tactics'
import type { FormationId, GameState } from '../../game/types'

function Harness({ start }: { start: GameState }) {
  const [s, setS] = useState(start)
  return <PreMatchScreen state={s} onKickoff={() => {}} onTactics={(t) => setS({ ...s, tactics: { ...s.tactics, [s.userClubId]: t } })} />
}

test('head to head gives a shape verdict that follows the formation picked, and compares the three lines', () => {
  const state = newGame(8, 'kapar')
  const f = userFixture(state)!
  const them = f.homeId === 'kapar' ? f.awayId : f.homeId
  const theirs = matchTactics(state)[them].formation
  render(<LanguageProvider><Harness start={state} /></LanguageProvider>)
  const h2h = screen.getByRole('region', { name: 'Head to head' })
  expect(within(h2h).getAllByRole('img')).toHaveLength(3)
  expect(within(h2h).getByRole('img', { name: /^Attack: you \d+\.\d, them \d+\.\d$/ })).toBeInTheDocument()

  const pick = (want: 1 | -1 | 0) => (Object.keys(FORMATIONS) as FormationId[]).find((x) => matchup(x, theirs) === want)!
  const select = screen.getByRole('combobox')
  fireEvent.change(select, { target: { value: pick(1) } })
  expect(screen.getByTestId('shape-verdict')).toHaveTextContent(`Your ${pick(1)} troubles their ${theirs}.`)
  fireEvent.change(select, { target: { value: pick(-1) } })
  expect(screen.getByTestId('shape-verdict')).toHaveTextContent(`Their ${theirs} troubles your ${pick(-1)}. Try`)
  fireEvent.change(select, { target: { value: pick(0) } })
  expect(screen.getByTestId('shape-verdict')).toHaveTextContent('neither shape has the edge')
})
