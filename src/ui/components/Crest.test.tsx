import { render } from '@testing-library/react'
import { Crest, CRESTS } from './Crest'
import { CLUBS } from '../../game/data/clubs'
import { newGame } from '../../game/generate'

const clubs = Object.values(newGame(1, 'klang').clubs)
const html = (id: string) => render(<Crest club={clubs.find((c) => c.id === id)!} />).container.innerHTML

test('every club has its own crest design', () => {
  expect(Object.keys(CRESTS).sort()).toEqual(clubs.map((c) => c.id).sort())
  expect(new Set(Object.values(CRESTS).map((d) => d.charge)).size).toBe(clubs.length)
  expect(CLUBS).toBeDefined()
})

test('crests use the club colours, differ from each other and stay out of the accessibility tree', () => {
  const all = clubs.map((c) => html(c.id))
  expect(new Set(all).size).toBe(clubs.length)
  clubs.forEach((c, i) => { for (const colour of c.colors) expect(all[i]).toContain(colour) })
  expect(all.every((x) => x.includes('aria-hidden="true"'))).toBe(true)
})

test('an unknown club still draws', () => {
  expect(render(<Crest club={{ id: 'new', colors: ['#111111', '#ffffff'] }} />).container.querySelector('svg')).toBeInTheDocument()
})
