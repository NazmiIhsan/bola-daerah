import type { Lang } from './index'

/** Press questions. {opp} = opponent name. ≥3 variants each; params.v picks one. */
export const PRESS: Record<Lang, Record<string, string[]>> = {
  en: {
    'press.q.pre.rival': ['It’s derby week against {opp}. What does this game mean to you?', '{opp}’s fans say they’ll win easily. Your response?', 'How do you prepare the players for a derby against {opp}?'],
    'press.q.pre.streakWin': ['Three wins in a row. Can anyone stop you, starting with {opp}?', 'The team is flying. Are you worried about complacency against {opp}?', 'Is this the best form of your career?'],
    'press.q.pre.streakLoss': ['Three defeats in a row. Is your job under threat?', 'What has gone wrong, and can you fix it against {opp}?', 'The fans are losing patience. What do you say to them?'],
    'press.q.pre.generic': ['How do you see the game against {opp}?', 'What do you expect from {opp}?', 'Any message for the supporters before facing {opp}?'],
    'press.q.post.win': ['A big win over {opp}. How do you rate the performance?', 'Is this the result that turns your season?', 'What did you say to the players after beating {opp}?'],
    'press.q.post.loss': ['A tough defeat to {opp}. What went wrong?', 'Are the players good enough after that loss?', 'How do you lift the squad after losing to {opp}?'],
    'press.q.post.draw': ['A draw with {opp}. Two points dropped or one gained?', 'Were you happy with the point against {opp}?', 'What was missing today against {opp}?'],
    'press.q.post.derby': ['That was the derby against {opp}. Your thoughts?', 'What does this derby result mean for the district?', 'A message for the {opp} fans?'],
  },
  ms: {
    'press.q.pre.rival': ['Minggu derbi menentang {opp}. Apa makna perlawanan ini kepada anda?', 'Penyokong {opp} kata mereka akan menang mudah. Respons anda?', 'Bagaimana anda menyediakan pemain untuk derbi menentang {opp}?'],
    'press.q.pre.streakWin': ['Tiga kemenangan berturut-turut. Ada sesiapa boleh halang anda, bermula dengan {opp}?', 'Pasukan sedang terbang tinggi. Risau tentang sikap terlalu selesa menentang {opp}?', 'Adakah ini prestasi terbaik dalam kerjaya anda?'],
    'press.q.pre.streakLoss': ['Tiga kekalahan berturut-turut. Adakah jawatan anda terancam?', 'Apa yang tidak kena, dan bolehkah anda perbaikinya menentang {opp}?', 'Penyokong semakin hilang sabar. Apa pesanan anda kepada mereka?'],
    'press.q.pre.generic': ['Bagaimana anda melihat perlawanan menentang {opp}?', 'Apa yang anda jangkakan daripada {opp}?', 'Ada pesanan untuk penyokong sebelum menentang {opp}?'],
    'press.q.post.win': ['Kemenangan besar ke atas {opp}. Bagaimana anda menilai persembahan?', 'Adakah keputusan ini mengubah musim anda?', 'Apa yang anda katakan kepada pemain selepas menewaskan {opp}?'],
    'press.q.post.loss': ['Kekalahan perit kepada {opp}. Apa yang tidak kena?', 'Adakah pemain cukup bagus selepas kekalahan itu?', 'Bagaimana anda bangkitkan semangat skuad selepas tewas kepada {opp}?'],
    'press.q.post.draw': ['Seri dengan {opp}. Hilang dua mata atau dapat satu mata?', 'Puas hati dengan satu mata menentang {opp}?', 'Apa yang kurang hari ini menentang {opp}?'],
    'press.q.post.derby': ['Itulah derbi menentang {opp}. Pendapat anda?', 'Apa makna keputusan derbi ini untuk daerah?', 'Ada pesanan untuk penyokong {opp}?'],
  },
}
