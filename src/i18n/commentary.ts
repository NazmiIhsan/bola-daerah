import type { ChanceKind, EventType, Shout } from '../game/match/types'
import type { Lang } from './index'

/** Placeholders: {player} {assist} {club} {subOn} {minute} {added} */
export const COMMENTARY: Record<Lang, Record<EventType, string[]>> = {
  en: {
    kickoff: ['And we are under way!', 'The referee blows the whistle. Kick-off!', 'Here we go!'],
    chance: ['{club} are building pressure.', '{player} looks for an opening.', 'A promising move from {club}.'],
    goal: ['GOAL! {player} scores for {club}!', '{player} finds the net! What a finish!', 'It\'s in! {player} makes no mistake!', 'GOAL for {club}! {player} buries it!'],
    save: ['Great save! {player} is denied.', 'The keeper keeps out {player}\'s shot!', '{player} forces a fine stop.'],
    miss: ['{player} drags it wide.', 'Over the bar from {player}!', 'So close! {player} misses the target.'],
    yellow: ['Yellow card for {player}.', '{player} goes into the book.', 'The referee shows {player} a yellow.'],
    red: ['RED CARD! {player} is sent off!', '{player} is off! {club} down to ten.', 'Straight off for {player}!'],
    injury: ['{player} is down injured.', 'Worrying moment, {player} can\'t continue.', '{player} signals to the bench, he\'s hurt.'],
    sub: ['{club} substitution: {subOn} on, {player} off.', '{subOn} replaces {player}.', 'Change for {club}: {subOn} comes on for {player}.'],
    push: ['{club} throw men forward!', '{club} have nothing to lose now. They attack!', 'The {club} bench waves everyone up the pitch.'],
    protect: ['{club} drop deep to protect the lead.', '{club} shut up shop.', 'The {club} bench calls for calm and cover.'],
    shout: ['The {club} bench is on its feet.'],
    stoppage: ['The fourth official shows {added} minutes of added time.', '{added} minutes added on.', 'There will be {added} minutes of stoppage time.'],
    halftime: ['Half-time.', 'The referee blows for half-time.', 'That\'s the end of the first half.'],
    fulltime: ['Full-time!', 'It\'s all over!', 'The final whistle goes.'],
  },
  ms: {
    kickoff: ['Perlawanan bermula!', 'Pengadil meniup wisel. Sepak mula!', 'Kita mulakan!'],
    chance: ['{club} terus menekan.', '{player} mencari ruang.', 'Gerakan berbahaya dari {club}.'],
    goal: ['GOL! {player} menjaringkan gol untuk {club}!', '{player} bolos jaring! Rembatan hebat!', 'Masuk! {player} tidak melepaskan peluang!', 'GOL untuk {club}! {player} menyudahkan dengan cemerlang!'],
    save: ['Selamatan hebat! {player} dinafikan.', 'Penjaga gol menepis rembatan {player}!', '{player} memaksa penjaga gol bekerja keras.'],
    miss: ['Rembatan {player} tersasar.', 'Melambung tinggi! {player} gagal.', 'Hampir! {player} tersasar dari sasaran.'],
    yellow: ['Kad kuning untuk {player}.', '{player} dilayangkan kad kuning.', 'Pengadil memberi amaran kepada {player}.'],
    red: ['KAD MERAH! {player} dibuang padang!', '{player} keluar! {club} tinggal sepuluh pemain.', 'Kad merah terus untuk {player}!'],
    injury: ['{player} terbaring kecederaan.', 'Detik membimbangkan, {player} tidak dapat meneruskan.', '{player} memberi isyarat ke bangku, dia cedera.'],
    sub: ['Pertukaran {club}: {subOn} masuk, {player} keluar.', '{subOn} menggantikan {player}.', '{club} membuat pertukaran: {subOn} untuk {player}.'],
    push: ['{club} menghantar semua pemain ke depan!', '{club} tiada apa untuk dirugikan. Mereka menyerang!', 'Bangku {club} mengarahkan pemain naik ke depan.'],
    protect: ['{club} berundur untuk mempertahankan kelebihan.', '{club} mengetatkan pertahanan.', 'Bangku {club} meminta pemain bertenang dan bertahan.'],
    shout: ['Bangku {club} sudah berdiri.'],
    stoppage: ['Pegawai keempat menunjukkan {added} minit masa tambahan.', '{added} minit masa kecederaan.', 'Masa tambahan {added} minit.'],
    halftime: ['Separuh masa.', 'Pengadil meniup wisel separuh masa.', 'Babak pertama berakhir.'],
    fulltime: ['Tamat perlawanan!', 'Semuanya sudah berakhir!', 'Wisel penamat dibunyikan.'],
  },
}

