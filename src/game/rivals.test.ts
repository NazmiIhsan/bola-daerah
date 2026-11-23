import { isRivalry } from './rivals'
import { CLUBS } from './data/clubs'
const c = (id: string) => CLUBS.find((x) => x.id === id)!

test('same district or the Petaling–Klang derby are rivalries', () => {
  expect(isRivalry(c('klang'), c('kapar'))).toBe(true)
  expect(isRivalry(c('petaling'), c('damansara'))).toBe(true)
  expect(isRivalry(c('petaling'), c('klang'))).toBe(true)
  expect(isRivalry(c('klang'), c('petaling'))).toBe(true)
  expect(isRivalry(c('klang'), c('sepang'))).toBe(false)
})
