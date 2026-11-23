import type { Club } from '../types'

type Seed = Omit<Club, 'kind' | 'shortName'> & { shortName?: string }

const district = (c: Seed): Club => ({ ...c, kind: 'district', shortName: c.shortName ?? c.name.slice(0, 3).toUpperCase() })
const mukim = (c: Seed): Club => ({ ...c, kind: 'mukim', shortName: c.shortName ?? c.name.slice(0, 3).toUpperCase() })

export const CLUBS: Club[] = [
  district({ id: 'petaling', name: 'Petaling', district: 'Petaling', colors: ['#c8102e', '#ffd100'], stadium: 'Stadium Bandaraya Petaling', capacity: 18000, reputation: 80 }),
  district({ id: 'klang', name: 'Klang', shortName: 'KLG', district: 'Klang', colors: ['#003da5', '#ffffff'], stadium: 'Stadium Pelabuhan Klang', capacity: 16000, reputation: 77 }),
  district({ id: 'hulu-langat', name: 'Hulu Langat', shortName: 'HLG', district: 'Hulu Langat', colors: ['#00843d', '#ffffff'], stadium: 'Stadium Bukit Langat', capacity: 14000, reputation: 72 }),
  district({ id: 'gombak', name: 'Gombak', shortName: 'GMB', district: 'Gombak', colors: ['#5b2c83', '#ffd100'], stadium: 'Stadium Lembah Gombak', capacity: 12000, reputation: 68 }),
  district({ id: 'sepang', name: 'Sepang', shortName: 'SPG', district: 'Sepang', colors: ['#111111', '#e4002b'], stadium: 'Stadium Tanjung Sepang', capacity: 9000, reputation: 64 }),
  district({ id: 'kuala-selangor', name: 'Kuala Selangor', shortName: 'KSL', district: 'Kuala Selangor', colors: ['#0077c8', '#ffd100'], stadium: 'Stadium Bukit Melawati', capacity: 8000, reputation: 61 }),
  district({ id: 'hulu-selangor', name: 'Hulu Selangor', shortName: 'HSL', district: 'Hulu Selangor', colors: ['#006341', '#ffd100'], stadium: 'Stadium Kuala Kubu', capacity: 7000, reputation: 59 }),
  district({ id: 'kuala-langat', name: 'Kuala Langat', shortName: 'KLT', district: 'Kuala Langat', colors: ['#f47b20', '#111111'], stadium: 'Stadium Bandar Jugra', capacity: 7000, reputation: 57 }),
  district({ id: 'sabak-bernam', name: 'Sabak Bernam', shortName: 'SBN', district: 'Sabak Bernam', colors: ['#7a1f2b', '#ffffff'], stadium: 'Stadium Sungai Besar', capacity: 6000, reputation: 55 }),

  mukim({ id: 'damansara', name: 'Damansara', shortName: 'DMS', district: 'Petaling', colors: ['#e4002b', '#111111'], stadium: 'Padang Damansara', capacity: 5000, reputation: 55 }),
  mukim({ id: 'kajang', name: 'Kajang', shortName: 'KJG', district: 'Hulu Langat', colors: ['#ffd100', '#00843d'], stadium: 'Padang Kajang', capacity: 5000, reputation: 52 }),
  mukim({ id: 'kapar', name: 'Kapar', shortName: 'KPR', district: 'Klang', colors: ['#00a3e0', '#111111'], stadium: 'Padang Kapar', capacity: 4000, reputation: 49 }),
  mukim({ id: 'bukit-raja', name: 'Bukit Raja', shortName: 'BKR', district: 'Petaling', colors: ['#8a1538', '#ffd100'], stadium: 'Padang Bukit Raja', capacity: 4000, reputation: 47 }),
  mukim({ id: 'rawang', name: 'Rawang', shortName: 'RWG', district: 'Gombak', colors: ['#ff6a13', '#ffffff'], stadium: 'Padang Rawang', capacity: 4000, reputation: 45 }),
  mukim({ id: 'semenyih', name: 'Semenyih', shortName: 'SMY', district: 'Hulu Langat', colors: ['#2e7d32', '#111111'], stadium: 'Padang Semenyih', capacity: 3500, reputation: 42 }),
  mukim({ id: 'dengkil', name: 'Dengkil', shortName: 'DKL', district: 'Sepang', colors: ['#1f2a44', '#ffd100'], stadium: 'Padang Dengkil', capacity: 3000, reputation: 39 }),
  mukim({ id: 'serendah', name: 'Serendah', shortName: 'SRD', district: 'Hulu Selangor', colors: ['#00a19a', '#ffffff'], stadium: 'Padang Serendah', capacity: 3000, reputation: 36 }),
  mukim({ id: 'ijok', name: 'Ijok', shortName: 'IJK', district: 'Kuala Selangor', colors: ['#6d2077', '#ffffff'], stadium: 'Padang Ijok', capacity: 2500, reputation: 33 }),
  mukim({ id: 'jugra', name: 'Jugra', shortName: 'JGR', district: 'Kuala Langat', colors: ['#a6192e', '#f1be48'], stadium: 'Padang Jugra', capacity: 2500, reputation: 30 }),
]

export const DIVISION_1_IDS = CLUBS.filter((c) => c.kind === 'district').map((c) => c.id)
export const DIVISION_2_IDS = CLUBS.filter((c) => c.kind === 'mukim').map((c) => c.id)
