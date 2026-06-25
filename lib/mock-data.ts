import type { TransactionType } from './parser'

export interface Transaction {
  id: string
  description: string
  amount: number
  type: TransactionType
  category: string // built-in or custom category id
  paymentMethod: string // built-in or custom payment id
  date: Date
  isPending?: boolean // optimistic UI state
  syncStatus?: 'synced' | 'syncing' | 'error'
}

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-001',
    description: 'Makan soto ayam',
    amount: 25_000,
    type: 'expense',
    category: 'makanan',
    paymentMethod: 'gopay',
    date: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 jam lalu
    syncStatus: 'synced',
  },
  {
    id: 'txn-002',
    description: 'Gaji bulan Juni',
    amount: 8_500_000,
    type: 'income',
    category: 'gaji',
    paymentMethod: 'transfer',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000),
    syncStatus: 'synced',
  },
  {
    id: 'txn-003',
    description: 'Bensin motor',
    amount: 50_000,
    type: 'expense',
    category: 'transportasi',
    paymentMethod: 'tunai',
    date: new Date(Date.now() - 5 * 60 * 60 * 1000),
    syncStatus: 'synced',
  },
  {
    id: 'txn-004',
    description: 'Kopi kekinian',
    amount: 35_000,
    type: 'expense',
    category: 'makanan',
    paymentMethod: 'ovo',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Kemarin
    syncStatus: 'synced',
  },
  {
    id: 'txn-005',
    description: 'Bayar listrik',
    amount: 210_000,
    type: 'expense',
    category: 'tagihan',
    paymentMethod: 'bca',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    syncStatus: 'synced',
  },
  {
    id: 'txn-006',
    description: 'Netflix Premium',
    amount: 186_000,
    type: 'expense',
    category: 'hiburan',
    paymentMethod: 'kartu',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    syncStatus: 'synced',
  },
  {
    id: 'txn-007',
    description: 'Beli baju online',
    amount: 299_000,
    type: 'expense',
    category: 'belanja',
    paymentMethod: 'shopeepay',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    syncStatus: 'synced',
  },
  {
    id: 'txn-008',
    description: 'Freelance desain logo',
    amount: 1_500_000,
    type: 'income',
    category: 'gaji',
    paymentMethod: 'transfer',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    syncStatus: 'synced',
  },
  {
    id: 'txn-009',
    description: 'Ojek Grab',
    amount: 18_000,
    type: 'expense',
    category: 'transportasi',
    paymentMethod: 'dana',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    syncStatus: 'synced',
  },
  {
    id: 'txn-010',
    description: 'BPJS Kesehatan',
    amount: 100_000,
    type: 'expense',
    category: 'kesehatan',
    paymentMethod: 'bri',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    syncStatus: 'synced',
  },
]

// ── Historical seed generator ────────────────────────────────────────────────
// Deterministically spreads realistic transactions across the past ~90 days so
// the calendar heatmap & trend charts have rich, believable data on first load.
const HISTORY_TEMPLATES: Array<Omit<Transaction, 'id' | 'date'>> = [
  { description: 'Kopi pagi',        amount: 22_000,  type: 'expense', category: 'makanan',      paymentMethod: 'gopay',     syncStatus: 'synced' },
  { description: 'Makan siang',      amount: 35_000,  type: 'expense', category: 'makanan',      paymentMethod: 'ovo',       syncStatus: 'synced' },
  { description: 'Ojek ke kantor',   amount: 24_000,  type: 'expense', category: 'transportasi', paymentMethod: 'gopay',     syncStatus: 'synced' },
  { description: 'Bensin motor',     amount: 30_000,  type: 'expense', category: 'transportasi', paymentMethod: 'tunai',     syncStatus: 'synced' },
  { description: 'Belanja bulanan',  amount: 185_000, type: 'expense', category: 'belanja',      paymentMethod: 'bca',       syncStatus: 'synced' },
  { description: 'Pulsa & data',     amount: 50_000,  type: 'expense', category: 'tagihan',      paymentMethod: 'dana',      syncStatus: 'synced' },
  { description: 'Nonton bioskop',   amount: 60_000,  type: 'expense', category: 'hiburan',      paymentMethod: 'shopeepay', syncStatus: 'synced' },
  { description: 'Beli camilan',     amount: 28_000,  type: 'expense', category: 'makanan',      paymentMethod: 'qris',      syncStatus: 'synced' },
  { description: 'Vitamin',          amount: 75_000,  type: 'expense', category: 'kesehatan',    paymentMethod: 'bca',       syncStatus: 'synced' },
  { description: 'Parkir mall',      amount: 10_000,  type: 'expense', category: 'transportasi', paymentMethod: 'tunai',     syncStatus: 'synced' },
]

function generateHistory(): Transaction[] {
  const out: Transaction[] = []
  const now = Date.now()
  // pseudo-random but deterministic
  let seed = 1337
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  for (let daysAgo = 2; daysAgo <= 88; daysAgo++) {
    // 0–3 transactions per day, weighted toward 1–2
    const count = Math.floor(rand() * 3.2)
    for (let j = 0; j < count; j++) {
      const tpl = HISTORY_TEMPLATES[Math.floor(rand() * HISTORY_TEMPLATES.length)]
      const jitter = 0.8 + rand() * 0.5 // ±amount variation
      const d = new Date(now - daysAgo * 86_400_000)
      d.setHours(8 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0)
      out.push({
        ...tpl,
        id: `seed-${daysAgo}-${j}`,
        amount: Math.round((tpl.amount * jitter) / 500) * 500,
        date: d,
      })
    }
  }

  // a couple of monthly incomes for trend richness
  for (let m = 1; m <= 2; m++) {
    const d = new Date(now - m * 30 * 86_400_000)
    d.setHours(9, 0, 0, 0)
    out.push({
      id: `seed-income-${m}`,
      description: 'Gaji bulanan',
      amount: 8_500_000,
      type: 'income',
      category: 'gaji',
      paymentMethod: 'transfer',
      date: d,
      syncStatus: 'synced',
    })
  }

  return out
}

export const SEED_TRANSACTIONS: Transaction[] = [
  ...MOCK_TRANSACTIONS,
  ...generateHistory(),
]

export function generateId(): string {
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Simulate Supabase async mutation ────────────────────────────────────────
export async function mockSupabaseMutate(
  transaction: Transaction,
  shouldFail = false
): Promise<{ success: boolean; error?: string }> {
  // Simulate network delay
  await new Promise(res => setTimeout(res, 800 + Math.random() * 400))

  if (shouldFail) {
    return { success: false, error: 'Koneksi gagal, mencoba lagi...' }
  }

  return { success: true }
}
