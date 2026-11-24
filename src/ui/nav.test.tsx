import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

afterEach(() => localStorage.clear())
async function start() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'New game' }))
  await user.click(screen.getByRole('button', { name: /Kapar/ }))
  await user.click(screen.getByRole('button', { name: 'Start career' }))
  return user
}
const more = () => screen.getByRole('button', { name: /^More/ })

test('the phone bar keeps four screens and puts the rest behind More', async () => {
  const user = await start()
  const nav = screen.getByRole('navigation')
  const extra = nav.querySelector('.nav-extra') as HTMLElement
  expect([...nav.querySelectorAll(':scope > button .label')].map((x) => x.textContent)).toEqual(['Home', 'Squad', 'Tactics', 'Transfers', 'More'])
  expect([...extra.querySelectorAll('.label')].map((x) => x.textContent)).toEqual(['Inbox', 'Club', 'Youth', 'Table', 'Fixtures', 'Settings'])
  expect(more()).toHaveAttribute('aria-expanded', 'false')
  await user.click(more())
  expect(more()).toHaveAttribute('aria-expanded', 'true')
  await user.click(within(extra).getByRole('button', { name: /Table/ }))
  expect(more()).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('heading', { name: 'Division 1' })).toBeInTheDocument()
})

test('Escape closes More and returns focus to it', async () => {
  const user = await start()
  await user.click(more())
  await user.keyboard('{Escape}')
  expect(more()).toHaveAttribute('aria-expanded', 'false')
  expect(more()).toHaveFocus()
})

test('More counts what is waiting behind it', async () => {
  await start()
  const nav = screen.getByRole('navigation')
  const hidden = [...nav.querySelectorAll('.nav-extra .badge')].reduce((n, b) => n + Number(b.textContent), 0)
  expect(hidden).toBeGreaterThan(0)
  expect(Number(more().querySelector('.badge')!.textContent)).toBe(hidden)
})