type ShotType = 'goal' | 'save' | 'miss'

/** Lines for how a chance came about. Falls back to the plain lines above. */
export const KIND_COMMENTARY: Record<Lang, Partial<Record<`${ShotType}.${ChanceKind}`, string[]>>> = {
  en: {
    'goal.cross': ['GOAL! A great ball in and {player} heads it home!', '{assist} whips it in, {player} rises highest. GOAL!'],
    'goal.through': ['GOAL! {assist} splits the defence and {player} slots it past the keeper!', '{player} runs onto {assist}\'s pass and scores!'],
    'goal.long': ['GOAL! {player} tries it from distance… WHAT A STRIKE!', 'From 25 yards! {player} smashes it in!'],
    'goal.counter': ['GOAL! A lightning counter-attack, finished by {player}!', '{club} break at speed and {player} scores!'],
    'goal.solo': ['GOAL! {player} beats two men and fires home!', 'Brilliant from {player}! He dances through and scores!'],
    'goal.corner': ['GOAL from the corner! {player} powers in a header!', 'Corner, chaos, GOAL! {player} gets the final touch!'],
    'goal.freekick': ['GOAL! {player} curls the free kick over the wall!', 'What a free kick from {player}! Top corner!'],
    'goal.penalty': ['PENALTY to {club}… {player} steps up… GOAL!', '{player} sends the keeper the wrong way. Penalty scored!'],
    'save.cross': ['{player} gets his head to the cross, but the keeper holds on.'],
    'save.through': ['{player} is clean through… SAVED by the keeper!', 'One-on-one! The keeper spreads himself and denies {player}!'],
    'save.long': ['{player} tries his luck from range, comfortable for the keeper.'],
    'save.counter': ['{club} break quickly, but the keeper stops {player}!'],
    'save.solo': ['{player} jinks into the box, but the shot is saved.'],
    'save.corner': ['Header from the corner by {player}, tipped over!'],
    'save.freekick': ['{player}\'s free kick is heading in… fingertip save!'],
    'save.penalty': ['PENALTY to {club}… {player} shoots… SAVED! The keeper guesses right!'],
    'miss.cross': ['{player} meets the cross but heads wide.'],
    'miss.through': ['{player} is through on goal… and drags it wide! What a chance!', 'He has to score! {player} misses the one-on-one!'],
    'miss.long': ['{player} shoots from distance, well over.'],
    'miss.counter': ['A great counter, but {player} blazes it over.'],
    'miss.solo': ['{player} weaves through, but the finish lets him down.'],
    'miss.corner': ['The corner falls to {player}, who can\'t keep it down.'],
    'miss.freekick': ['{player}\'s free kick clears the bar.', 'Free kick from {player}, into the wall.'],
    'miss.penalty': ['PENALTY to {club}… {player}… OFF THE POST! He\'s missed it!'],
  },
  ms: {
    'goal.cross': ['GOL! Hantaran lintang cantik dan {player} menanduk masuk!', '{assist} menghantar, {player} melompat paling tinggi. GOL!'],
    'goal.through': ['GOL! {assist} membelah pertahanan dan {player} menyudahkan dengan tenang!', '{player} mengejar hantaran {assist} dan menjaringkan gol!'],
    'goal.long': ['GOL! {player} mencuba dari jarak jauh… REMBATAN HEBAT!', 'Dari 25 meter! {player} merembat masuk!'],
    'goal.counter': ['GOL! Serangan balas pantas disudahkan oleh {player}!', '{club} menyerang balas dan {player} menjaringkan gol!'],
    'goal.solo': ['GOL! {player} melepasi dua pemain dan merembat masuk!', 'Hebat {player}! Dia menggelecek dan menjaringkan gol!'],
    'goal.corner': ['GOL dari sepakan sudut! {player} menanduk masuk!', 'Sepakan sudut, kelam-kabut, GOL! {player} menyudahkannya!'],
    'goal.freekick': ['GOL! {player} melengkungkan sepakan percuma melepasi tembok!', 'Sepakan percuma hebat dari {player}! Penjuru atas!'],
    'goal.penalty': ['PENALTI untuk {club}… {player} mengambilnya… GOL!', '{player} mengelirukan penjaga gol. Penalti berjaya!'],
    'save.cross': ['{player} menanduk hantaran itu, tetapi penjaga gol menangkapnya.'],
    'save.through': ['{player} sudah terlepas… DISELAMATKAN penjaga gol!', 'Satu lawan satu! Penjaga gol menafikan {player}!'],
    'save.long': ['{player} mencuba dari jauh, mudah untuk penjaga gol.'],
    'save.counter': ['{club} menyerang balas, tetapi penjaga gol menghalang {player}!'],
    'save.solo': ['{player} menggelecek masuk ke kotak, tetapi rembatannya ditepis.'],
    'save.corner': ['Tandukan {player} dari sepakan sudut ditepis keluar!'],
    'save.freekick': ['Sepakan percuma {player} hampir masuk… ditepis!'],
    'save.penalty': ['PENALTI untuk {club}… {player} menyepak… DISELAMATKAN! Penjaga gol meneka dengan betul!'],
    'miss.cross': ['{player} menanduk hantaran itu tetapi tersasar.'],
    'miss.through': ['{player} sudah terlepas… dan tersasar! Peluang terbaik!', 'Dia patut jaringkan! {player} gagal dalam situasi satu lawan satu!'],
    'miss.long': ['{player} merembat dari jauh, melambung tinggi.'],
    'miss.counter': ['Serangan balas yang baik, tetapi {player} melambungkan bola.'],
    'miss.solo': ['{player} menggelecek, tetapi penyudahnya mengecewakan.'],
    'miss.corner': ['Bola sepakan sudut jatuh kepada {player}, tetapi melambung.'],
    'miss.freekick': ['Sepakan percuma {player} melepasi palang.', 'Sepakan percuma {player} terkena tembok.'],
    'miss.penalty': ['PENALTI untuk {club}… {player}… KENA TIANG! Dia gagal!'],
  },
}

/** What the commentator says when a manager shouts. */
export const SHOUT_COMMENTARY: Record<Lang, Record<Shout, string[]>> = {
  en: {
    attack: ['The {club} manager waves the players forward!', '{club} are told to go for it!'],
    calm: ['The {club} manager calls for calm.', '"Settle down!" from the {club} bench.'],
    waste: ['{club} are taking their time over everything now.', 'The {club} players slow it all down.'],
    encourage: ['The {club} manager rallies the players. The crowd responds!', 'Big encouragement from the {club} touchline!'],
  },
  ms: {
    attack: ['Pengurus {club} mengarahkan pemain menyerang!', '{club} diarahkan untuk habis-habisan!'],
    calm: ['Pengurus {club} meminta pemain bertenang.', '"Bertenang!" dari bangku {club}.'],
    waste: ['{club} melengahkan masa sekarang.', 'Pemain {club} memperlahankan permainan.'],
    encourage: ['Pengurus {club} memberi semangat. Penyokong bersorak!', 'Dorongan besar dari tepi padang {club}!'],
  },
}
