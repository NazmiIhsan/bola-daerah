import { faceOptions, faceUri } from './render'
import { playerFace, reporterFace } from './face'
import { newGame } from '../../game/generate'
import { FREE_AGENT } from '../../game/types'

const s = newGame(7, 'klang')
const players = Object.values(s.players)
const adult = players.find((p) => p.age >= 24 && p.clubId === 'klang')!
const { clothingColor: _, ...noShirt } = faceOptions(playerFace(adult, s.clubs))
const svg = (uri: string) => decodeURIComponent(uri)

test('a player always has the same face and players differ', () => {
  expect(faceUri(playerFace(adult, s.clubs))).toBe(faceUri(playerFace(adult, s.clubs)))
  const squad = players.filter((p) => p.clubId === 'klang')
  expect(new Set(squad.map((p) => faceUri(playerFace(p, s.clubs)))).size).toBeGreaterThan(squad.length * 0.9)
})

test('a transfer changes the shirt and keeps the face', () => {
  const moved = { ...adult, clubId: 'petaling' }
  const { clothingColor, ...face } = faceOptions(playerFace(moved, s.clubs))
  expect(face).toEqual(noShirt)
  expect(clothingColor).toEqual([s.clubs.petaling.colors[0].toLowerCase()])
})

test('a face does not change as a player ages, apart from a beard', () => {
  const young = faceOptions(playerFace({ ...adult, age: 17 }, s.clubs))
  const old = faceOptions(playerFace({ ...adult, age: 35 }, s.clubs))
  for (const k of ['skinColor', 'hairColor', 'hairVariant', 'eyesVariant', 'noseVariant', 'mouthVariant'] as const) expect(young[k]).toEqual(old[k])
})

test('teenagers have no beards and some adults do', () => {
  const bearded = (age: number) => players.filter((p) => faceOptions(playerFace({ ...p, age }, s.clubs)).facialHairVariant !== undefined).length
  expect(bearded(17)).toBe(0)
  expect(bearded(25)).toBeGreaterThan(0)
  expect(bearded(25)).toBeLessThan(players.length / 2)
})

test('footballers never get hats, dummies, sunglasses or closed eyes', () => {
  for (const p of players) {
    const o = faceOptions(playerFace(p, s.clubs))
    expect(['beanie', 'cap', 'sideShave', 'long', 'extraLong', 'pigtails']).not.toContain(o.hairVariant)
    expect(['pacifier', 'frown', 'surprise']).not.toContain(o.mouthVariant)
    expect(['sunglasses', 'sleep', 'wink']).not.toContain(o.eyesVariant)
  }
})

test('no single hairstyle dominates', () => {
  const n: Record<string, number> = {}
  for (const p of players) { const h = String(faceOptions(playerFace(p, s.clubs)).hairVariant); n[h] = (n[h] ?? 0) + 1 }
  expect(Math.max(...Object.values(n)) / players.length).toBeLessThan(0.35)
  expect((n.bald + n.mohawk) / players.length).toBeLessThan(0.15)
})

test('every skin tone is used', () => {
  const tones = new Set(players.map((p) => String(faceOptions(playerFace(p, s.clubs)).skinColor)))
  expect(tones.size).toBeGreaterThanOrEqual(5)
})

test('free agents and unknown clubs still get a face', () => {
  for (const clubId of [FREE_AGENT, 'nowhere']) expect(faceUri(playerFace({ ...adult, clubId }, s.clubs))).toMatch(/^data:image\/svg\+xml/)
})

test('reporters get a steady face per conference', () => {
  expect(faceUri(reporterFace('f1'))).toBe(faceUri(reporterFace('f1')))
  expect(faceUri(reporterFace('f1'))).not.toBe(faceUri(reporterFace('f2')))
})

test('faces load nothing from the network', () => {
  expect(svg(faceUri(playerFace(adult, s.clubs)))).not.toMatch(/(href|src)="https?:|url\(["']?https?:/)
})
