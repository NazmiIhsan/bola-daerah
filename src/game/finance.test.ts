import { applyWeek, attendance, formatRM, prizeMoney, TICKET_PRICE, wageBill, weeklySponsor } from './finance'
import { newGame } from './generate'
import { CLUBS } from './data/clubs'

const club = CLUBS.find((c) => c.id === 'klang')!

test('attendance rises with mood, stays within 15%..100% of capacity, higher in a rivalry', () => {
  const low = attendance(club, 10, 5, 9, false)
  const high = attendance(club, 90, 5, 9, false)
  expect(high).toBeGreaterThan(low)
  for (const mood of [0, 50, 100]) for (const pos of [1, 9]) for (const r of [true, false]) {
    const a = attendance(club, mood, pos, 9, r)
    expect(Number.isInteger(a)).toBe(true)
    expect(a).toBeLessThanOrEqual(club.capacity)
    expect(a).toBeGreaterThanOrEqual(Math.floor(club.capacity * 0.15))
  }
  expect(attendance(club, 50, 5, 9, true)).toBeGreaterThan(attendance(club, 50, 5, 9, false))
})

test('prize money tables', () => {
  expect(prizeMoney(1, 1)).toBe(500000)
  expect(prizeMoney(1, 9)).toBe(100000)
  expect(prizeMoney(2, 1)).toBe(200000)
  expect(prizeMoney(2, 10)).toBe(65000)
})

test('applyWeek books tickets, sponsor and wages and caps history at 40', () => {
  const s = newGame(1, 'klang')
  const f = applyWeek(s, { homeAttendance: 1000 })
  const w = f.history[0]
  expect(w.tickets).toBe(1000 * TICKET_PRICE[1])
  expect(w.sponsor).toBe(weeklySponsor(s.clubs.klang))
  expect(w.wages).toBe(wageBill(s, 'klang'))
  expect(w.attendance).toBe(1000)
  expect(f.balance).toBe(s.finance.balance + w.tickets + w.sponsor + w.prize - w.wages)
  expect(f.history).toHaveLength(1)
  let st = s
  for (let i = 0; i < 50; i++) st = { ...st, finance: applyWeek(st, {}) }
  expect(st.finance.history).toHaveLength(40)
  expect(applyWeek(s, {}).history[0].tickets).toBe(0)
})

test('formatRM', () => {
  expect(formatRM(1234567)).toBe('RM 1,234,567')
  expect(formatRM(-12000)).toBe('-RM 12,000')
  expect(formatRM(0)).toBe('RM 0')
})

test('balance target: a typical season moves balance by −40%..+40% for every club', () => {
  for (const c of CLUBS) {
    const s = newGame(3, c.id)
    const div = s.divisions[0].clubIds.includes(c.id) ? 1 : 2
    const size = div === 1 ? 9 : 10
    let st = s
    for (let week = 1; week <= 18; week++) {
      const home = week % 2 === 0
      st = { ...st, finance: applyWeek(st, home ? { homeAttendance: attendance(c, 60, Math.ceil(size / 2), size, false) } : {}) }
    }
    st = { ...st, finance: applyWeek(st, { prize: prizeMoney(div, Math.ceil(size / 2)) }) }
    const change = (st.finance.balance - s.finance.balance) / s.finance.balance
    expect({ club: c.id, ok: change >= -0.4 && change <= 0.4, change: Math.round(change * 100) }).toMatchObject({ ok: true })
  }
})

test('applyWeek moves the week’s transfer fees into the ledger without counting them twice', () => {
  const s = newGame(1, 'klang')
  const st = { ...s, finance: { ...s.finance, transferNet: -50_000 } }
  const f = applyWeek(st, {})
  const w = f.history[0]
  expect(w.transfers).toBe(-50_000)
  expect(f.transferNet).toBe(0)
  expect(f.balance).toBe(st.finance.balance + w.sponsor - w.wages)
})
