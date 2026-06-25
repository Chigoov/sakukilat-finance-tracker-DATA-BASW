import type { Category, PaymentMethod, TransactionType } from './parser'

export interface Transaction {
  id: string
  description: string
  amount: number
  type: TransactionType
  category: Category
  paymentMethod: PaymentMethod
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
