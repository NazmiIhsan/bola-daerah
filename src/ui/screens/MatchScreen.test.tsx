import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MatchScreen } from './MatchScreen'
import { LanguageProvider } from '../LanguageContext'
import { newGame } from '../../game/generate'
import { simulateFull } from '../../game/match/sim'
import { matchOptions, matchTactics, userFixture } from '../../game/season'
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
  expect(m.minute).toBe(90 + m.added!)
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

describe('live match view', () => {
  const stateWithGoal = () => {
    // find a seed whose match has a goal, so the test never depends on luck
    for (let seed = 1; seed < 60; seed++) {
      const s = newGame(seed, 'kapar')
      const f = userFixture(s)!
      const m = simulateFull(f.homeId, f.awayId, matchTactics(s), s.players, (s.rngState ^ (s.matchday * 2654435761)) >>> 0, matchOptions(s, f))
      const first = m.events.find((e) => e.highlight)
      if (first?.type === 'goal' && first.minute < 45) return { s, goal: first }
    }
    throw new Error('no goal found')
  }

  test('a goal is shown only after its highlight, then celebrated, then play goes on', () => {
    vi.useFakeTimers()
    const { s, goal } = stateWithGoal()
    render(<LanguageProvider><MatchScreen state={s} onFinish={vi.fn()} /></LanguageProvider>)
    const scorer = s.players[goal.playerId!]
    act(() => { vi.advanceTimersByTime(400 * goal.minute + 50) })
    expect(screen.getByTestId('clock')).toHaveTextContent(`${goal.minute}'`)
    expect(screen.getByTestId('score')).toHaveTextContent('0 – 0')
    // Highlights last 3–6 s depending on how the chance came about.
    let waited = 0
    while (!screen.queryByTestId('goal') && waited < 7000) { act(() => { vi.advanceTimersByTime(100) }); waited += 100 }
    expect(waited).toBeGreaterThanOrEqual(3000)
    expect(screen.getByTestId('score')).toHaveTextContent(goal.side === 'home' ? '1 – 0' : '0 – 1')
    expect(screen.getByTestId('goal')).toHaveTextContent(scorer.lastName)
    expect(screen.getByTestId('clock')).toHaveTextContent(`${goal.minute}'`)
    act(() => { vi.advanceTimersByTime(2600) })
    expect(screen.queryByTestId('goal')).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(900) })
    expect(screen.getByTestId('clock')).not.toHaveTextContent(`${goal.minute}'`)
  })

  test('full-time shows scorers and statistics that match the score', () => {
    const { s } = stateWithGoal()
    render(<LanguageProvider><MatchScreen state={s} onFinish={vi.fn()} /></LanguageProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
    expect(screen.queryByTestId('goal')).not.toBeInTheDocument()
    const stats = within(screen.getByRole('region', { name: 'Match stats' }))
    for (const name of ['Possession', 'Shots', 'On target', 'Yellow cards', 'Red cards']) expect(stats.getByText(name)).toBeInTheDocument()
    const goals = screen.getByTestId('score').textContent!.match(/\d+/g)!.map(Number).reduce((a, b) => a + b)
    const minutes = [...document.querySelectorAll('.scorers')].flatMap((x) => x.textContent!.match(/\d+'/g) ?? [])
    expect(minutes).toHaveLength(goals)
  })
})

test('the changes panel shows how much energy everyone has left', () => {
  renderMatch()
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  const panel = screen.getByRole('region', { name: 'Team changes' })
  for (const label of ['Take off', 'Bring on']) {
    const options = [...(within(panel).getByLabelText(label) as HTMLSelectElement).options].filter((o) => o.value)
    expect(options.length).toBeGreaterThan(0)
    for (const o of options) expect(o.textContent).toMatch(/\d+%/)
  }
})

describe('touchline', () => {
  test('a shout can be made while the match runs, shows how long it lasts and blocks the others', () => {
    vi.useFakeTimers()
    renderMatch()
    act(() => { vi.advanceTimersByTime(400 * 3 + 50) })
    const bar = within(screen.getByRole('group', { name: 'Touchline' }))
    expect(bar.getByRole('button', { name: 'Waste time' })).toBeDisabled()
    fireEvent.click(bar.getByRole('button', { name: 'Encourage' }))
    expect(screen.getByTestId('shout-left')).toHaveTextContent('Encourage: 10 min left')
    expect(bar.getByRole('button', { name: 'Attack!' })).toBeDisabled()
    expect(screen.getByRole('log').textContent).toMatch(/rallies|encouragement/)
  })

  test('the momentum meter and the xG stat are shown', () => {
    renderMatch()
    expect(screen.getByRole('meter', { name: 'Momentum' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
    expect(within(screen.getByRole('region', { name: 'Match stats' })).getByText('Expected goals (xG)')).toBeInTheDocument()
    expect(screen.getByTestId('clock').textContent).toMatch(/^90\+\d'/)
    expect(screen.getByRole('log').textContent).toMatch(/added|stoppage|minutes/i)
  })

  test('the assistant stops the clock at a big moment, and a choice restarts it', () => {
    vi.useFakeTimers()
    renderMatch()
    let waited = 0
    while (!screen.queryByRole('dialog', { name: 'Assistant' }) && waited < 400 * 200) {
      const resume = screen.queryByRole('button', { name: 'Resume' })
      if (resume) fireEvent.click(resume)
      act(() => { vi.advanceTimersByTime(200) })
      waited += 200
    }
    const dialog = screen.getByRole('dialog', { name: 'Assistant' })
    const clock = screen.getByTestId('clock').textContent
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByTestId('clock').textContent).toBe(clock)
    fireEvent.click(within(dialog).getAllByRole('button')[0])
    expect(screen.queryByRole('dialog', { name: 'Assistant' })).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(8000) })
    expect(screen.getByTestId('clock').textContent).not.toBe(clock)
  })

  test('resuming dismisses the assistant without a change', () => {
    vi.useFakeTimers()
    renderMatch()
    let waited = 0
    while (!screen.queryByRole('dialog', { name: 'Assistant' }) && waited < 400 * 200) {
      const resume = screen.queryByRole('button', { name: 'Resume' })
      if (resume) fireEvent.click(resume)
      act(() => { vi.advanceTimersByTime(200) })
      waited += 200
    }
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.queryByRole('dialog', { name: 'Assistant' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  test('no assistant after skipping to the end', () => {
    renderMatch()
    fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
    expect(screen.queryByRole('dialog', { name: 'Assistant' })).not.toBeInTheDocument()
  })
})

test('the latest commentary is repeated under the pitch for phones', () => {
  renderMatch()
  fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
  const ticker = document.querySelector('.ticker')!
  expect(ticker.querySelectorAll('li')).toHaveLength(2)
  expect(ticker.textContent).toMatch(/Full-time|all over|final whistle/)
  expect(screen.getByRole('log', { name: 'Commentary' })).toHaveAttribute('tabindex', '0')
})

test('when time-wasting is not allowed, the reason is written out (phones have no tooltips)', () => {
  renderMatch()
  expect(screen.getByText('Waste time works only when you are winning.')).toBeInTheDocument()
})

test('a touchline ban disables the shouts and says why', () => {
  const s = newGame(8, 'kapar')
  render(<LanguageProvider><MatchScreen state={{ ...s, story: { ...s.story, ban: s.matchday } }} onFinish={vi.fn()} /></LanguageProvider>)
  const bar = within(screen.getByRole('group', { name: 'Touchline' }))
  for (const b of bar.getAllByRole('button')) expect(b).toBeDisabled()
  expect(screen.getByText('Touchline ban: no shouts this match.')).toBeInTheDocument()
})
