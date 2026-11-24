import type { EventType } from '../game/match/types'
import type { Lang } from './index'

/** Placeholders: {player} {assist} {club} {subOn} {minute} */
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
    halftime: ['Separuh masa.', 'Pengadil meniup wisel separuh masa.', 'Babak pertama berakhir.'],
    fulltime: ['Tamat perlawanan!', 'Semuanya sudah berakhir!', 'Wisel penamat dibunyikan.'],
  },
}
