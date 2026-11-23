import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

afterEach(() => {
  try { localStorage.clear() } catch { /* ignore */ }
})

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
  await user.click(screen.getByRole('button', { name: /Play match|Simulate week/ }))
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
  await user.click(screen.getByRole('button', { name: /Play match|Simulate week/ }))
  await screen.findByText(/Matchday 2/)
  await user.click(screen.getAllByRole('button', { name: 'Settings' })[0])
  await user.click(screen.getByRole('button', { name: 'Quit to main menu' }))
  await waitFor(() => expect(screen.getByText(/Kapar · 2027 · matchday 2/)).toBeInTheDocument())
})
