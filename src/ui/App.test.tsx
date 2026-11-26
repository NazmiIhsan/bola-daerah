import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

afterEach(() => {
  try { localStorage.clear() } catch { /* ignore */ }
})

async function skipPressIfAny(user: ReturnType<typeof userEvent.setup>) {
  const skip = screen.queryByRole('button', { name: 'Skip press conference' })
  if (skip) await user.click(skip)
}

/** Answer whatever pops up on the home screen: the name prompt, a breaking story or headlines. */
async function clearPopups(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 4; i++) {
    const name = screen.queryByLabelText('Your name')
    if (name) { await user.type(name, 'Nazmi'); await user.click(screen.getByRole('button', { name: 'Save' })); continue }
    const dialog = screen.queryByRole('dialog')
    if (!dialog || !dialog.querySelector('.choice, .headlines')) return
    await user.click(within(dialog).getAllByRole('button')[0])
  }
}

async function playWeek(user: ReturnType<typeof userEvent.setup>) {
  await clearPopups(user)
  await user.click(screen.getByRole('button', { name: 'Play match' }))
  await skipPressIfAny(user)
  await user.click(await screen.findByRole('button', { name: 'Kick off' }))
  await user.click(await screen.findByRole('button', { name: 'Skip to end' }))
  await user.click(screen.getByRole('button', { name: 'Finish' }))
  await user.click(await screen.findByRole('button', { name: 'Continue' }))
  await skipPressIfAny(user)
  await clearPopups(user)
}

async function startKapar() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'New game' }))
  await user.click(screen.getByRole('button', { name: /Kapar/ }))
  await user.click(screen.getByRole('button', { name: 'Start career' }))
  await clearPopups(user)
  return user
}

test('new game flow: pick Kapar and the dashboard shows Kapar', async () => {
  await startKapar()
  const header = await screen.findByRole('banner')
  expect(within(header).getByText('Kapar')).toBeInTheDocument()
  expect(screen.getByText('Next match')).toBeInTheDocument()
})

test('simulating a week advances the matchday and shows a result', async () => {
  const user = await startKapar()
  await playWeek(user)
  expect(await screen.findByText(/Matchday 2/)).toBeInTheDocument()
  expect(screen.queryByText('No matches played yet')).not.toBeInTheDocument()
})

test('language toggle switches visible text to Malay', async () => {
  const user = userEvent.setup()
  render(<App />)
  expect(await screen.findByRole('button', { name: 'New game' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'BM' }))
  expect(screen.getByRole('button', { name: 'Permainan baharu' })).toBeInTheDocument()
})

