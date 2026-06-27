import type { TransactionType } from './parser'

export type TransactionKind = 'transaction' | 'transfer' | 'saving'
export type WalletType = 'cash' | 'bank' | 'ewallet' | 'card' | 'savings' | 'other'

export interface WalletAccount {
  id: string
  label: string
  type: WalletType
  balance: number
  keywords: string[]
  isBuiltIn?: boolean
}

export interface Transaction {
  id: string
  description: string
  amount: number
  type: TransactionType
  category: string // built-in or custom category id
  paymentMethod: string // built-in or custom payment id
  kind?: TransactionKind
  fromWalletId?: string
  toWalletId?: string
  date: Date
  isPending?: boolean // optimistic UI state
}

export const SEED_WALLETS: WalletAccount[] = [
  { id: 'tunai', label: 'Cash', type: 'cash', balance: 0, keywords: ['tunai', 'cash', 'kontan'], isBuiltIn: true },
  { id: 'bca', label: 'BCA', type: 'bank', balance: 0, keywords: ['bca', 'klikbca'], isBuiltIn: true },
  { id: 'seabank', label: 'SeaBank', type: 'bank', balance: 0, keywords: ['seabank', 'sea'], isBuiltIn: true },
  { id: 'gopay', label: 'GoPay', type: 'ewallet', balance: 0, keywords: ['gopay', 'gp'], isBuiltIn: true },
  { id: 'ovo', label: 'OVO', type: 'ewallet', balance: 0, keywords: ['ovo'], isBuiltIn: true },
  { id: 'dana', label: 'DANA', type: 'ewallet', balance: 0, keywords: ['dana'], isBuiltIn: true },
  { id: 'shopeepay', label: 'ShopeePay', type: 'ewallet', balance: 0, keywords: ['shopeepay', 'shopepay', 'shopee', 'spay'], isBuiltIn: true },
  { id: 'tabungan', label: 'Tabungan', type: 'savings', balance: 0, keywords: ['tabungan', 'simpan', 'simpanan'], isBuiltIn: true },
]

export function createSeedWallets(): WalletAccount[] {
  return SEED_WALLETS.map(wallet => ({ ...wallet, keywords: [...wallet.keywords] }))
}

function createMockTransactions(_now: number): Transaction[] {
  // Empty by design — SakuKilat ships clean. Users start with a blank slate
  // and grow their own history. Demo/seed data was removed in v2.1.
  return []
}

// ── Historical seed generator ────────────────────────────────────────────────
// Deterministically spreads realistic transactions across the past ~90 days so
// the calendar heatmap & trend charts have rich, believable data on first load.
function generateHistory(_now: number): Transaction[] {
  // Intentionally empty. Previous versions seeded ~90 days of pseudo-random
  // history to populate charts on first load; removed to give real users a
  // clean canvas.
  return []
}

export function createSeedTransactions(baseDate = new Date()): Transaction[] {
  const now = baseDate.getTime()
  return [
    ...createMockTransactions(now),
    ...generateHistory(now),
  ]
}

export const MOCK_TRANSACTIONS: Transaction[] = createMockTransactions(Date.now())
export const SEED_TRANSACTIONS: Transaction[] = createSeedTransactions()

export function generateId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)

  return `txn-${Date.now()}-${random}`
}

