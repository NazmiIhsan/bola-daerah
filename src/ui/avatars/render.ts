import { Avatar, Style } from '@dicebear/core'
import personas from '@dicebear/styles/personas.json'
import type { Face } from './face'

const style = new Style(personas)

// The style lightens faces and curly hair, so these are warmer and darker than they end up looking.
const SKIN = ['#e6b083', '#dba06c', '#cc8d52', '#b9743a', '#a0602b', '#85481c', '#6b3410']
const HAIR = ['#0b0706', '#1a0d08', '#26130b']
/** relative frequency */
const PLAYER_HAIR = { fade: 6, shortCombover: 6, buzzcut: 5, shortComboverChops: 3, curlyHighTop: 3, curly: 2, mohawk: 1, bald: 1 }
const REPORTER_HAIR = ['shortCombover', 'fade', 'bobCut', 'bobBangs', 'long', 'straightBun', 'balding'] as const

const build = (f: Face) => new Avatar(style, {
  seed: f.seed,
  skinColor: SKIN,
  hairColor: HAIR,
  facialHairColor: HAIR,
  clothingColor: f.shirt,
  hairVariant: f.reporter ? REPORTER_HAIR : PLAYER_HAIR,
  eyesVariant: f.reporter ? ['open', 'happy', 'glasses'] : ['open', 'happy'],
  mouthVariant: ['smile', 'smirk', 'bigSmile'],
  noseVariant: ['mediumRound', 'smallRound'],
  clothesVariant: f.reporter ? ['small', 'squared'] : ['rounded', 'small'],
  facialHairVariant: ['shadow', 'goatee', 'beardMustache', 'soulPatch'],
  facialHairProbability: f.beard,
})

export const faceOptions = (f: Face) => build(f).toJSON().options

const cache = new Map<string, string>()

export function faceUri(f: Face): string {
  const key = `${f.seed}|${f.shirt}|${f.beard}`
  let uri = cache.get(key)
  if (uri === undefined) cache.set(key, (uri = build(f).toDataUri()))
  return uri
}