test('table screen lists both divisions', async () => {
  const user = await startKapar()
  await user.click(screen.getAllByRole('button', { name: 'Table' })[0])
  expect(screen.getByRole('heading', { name: 'Division 1' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Division 2' })).toBeInTheDocument()
})

test('with storage unavailable, a warning banner is shown and a new game still starts', async () => {
  const saved = globalThis.indexedDB
  // @ts-expect-error simulate blocked storage
  delete globalThis.indexedDB
  try {
    await startKapar()
    expect(await screen.findByText(/cannot be saved/)).toBeInTheDocument()
    expect(screen.getByText('Next match')).toBeInTheDocument()
  } finally {
    globalThis.indexedDB = saved
  }
})

test('importing an invalid file shows an error message and keeps the start screen', async () => {
  const user = userEvent.setup()
  render(<App />)
  const input = await screen.findByLabelText('Import save file')
  await user.upload(input, new File(['nonsense'], 'save.json', { type: 'application/json' }))
  expect(await screen.findByText('That file is not a valid Bola Daerah save.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New game' })).toBeInTheDocument()
})

test('game autosaves and can be loaded again from the start screen', async () => {
  const user = await startKapar()
  await playWeek(user)
  await screen.findByText(/Matchday 2/)
  await user.click(screen.getAllByRole('button', { name: 'Settings' })[0])
  await user.click(screen.getByRole('button', { name: 'Quit to main menu' }))
  await waitFor(() => expect(screen.getByText(/Kapar · 2027 · matchday 2/)).toBeInTheDocument())
})

test('importing when all 3 slots are full asks before overwriting, and cancelling keeps slot 1', async () => {
  const { saveGame, listSaves, exportSave } = await import('../save/storage')
  const { newGame } = await import('../game/generate')
  await saveGame(1, newGame(1, 'klang'))
  await saveGame(2, newGame(2, 'gombak'))
  await saveGame(3, newGame(3, 'sepang'))
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Klang · 2027/)
  const input = screen.getByLabelText('Import save file')
  await user.upload(input, new File([exportSave(newGame(9, 'jugra'))], 'save.json', { type: 'application/json' }))
  await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
  expect(screen.getByRole('button', { name: 'New game' })).toBeInTheDocument()
  const slot1 = (await listSaves()).find((m) => m.slot === 1)!
  expect(slot1.clubId).toBe('klang')
  confirmSpy.mockRestore()
})

test('importing a valid file into a free slot opens that game', async () => {
  const { exportSave, deleteSave } = await import('../save/storage')
  const { newGame } = await import('../game/generate')
  for (const n of [1, 2, 3]) await deleteSave(n)
  const user = userEvent.setup()
  render(<App />)
  const input = await screen.findByLabelText('Import save file')
  await user.upload(input, new File([exportSave(newGame(9, 'jugra'))], 'save.json', { type: 'application/json' }))
  const header = await screen.findByRole('banner')
  expect(within(header).getByText('Jugra')).toBeInTheDocument()
})

test('after playing a week the inbox badge shows unread news and the dashboard shows a headline', async () => {
  const user = await startKapar()
  await playWeek(user)
  await screen.findByText(/Matchday 2/)
  const inboxBtn = screen.getAllByRole('button', { name: /Inbox/ })[0]
  expect(inboxBtn.textContent).toMatch(/\d/)
  expect(screen.getByRole('region', { name: 'Latest news' })).toBeInTheDocument()
})

describe('press and sacking flow', () => {
  test('a pending pre-match press is shown first; answering opens the match', async () => {
    const { saveGame } = await import('../save/storage')
    const { newGame } = await import('../game/generate')
    const { userFixture } = await import('../game/season')
    const s = newGame(21, 'semenyih')
    await saveGame(3, { ...s, press: { kind: 'pre', fixtureId: userFixture(s)!.id, questions: [{ key: 'press.q.pre.generic', params: { oppId: 'jugra', v: 0 } }] } })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Slot 3/ }))
    expect(await screen.findByRole('heading', { name: /Press conference/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Confident/ }))
    await user.click(await screen.findByRole('button', { name: 'Kick off' }))
    expect(await screen.findByRole('button', { name: 'Skip to end' })).toBeInTheDocument()
  })

  test('a sacked manager sees offers; taking one shows the new club', async () => {
    const { saveGame } = await import('../save/storage')
    const { newGame } = await import('../game/generate')
    const s = newGame(22, 'klang')
    await saveGame(3, { ...s, career: { kind: 'sacked', offers: ['ijok', 'jugra'] } })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Slot 3/ }))
    await user.click(await screen.findByRole('button', { name: /Ijok/ }))
    const header = await screen.findByRole('banner')
    expect(within(header).getByText('Ijok')).toBeInTheDocument()
  })
})

test('transfers tab: signing a free agent puts them in the squad and the save', async () => {
  const { loadGame, listSaves } = await import('../save/storage')
  const user = await startKapar()
  await user.click(screen.getByRole('button', { name: /Transfers/ }))
  await user.click(screen.getByLabelText('Free agents only'))
  const row = screen.getAllByRole('button', { name: /^View / })[23]
  const player = row.getAttribute('aria-label')!.replace('View ', '')
  await user.click(row)
  await user.clear(screen.getByLabelText('Weekly wage (RM)'))
  await user.type(screen.getByLabelText('Weekly wage (RM)'), '1500')
  await user.click(screen.getByRole('button', { name: 'Offer contract' }))
  expect(screen.getByRole('status')).toHaveTextContent('has signed!')
  await user.click(screen.getByRole('button', { name: 'Close' }))
  await user.click(screen.getByRole('button', { name: /Squad/ }))
  expect(screen.getByText(player)).toBeInTheDocument()
  await waitFor(async () => {
    const meta = (await listSaves()).sort((a, b) => b.savedAt - a.savedAt)[0]
    const s = (await loadGame(meta.slot))!
    expect(Object.values(s.players).some((p) => p.clubId === 'kapar' && `${p.firstName} ${p.lastName}` === player)).toBe(true)
  })
})

test('youth tab: promoting a candidate moves them into the squad', async () => {
  const user = await startKapar()
  await user.click(screen.getByRole('button', { name: /Youth/ }))
  const first = screen.getAllByRole('button', { name: 'Promote' })
  await user.click(first[0])
  expect(screen.getByRole('status')).toHaveTextContent('joins the squad')
  expect(screen.getAllByRole('button', { name: 'Promote' })).toHaveLength(first.length - 1)
})

