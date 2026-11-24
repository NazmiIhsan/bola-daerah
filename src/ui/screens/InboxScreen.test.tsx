import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { InboxScreen } from './InboxScreen'
import { LanguageProvider, LanguageToggle } from '../LanguageContext'
import { newGame } from '../../game/generate'
import { addNews, markAllRead, markRead, unreadCount } from '../../game/news'
import { createRng } from '../../game/rng'
import type { GameState } from '../../game/types'

afterEach(() => { try { localStorage.clear() } catch { /* ignore */ } })

function seeded(): GameState {
  let s = newGame(1, 'kapar')
  s = addNews({ ...s, matchday: 1 }, [{ kind: 'match', key: 'news.match.win', params: { clubId: 'kapar', oppId: 'jugra', score: '2–0' } }], createRng(1))
  s = addNews({ ...s, matchday: 2 }, [{ kind: 'fans', key: 'news.fans.uneasy', params: { clubId: 'kapar' } }], createRng(2))
  s = addNews({ ...s, matchday: 3 }, [{ kind: 'board', key: 'news.board.warning', params: { clubId: 'kapar' }, important: true }], createRng(3))
  return s
}

function Harness({ initial }: { initial: GameState }) {
  const [s, setS] = useState(initial)
  return (
    <LanguageProvider>
      <LanguageToggle />
      <span data-testid="unread">{unreadCount(s)}</span>
      <InboxScreen state={s} onRead={(id) => setS(markRead(s, id))} onReadAll={() => setS(markAllRead(s))} />
    </LanguageProvider>
  )
}

test('lists newest first; clicking marks read and lowers unread', () => {
  render(<Harness initial={seeded()} />)
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(3)
  expect(items[0]).toHaveTextContent(/Kapar/)
  expect(items[0].className).toMatch(/important/)
  expect(screen.getByTestId('unread')).toHaveTextContent('3')
  fireEvent.click(within(items[0]).getByRole('button'))
  expect(screen.getByTestId('unread')).toHaveTextContent('2')
})

test('filter chips narrow the list', () => {
  render(<Harness initial={seeded()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Fans' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
})

test('existing news switches language', () => {
  render(<Harness initial={seeded()} />)
  const enText = screen.getAllByRole('listitem')[2].textContent
  fireEvent.click(screen.getByRole('button', { name: 'BM' }))
  const msText = screen.getAllByRole('listitem')[2].textContent
  expect(msText).not.toBe(enText)
  expect(msText).not.toMatch(/\{\w+\}/)
  expect(msText).toMatch(/Kapar|Jugra/)
})

test('empty inbox shows a message', () => {
  render(<Harness initial={newGame(1, 'kapar')} />)
  expect(screen.getByText('No news yet.')).toBeInTheDocument()
})

test('Mark all read clears the count and then disappears', () => {
  render(<Harness initial={seeded()} />)
  expect(Number(screen.getByTestId('unread').textContent)).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
  expect(screen.getByTestId('unread')).toHaveTextContent('0')
  expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument()
})
