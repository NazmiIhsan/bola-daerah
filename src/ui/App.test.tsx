import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

afterEach(() => {
  try { localStorage.clear() } catch { /* ignore */ }
})

async function playWeek(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Play match' }))
  await user.click(await screen.findByRole('button', { name: 'Skip to end' }))
  await user.click(screen.getByRole('button', { name: 'Finish' }))
}

async function startKapar() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'New game' }))
  await user.click(screen.getByRole('button', { name: /Kapar/ }))
  await user.click(screen.getByRole('button', { name: 'Start career' }))
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
  // a post-match press conference may appear; skip it if so
  const skip = screen.queryByRole('button', { name: 'Skip press conference' })
  if (skip) await user.click(skip)
  const inboxBtn = screen.getAllByRole('button', { name: /Inbox/ })[0]
  expect(inboxBtn.textContent).toMatch(/\d/)
  expect(screen.getByRole('region', { name: 'Latest news' })).toBeInTheDocument()
})
