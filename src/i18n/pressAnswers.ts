import type { Answer } from '../game/types'
import type { Lang } from './index'

type Replies = Record<Answer, string>
const r = (confident: string, humble: string, combative: string): Replies => ({ confident, humble, combative })

/** Replies in the same order as the question variants in PRESS. {opp} = opponent name. */
export const PRESS_ANSWERS: Record<Lang, Record<string, Replies[]>> = {
  en: {
    'press.q.pre.rival': [
      r('“Everything. And we intend to win it.”', '“It’s special for the fans. We’ll try to make them proud.”', '“It means showing {opp} who this area belongs to.”'),
      r('“They can dream. I trust my players.”', '“They’re a good side. We’ll let the football decide.”', '“Talk is cheap. Let’s see if they’re still loud at full-time.”'),
      r('“They don’t need preparing. They’re ready to win.”', '“Calm heads and hard work, the same as every week.”', '“I put the {opp} quotes up on the dressing-room wall.”'),
    ],
    'press.q.pre.streakWin': [
      r('“Right now? I don’t see who.”', '“One bad day and the run is over. We stay grounded.”', '“Plenty said we’d flop. {opp} can be next to find out.”'),
      r('“No. This group only gets hungrier.”', '“A little, yes. That’s why we trained harder this week.”', '“Complacent? You clearly haven’t watched us train.”'),
      r('“It is, and the best is still to come.”', '“The credit belongs to the players, not to me.”', '“Funny, nobody asked me that when you were writing us off.”'),
    ],
    'press.q.pre.streakLoss': [
      r('“No. The board knows we’ll turn this around.”', '“That’s for the board to decide. I just keep working.”', '“Ask me about football, not about gossip.”'),
      r('“Small details. You’ll see a different team against {opp}.”', '“We’ve made mistakes, and I take responsibility.”', '“We’ve been unlucky, and some referees know it too.”'),
      r('“Stay with us. The wins are coming.”', '“I understand them. They deserve better from us.”', '“Real supporters stand up when it’s hard.”'),
    ],
    'press.q.pre.generic': [
      r('“If we play our game, we win.”', '“A difficult one. {opp} deserve our respect.”', '“They should be worried about us, not the other way round.”'),
      r('“Whatever they bring, we have an answer.”', '“A well-organised team. We’ve studied them closely.”', '“Long balls and complaining, the usual.”'),
      r('“Come and enjoy it. We’ll give you three points.”', '“Thank you for standing by us. We need your voices.”', '“Make it loud. Make {opp} hate every minute.”'),
    ],
    'press.q.post.win': [
      r('“Excellent. This is the level I expect from us.”', '“Pleasing, but there’s still plenty to improve.”', '“Good enough to silence a few people in this room.”'),
      r('“It turned a while ago. You’re just noticing now.”', '“It’s only three points. Let’s not get carried away.”', '“Write what you like. You’ll only change it next week.”'),
      r('“I told them: nobody can live with you like that.”', '“I said well done, then reminded them about training.”', '“That {opp} never wanted it as much as we did.”'),
    ],
    'press.q.post.loss': [
      r('“Very little. Play that again and we’d win it.”', '“They were better than us. It’s as simple as that.”', '“Have a look at the decisions, then ask me again.”'),
      r('“Absolutely. I wouldn’t swap a single one.”', '“They are. I have to find a better way to use them.”', '“Don’t you dare blame my players for this.”'),
      r('“They’re already lifted. They want the next match now.”', '“We talk, we rest, and we learn from it.”', '“{opp} celebrating like champions is all the motivation we need.”'),
    ],
    'press.q.post.draw': [
      r('“Two dropped. We’re good enough to win those.”', '“One gained. {opp} made it very hard.”', '“Two stolen, if you ask me.”'),
      r('“No. We come to win every match.”', '“Yes, a fair result for both teams.”', '“Happy? {opp} parked all eleven men in their box.”'),
      r('“Only the final touch. The goals will come.”', '“Sharpness, and that’s my job to fix.”', '“A referee with two good eyes.”'),
    ],
    'press.q.post.derby': [
      r('“We showed character, and we’ll be stronger for the next one.”', '“A proper derby. Both sets of players gave everything.”', '“Their tackles belonged in a different sport.”'),
      r('“It means this district can believe in us.”', '“I hope people enjoyed it and got home safely.”', '“It means we don’t bow to anyone around here.”'),
      r('“See you next time. We’ll be ready.”', '“They were loud and fair. Respect to them.”', '“Enjoy the trip home. It’s quieter than your stadium.”'),
    ],
  },
  ms: {
    'press.q.pre.rival': [
      r('“Segala-galanya. Dan kami mahu menang.”', '“Istimewa buat penyokong. Kami cuba buat mereka bangga.”', '“Masa untuk tunjuk kepada {opp} siapa tuan kawasan ini.”'),
      r('“Biar mereka bermimpi. Saya percaya pemain saya.”', '“Mereka pasukan bagus. Biar bola yang menentukan.”', '“Cakap memang mudah. Kita tengok bising lagi tak selepas tamat.”'),
      r('“Tak perlu disediakan. Mereka memang sedia untuk menang.”', '“Kepala sejuk dan kerja keras, macam setiap minggu.”', '“Saya tampal kata-kata {opp} di dinding bilik persalinan.”'),
    ],
    'press.q.pre.streakWin': [
      r('“Buat masa ini? Saya tak nampak siapa.”', '“Satu hari malang, habislah rentak ini. Kami kekal merendah diri.”', '“Ramai kata kami akan gagal. {opp} boleh jadi yang seterusnya tahu.”'),
      r('“Tidak. Mereka semakin lapar kemenangan.”', '“Sedikit, ya. Sebab itu kami berlatih lebih keras minggu ini.”', '“Terlalu selesa? Nampak sangat anda tak tengok kami berlatih.”'),
      r('“Ya, dan yang terbaik belum tiba.”', '“Pujian itu milik pemain, bukan saya.”', '“Pelik, tiada siapa tanya begitu masa anda semua memperlekeh kami.”'),
    ],
    'press.q.pre.streakLoss': [
      r('“Tidak. Lembaga tahu kami akan bangkit.”', '“Itu keputusan lembaga. Saya terus bekerja.”', '“Tanya saya tentang bola, bukan gosip.”'),
      r('“Perkara kecil. Anda akan lihat pasukan berbeza menentang {opp}.”', '“Kami buat kesilapan dan saya bertanggungjawab.”', '“Kami tidak bernasib baik, dan ada pengadil pun tahu.”'),
      r('“Terus bersama kami. Kemenangan akan tiba.”', '“Saya faham perasaan mereka. Mereka layak dapat lebih baik.”', '“Penyokong sejati bangun waktu susah.”'),
    ],
    'press.q.pre.generic': [
      r('“Kalau kami main cara kami, kami menang.”', '“Perlawanan sukar. {opp} wajar dihormati.”', '“Mereka yang patut risau, bukan kami.”'),
      r('“Apa pun mereka buat, kami ada jawapannya.”', '“Pasukan yang tersusun. Kami sudah kaji mereka.”', '“Hantaran jauh dan merungut, macam biasa.”'),
      r('“Datang dan nikmatilah. Tiga mata untuk anda.”', '“Terima kasih kerana setia. Kami perlukan sorakan anda.”', '“Buat bising. Biar {opp} benci setiap minit.”'),
    ],
    'press.q.post.win': [
      r('“Cemerlang. Inilah tahap yang saya mahukan.”', '“Memuaskan, tapi masih banyak perlu dibaiki.”', '“Cukup bagus untuk diamkan beberapa orang di bilik ini.”'),
      r('“Sudah lama berubah. Anda saja baru perasan.”', '“Cuma tiga mata. Jangan terlalu teruja.”', '“Tulislah apa saja. Minggu depan anda ubah juga.”'),
      r('“Saya kata: kalau main begini, tiada siapa mampu lawan.”', '“Saya ucap tahniah, kemudian ingatkan tentang latihan.”', '“Bahawa {opp} tidak mahukannya seperti kami.”'),
    ],
    'press.q.post.loss': [
      r('“Tak banyak. Kalau diulang, kami menang.”', '“Mereka lebih baik daripada kami. Itu saja.”', '“Tengok dulu keputusan pengadil, kemudian tanya saya lagi.”'),
      r('“Sudah tentu. Seorang pun saya tak mahu tukar.”', '“Ya. Saya yang perlu cari cara lebih baik gunakan mereka.”', '“Jangan sesekali salahkan pemain saya.”'),
      r('“Mereka sudah bersemangat. Mahu main lagi sekarang juga.”', '“Kami berbincang, berehat dan belajar.”', '“{opp} meraikan macam juara. Itu sudah cukup membakar semangat kami.”'),
    ],
    'press.q.post.draw': [
      r('“Hilang dua. Kami cukup bagus untuk menang.”', '“Dapat satu. {opp} menyukarkan kami.”', '“Dua mata dirompak, kalau tanya saya.”'),
      r('“Tidak. Kami datang untuk menang setiap perlawanan.”', '“Ya, keputusan adil untuk kedua-dua pasukan.”', '“Puas hati? {opp} letak sebelas orang dalam kotak penalti.”'),
      r('“Cuma sentuhan akhir. Gol akan datang.”', '“Ketajaman, dan itu tugas saya untuk baiki.”', '“Pengadil yang celik kedua-dua mata.”'),
    ],
    'press.q.post.derby': [
      r('“Kami tunjuk semangat dan akan lebih kuat nanti.”', '“Derbi sebenar. Semua pemain beri segalanya.”', '“Terjahan mereka macam sukan lain.”'),
      r('“Maknanya daerah ini boleh percaya pada kami.”', '“Harap semua terhibur dan selamat sampai ke rumah.”', '“Maknanya kami tak tunduk kepada sesiapa di sini.”'),
      r('“Jumpa lagi. Kami pasti bersedia.”', '“Mereka lantang dan adil. Hormat saya kepada mereka.”', '“Selamat pulang. Lebih sunyi daripada stadium anda.”'),
    ],
  },
}