test('after the final whistle the result screen shows the score, your players and the table, before the press', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'New game' }))
  await user.click(screen.getAllByRole('button', { name: /Klang/ })[0])
  await user.click(screen.getByRole('button', { name: 'Start career' }))
  await clearPopups(user)
  await user.click(await screen.findByRole('button', { name: 'Play match' }))
  await skipPressIfAny(user)
  await user.click(await screen.findByRole('button', { name: 'Kick off' }))
  await user.click(await screen.findByRole('button', { name: 'Skip to end' }))
  const live = screen.getByTestId('score').textContent!.match(/\d+/g)!.join('-')
  await user.click(screen.getByRole('button', { name: 'Finish' }))
  const head = await screen.findByRole('region', { name: 'Full-time' })
  expect(screen.getByTestId('final-score').textContent!.match(/\d+/g)!.join('-')).toBe(live)
  expect(head.textContent).toMatch(/Victory!|A draw|Defeat/)
  expect(screen.getByTestId('table-move').textContent).toMatch(/table/)
  const ratings = screen.getByRole('region', { name: 'Your players' })
  expect(ratings.textContent).toMatch(/Player of the match/)
  expect(ratings.querySelectorAll('.ratings li').length).toBeGreaterThanOrEqual(11)
  expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus()
  expect(screen.queryByText('Press conference')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.queryByRole('region', { name: 'Full-time' })).not.toBeInTheDocument()
})

describe('stories', () => {
  test('a new manager is asked their name once, and it shows on the pre-match screen', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'New game' }))
    await user.click(screen.getByRole('button', { name: /Kapar/ }))
    await user.click(screen.getByRole('button', { name: 'Start career' }))
    const name = await screen.findByLabelText('Your name')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(name, 'Nazmi')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Play match' }))
    await skipPressIfAny(user)
    const mine = await screen.findByRole('region', { name: 'Kapar' })
    expect(mine.textContent).toMatch(/Manager: Nazmi \(you\)/)
    expect(mine.textContent).toMatch(/Key man/)
    expect(mine.querySelectorAll('.pm-xi li')).toHaveLength(11)
    const theirs = screen.getAllByRole('region').find((r) => r.classList.contains('pm-side') && r !== mine)!
    expect(theirs.textContent).toMatch(/Manager: \S+ \S+/)
  })

  test('changing style on the pre-match screen carries into the match', async () => {
    const user = await startKapar()
    await user.click(screen.getByRole('button', { name: 'Play match' }))
    await skipPressIfAny(user)
    await user.click(await screen.findByRole('button', { name: 'Defensive' }))
    await user.click(screen.getByRole('button', { name: 'Kick off' }))
    await user.click(await screen.findByRole('button', { name: 'Pause' }))
    const panel = screen.getByRole('region', { name: 'Team changes' })
    expect(within(panel).getByRole('button', { name: 'Defensive' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('a waiting story must be answered, and the answer lands in the inbox', async () => {
    const { saveGame } = await import('../save/storage')
    const { newGame } = await import('../game/generate')
    const { makeEvent } = await import('../game/story')
    const { createRng } = await import('../game/rng')
    const s = { ...newGame(23, 'klang'), managerName: 'Nazmi' }
    const e = makeEvent(s, 'tvInterview', createRng(1))!
    await saveGame(3, { ...s, story: { ...s.story, pending: e } })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Slot 3/ }))
    const dialog = await screen.findByRole('dialog', { name: 'TV interview on Selangor Sukan' })
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'TV interview on Selangor Sukan' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Combative/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Inbox/ })[0])
    expect(screen.getByText(/Ask me again in May/)).toBeInTheDocument()
  })

  test('breaking headlines pop up once, then stay in the inbox', async () => {
    const { saveGame } = await import('../save/storage')
    const { newGame } = await import('../game/generate')
    const s = { ...newGame(24, 'klang'), managerName: 'Nazmi' }
    const item = { id: 'b1', season: s.season, matchday: 1, kind: 'story' as const, key: 'news.story.viral', params: { clubId: 'klang', player: 'Ali Bakar' }, variant: 0, read: false, breaking: true }
    await saveGame(3, { ...s, inbox: [item] })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Slot 3/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Breaking' })
    expect(dialog.textContent).toMatch(/Ali Bakar goes viral!/)
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
