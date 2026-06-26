'use client'

/**
 * SakuKilat — Mock Supabase Store
 * ---------------------------------
 * Simulates Supabase Auth + Database entirely in React state so the whole
 * app (all 4 tabs) is clickable & testable immediately, with zero backend.
 *
 * Swap points for the real Supabase client are marked with `// SUPABASE:`.
 */

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type Context,
} from 'react'
import {
  createSeedTransactions,
  createSeedWallets,
  generateId,
  mockSupabaseMutate,
  type Transaction,
  type TransactionKind,
  type WalletAccount,
  type WalletType,
} from './mock-data'
import {
  parseEntry,
  type ParserExtras,
  type CustomPayment,
  type CustomCategory,
} from './parser'
import {
  registerCustomCategories,
  registerCustomPayments,
} from '@/components/category-badge'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MockUser {
  name: string
  givenName: string
  email: string
  avatarUrl: string
}

export interface Toast {
  text: string
  type: 'success' | 'error'
}

interface StoreValue {
  // auth
  user: MockUser | null
  authReady: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => void

  // data
  transactions: Transaction[]
  addTransaction: (input: string) => Promise<boolean>
  deleteTransaction: (id: string) => void
  newTransactionId: string | null
  isSubmitting: boolean

  // wallets
  wallets: WalletAccount[]
  totalStored: number
  addWallet: (label: string, type: WalletType, balance: number, keywords: string[]) => void
  removeWallet: (id: string) => void
  transferMoney: (fromWalletId: string, toWalletId: string, amount: number, note?: string, kind?: TransactionKind) => boolean
  saveMoney: (fromWalletId: string, amount: number, toWalletId?: string) => boolean

  // budget
  monthlyBudget: number
  setMonthlyBudget: (amount: number) => void

  // custom slang
  customPayments: CustomPayment[]
  customCategories: CustomCategory[]
  addCustomPayment: (label: string, keywords: string[]) => void
  removeCustomPayment: (id: string) => void
  addCustomCategory: (label: string, keywords: string[]) => void
  removeCustomCategory: (id: string) => void
  parserExtras: ParserExtras

  // ergonomics
  zenMode: boolean
  toggleZen: () => void

  // feedback
  toast: Toast | null
  showToast: (text: string, type: 'success' | 'error') => void
}

interface AuthStore {
  user: MockUser | null
  authReady: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => void
}

interface TransactionDataStore {
  transactions: Transaction[]
}

interface TransactionActionsStore {
  addTransaction: (input: string) => Promise<boolean>
  deleteTransaction: (id: string) => void
}

interface TransactionStatusStore {
  newTransactionId: string | null
  isSubmitting: boolean
}

interface WalletStore {
  wallets: WalletAccount[]
  totalStored: number
  addWallet: (label: string, type: WalletType, balance: number, keywords: string[]) => void
  removeWallet: (id: string) => void
  transferMoney: (fromWalletId: string, toWalletId: string, amount: number, note?: string, kind?: TransactionKind) => boolean
  saveMoney: (fromWalletId: string, amount: number, toWalletId?: string) => boolean
}

interface BudgetStore {
  monthlyBudget: number
  setMonthlyBudget: (amount: number) => void
}

interface CustomizationStore {
  customPayments: CustomPayment[]
  customCategories: CustomCategory[]
  addCustomPayment: (label: string, keywords: string[]) => void
  removeCustomPayment: (id: string) => void
  addCustomCategory: (label: string, keywords: string[]) => void
  removeCustomCategory: (id: string) => void
  parserExtras: ParserExtras
}

interface PreferenceStore {
  zenMode: boolean
  toggleZen: () => void
}

interface FeedbackStore {
  toast: Toast | null
  showToast: (text: string, type: 'success' | 'error') => void
}

const StoreContext = createContext<StoreValue | null>(null)
const AuthContext = createContext<AuthStore | null>(null)
const TransactionDataContext = createContext<TransactionDataStore | null>(null)
const TransactionActionsContext = createContext<TransactionActionsStore | null>(null)
const TransactionStatusContext = createContext<TransactionStatusStore | null>(null)
const WalletContext = createContext<WalletStore | null>(null)
const BudgetContext = createContext<BudgetStore | null>(null)
const CustomizationContext = createContext<CustomizationStore | null>(null)
const PreferenceContext = createContext<PreferenceStore | null>(null)
const FeedbackContext = createContext<FeedbackStore | null>(null)

// ── Seeds ──────────────────────────────────────────────────────────────────────
const MOCK_GOOGLE_USER: MockUser = {
  name: 'Raka Pradnya',
  givenName: 'Raka',
  email: 'raka.pradnya@gmail.com',
  avatarUrl: '/avatar.png',
}

const SEED_PAYMENTS: CustomPayment[] = [
  { id: 'seabank', label: 'SeaBank', keywords: ['seabank', 'sea'] },
]
const SEED_CATEGORIES: CustomCategory[] = [
  { id: 'peliharaan', label: 'Peliharaan', keywords: ['kucing', 'anjing', 'catfood', 'vet', 'grooming'] },
]
const DEFAULT_MONTHLY_BUDGET = 1_500_000

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `c-${Date.now()}`
}

function normalizeKeywords(id: string, keywords: string[]): string[] {
  return Array.from(new Set([id, ...keywords.map(k => k.toLowerCase().trim()).filter(Boolean)]))
}

function createWallet(label: string, type: WalletType, balance: number, keywords: string[]): WalletAccount {
  const id = slugify(label)
  return {
    id,
    label: label.trim(),
    type,
    balance: Math.max(0, Math.round(balance)),
    keywords: normalizeKeywords(id, keywords),
  }
}

function ensureWallet(wallets: WalletAccount[], id: string): WalletAccount[] {
  if (wallets.some(wallet => wallet.id === id)) return wallets
  return [
    ...wallets,
    {
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      type: 'other',
      balance: 0,
      keywords: [id],
    },
  ]
}

function adjustWallets(wallets: WalletAccount[], deltas: Record<string, number>): WalletAccount[] {
  const withMissing = Object.keys(deltas).reduce((current, id) => ensureWallet(current, id), wallets)
  return withMissing.map(wallet => ({
    ...wallet,
    balance: wallet.balance + (deltas[wallet.id] ?? 0),
  }))
}

function transactionImpact(transaction: Transaction, direction: 1 | -1): Record<string, number> {
  const kind = transaction.kind ?? 'transaction'

  if ((kind === 'transfer' || kind === 'saving') && transaction.fromWalletId && transaction.toWalletId) {
    return {
      [transaction.fromWalletId]: -transaction.amount * direction,
      [transaction.toWalletId]: transaction.amount * direction,
    }
  }

  if (transaction.type === 'expense') {
    return { [transaction.paymentMethod]: -transaction.amount * direction }
  }

  return { [transaction.paymentMethod]: transaction.amount * direction }
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const [transactions, setTransactions] = useState<Transaction[]>(() => createSeedTransactions())
  const [wallets, setWallets] = useState<WalletAccount[]>(() => createSeedWallets())
  const [newTransactionId, setNewTransactionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [monthlyBudget, setMonthlyBudgetState] = useState(DEFAULT_MONTHLY_BUDGET)

  const [customPayments, setCustomPayments] = useState<CustomPayment[]>(SEED_PAYMENTS)
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(SEED_CATEGORIES)

  const [zenMode, setZenMode] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Simulate Supabase session restore on mount
  useEffect(() => {
    // SUPABASE: const { data } = await supabase.auth.getSession()
    const t = setTimeout(() => setAuthReady(true), 350)
    return () => clearTimeout(t)
  }, [])

  // Keep the display registry in sync with custom slang
  useEffect(() => {
    registerCustomCategories(customCategories)
    registerCustomPayments([
      ...wallets.map(wallet => ({ id: wallet.id, label: wallet.label })),
      ...customPayments,
    ])
  }, [customCategories, customPayments, wallets])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const parserExtras = useMemo<ParserExtras>(
    () => ({
      payments: [
        ...wallets.map(wallet => ({ id: wallet.id, label: wallet.label, keywords: wallet.keywords })),
        ...customPayments.map(p => ({ id: p.id, label: p.label, keywords: p.keywords })),
      ],
      categories: customCategories.map(c => ({ id: c.id, label: c.label, keywords: c.keywords })),
    }),
    [wallets, customPayments, customCategories]
  )

  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ text, type })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 3000)
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    // SUPABASE: await supabase.auth.signInWithOAuth({ provider: 'google' })
    await new Promise(res => setTimeout(res, 700))
    setUser(MOCK_GOOGLE_USER)
  }, [])

  const signOut = useCallback(() => {
    // SUPABASE: await supabase.auth.signOut()
    setUser(null)
  }, [])

  const totalStored = useMemo(
    () => wallets.reduce((sum, wallet) => sum + wallet.balance, 0),
    [wallets]
  )

  const setMonthlyBudget = useCallback((amount: number) => {
    setMonthlyBudgetState(Math.max(0, Math.round(amount)))
    showToast('Budget bulanan diperbarui.', 'success')
  }, [showToast])

  const addWallet = useCallback(
    (label: string, type: WalletType, balance: number, keywords: string[]) => {
      const wallet = createWallet(label, type, balance, keywords)
      setWallets(prev => prev.some(item => item.id === wallet.id) ? prev : [...prev, wallet])
      setCustomPayments(prev =>
        prev.some(payment => payment.id === wallet.id)
          ? prev
          : [...prev, { id: wallet.id, label: wallet.label, keywords: wallet.keywords }]
      )
      showToast(`Saku "${wallet.label}" ditambahkan.`, 'success')
    },
    [showToast]
  )

  const removeWallet = useCallback(
    (id: string) => {
      const wallet = wallets.find(item => item.id === id)
      if (!wallet) return
      if (wallet.isBuiltIn || wallet.balance !== 0) {
        showToast('Saku bawaan atau bersaldo tidak bisa dihapus.', 'error')
        return
      }
      setWallets(prev => prev.filter(item => item.id !== id))
      showToast(`Saku "${wallet.label}" dihapus.`, 'success')
    },
    [wallets, showToast]
  )

  const createMove = useCallback(
    (fromWalletId: string, toWalletId: string, amount: number, note = 'Pindah uang', kind: TransactionKind = 'transfer') => {
      const roundedAmount = Math.round(amount)
      if (!fromWalletId || !toWalletId || fromWalletId === toWalletId || roundedAmount <= 0) return null

      const id = generateId()
      const move: Transaction = {
        id,
        kind,
        description: note,
        amount: roundedAmount,
        type: 'expense',
        category: 'transfer',
        paymentMethod: fromWalletId,
        fromWalletId,
        toWalletId,
        date: new Date(),
        syncStatus: 'synced',
      }

      setWallets(prev => adjustWallets(prev, transactionImpact(move, 1)))
      setTransactions(prev => [move, ...prev])
      setNewTransactionId(id)
      setTimeout(() => setNewTransactionId(null), 700)
      return move
    },
    []
  )

  const transferMoney = useCallback(
    (fromWalletId: string, toWalletId: string, amount: number, note = 'Pindah uang', kind: TransactionKind = 'transfer') => {
      const move = createMove(fromWalletId, toWalletId, amount, note, kind)
      if (!move) {
        showToast('Pindah uang belum valid.', 'error')
        return false
      }
      showToast(kind === 'saving' ? 'Uang disimpan. Pelan-pelan jadi tebal.' : 'Uang dipindahkan.', 'success')
      return true
    },
    [createMove, showToast]
  )

  const saveMoney = useCallback(
    (fromWalletId: string, amount: number, toWalletId = 'tabungan') =>
      transferMoney(fromWalletId, toWalletId, amount, 'Simpan uang', 'saving'),
    [transferMoney]
  )

  // ── Optimistic add ──────────────────────────────────────────────────────────
  const addTransaction = useCallback(
    async (input: string): Promise<boolean> => {
      const parsed = parseEntry(input, parserExtras)
      if (!parsed || parsed.amount === 0) {
        showToast('Belum paham. Coba: "makan 25k gopay" atau "pindah 100k ovo ke gopay"', 'error')
        return false
      }

      if (parsed.kind === 'transfer' || parsed.kind === 'saving') {
        return transferMoney(
          parsed.fromWalletId,
          parsed.toWalletId,
          parsed.amount,
          parsed.description,
          parsed.kind
        )
      }

      setIsSubmitting(true)
      const optimisticId = generateId()
      const optimistic: Transaction = {
        id: optimisticId,
        kind: 'transaction',
        description: parsed.description,
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        paymentMethod: parsed.paymentMethod,
        date: new Date(),
        isPending: true,
        syncStatus: 'syncing',
      }

      // Step 1 — instant local update
      setTransactions(prev => [optimistic, ...prev])
      setWallets(prev => adjustWallets(prev, transactionImpact(optimistic, 1)))
      setNewTransactionId(optimisticId)
      setIsSubmitting(false)

      // Haptic thumb feedback
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(40)
      }
      setTimeout(() => setNewTransactionId(null), 700)

      // Step 2 — background "Supabase" mutation
      // SUPABASE: await supabase.from('transactions').insert(...)
      const result = await mockSupabaseMutate(optimistic)
      if (result.success) {
        setTransactions(prev =>
          prev.map(t => (t.id === optimisticId ? { ...t, isPending: false, syncStatus: 'synced' } : t))
        )
        showToast('Tercatat! Santai, kamu pegang kendali.', 'success')
      } else {
        setTransactions(prev =>
          prev.map(t => (t.id === optimisticId ? { ...t, isPending: false, syncStatus: 'error' } : t))
        )
        showToast('Sinkronisasi gagal, akan dicoba lagi.', 'error')
      }
      return true
    },
    [parserExtras, showToast, transferMoney]
  )

  const deleteTransaction = useCallback(
    (id: string) => {
      // SUPABASE: await supabase.from('transactions').delete().eq('id', id)
      const transaction = transactions.find(t => t.id === id)
      if (transaction) {
        setWallets(prev => adjustWallets(prev, transactionImpact(transaction, -1)))
      }
      setTransactions(prev => prev.filter(t => t.id !== id))
      showToast('Transaksi dihapus.', 'success')
    },
    [transactions, showToast]
  )

  // ── Custom slang management ──────────────────────────────────────────────────
  const addCustomPayment = useCallback(
    (label: string, keywords: string[]) => {
      const id = slugify(label)
      const kws = Array.from(new Set([id, ...keywords.map(k => k.toLowerCase().trim()).filter(Boolean)]))
      setCustomPayments(prev =>
        prev.some(p => p.id === id) ? prev : [...prev, { id, label: label.trim(), keywords: kws }]
      )
      setWallets(prev =>
        prev.some(wallet => wallet.id === id)
          ? prev
          : [...prev, { id, label: label.trim(), type: 'other', balance: 0, keywords: kws }]
      )
      showToast(`Metode "${label.trim()}" ditambahkan.`, 'success')
    },
    [showToast]
  )

  const removeCustomPayment = useCallback((id: string) => {
    setCustomPayments(prev => prev.filter(p => p.id !== id))
  }, [])

  const addCustomCategory = useCallback(
    (label: string, keywords: string[]) => {
      const id = slugify(label)
      const kws = Array.from(new Set(keywords.map(k => k.toLowerCase().trim()).filter(Boolean)))
      setCustomCategories(prev =>
        prev.some(c => c.id === id) ? prev : [...prev, { id, label: label.trim(), keywords: kws }]
      )
      showToast(`Kategori "${label.trim()}" ditambahkan.`, 'success')
    },
    [showToast]
  )

  const removeCustomCategory = useCallback((id: string) => {
    setCustomCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  const toggleZen = useCallback(() => setZenMode(z => !z), [])

  const authValue = useMemo<AuthStore>(
    () => ({ user, authReady, signInWithGoogle, signOut }),
    [user, authReady, signInWithGoogle, signOut]
  )

  const transactionDataValue = useMemo<TransactionDataStore>(
    () => ({ transactions }),
    [transactions]
  )

  const transactionActionsValue = useMemo<TransactionActionsStore>(
    () => ({ addTransaction, deleteTransaction }),
    [addTransaction, deleteTransaction]
  )

  const transactionStatusValue = useMemo<TransactionStatusStore>(
    () => ({ newTransactionId, isSubmitting }),
    [newTransactionId, isSubmitting]
  )

  const walletValue = useMemo<WalletStore>(
    () => ({
      wallets,
      totalStored,
      addWallet,
      removeWallet,
      transferMoney,
      saveMoney,
    }),
    [wallets, totalStored, addWallet, removeWallet, transferMoney, saveMoney]
  )

  const budgetValue = useMemo<BudgetStore>(
    () => ({ monthlyBudget, setMonthlyBudget }),
    [monthlyBudget, setMonthlyBudget]
  )

  const customizationValue = useMemo<CustomizationStore>(
    () => ({
      customPayments,
      customCategories,
      addCustomPayment,
      removeCustomPayment,
      addCustomCategory,
      removeCustomCategory,
      parserExtras,
    }),
    [
      customPayments,
      customCategories,
      addCustomPayment,
      removeCustomPayment,
      addCustomCategory,
      removeCustomCategory,
      parserExtras,
    ]
  )

  const preferenceValue = useMemo<PreferenceStore>(
    () => ({ zenMode, toggleZen }),
    [zenMode, toggleZen]
  )

  const feedbackValue = useMemo<FeedbackStore>(
    () => ({ toast, showToast }),
    [toast, showToast]
  )

  const value = useMemo<StoreValue>(
    () => ({
      user,
      authReady,
      signInWithGoogle,
      signOut,
      transactions,
      addTransaction,
      deleteTransaction,
      newTransactionId,
      isSubmitting,
      wallets,
      totalStored,
      addWallet,
      removeWallet,
      transferMoney,
      saveMoney,
      monthlyBudget,
      setMonthlyBudget,
      customPayments,
      customCategories,
      addCustomPayment,
      removeCustomPayment,
      addCustomCategory,
      removeCustomCategory,
      parserExtras,
      zenMode,
      toggleZen,
      toast,
      showToast,
    }),
    [
      user, authReady, signInWithGoogle, signOut,
      transactions, addTransaction, deleteTransaction, newTransactionId, isSubmitting,
      wallets, totalStored, addWallet, removeWallet, transferMoney, saveMoney,
      monthlyBudget, setMonthlyBudget,
      customPayments, customCategories, addCustomPayment, removeCustomPayment,
      addCustomCategory, removeCustomCategory, parserExtras,
      zenMode, toggleZen, toast, showToast,
    ]
  )

  return (
    <AuthContext.Provider value={authValue}>
      <TransactionDataContext.Provider value={transactionDataValue}>
        <TransactionActionsContext.Provider value={transactionActionsValue}>
          <TransactionStatusContext.Provider value={transactionStatusValue}>
            <WalletContext.Provider value={walletValue}>
              <BudgetContext.Provider value={budgetValue}>
                <CustomizationContext.Provider value={customizationValue}>
                  <PreferenceContext.Provider value={preferenceValue}>
                    <FeedbackContext.Provider value={feedbackValue}>
                      <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
                    </FeedbackContext.Provider>
                  </PreferenceContext.Provider>
                </CustomizationContext.Provider>
              </BudgetContext.Provider>
            </WalletContext.Provider>
          </TransactionStatusContext.Provider>
        </TransactionActionsContext.Provider>
      </TransactionDataContext.Provider>
    </AuthContext.Provider>
  )
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

function useRequiredContext<T>(context: Context<T | null>, name: string): T {
  const ctx = useContext(context)
  if (!ctx) throw new Error(`${name} must be used within StoreProvider`)
  return ctx
}

export function useAuthStore(): AuthStore {
  return useRequiredContext(AuthContext, 'useAuthStore')
}

export function useTransactionData(): TransactionDataStore {
  return useRequiredContext(TransactionDataContext, 'useTransactionData')
}

export function useTransactionActions(): TransactionActionsStore {
  return useRequiredContext(TransactionActionsContext, 'useTransactionActions')
}

export function useTransactionStatus(): TransactionStatusStore {
  return useRequiredContext(TransactionStatusContext, 'useTransactionStatus')
}

export function useWalletStore(): WalletStore {
  return useRequiredContext(WalletContext, 'useWalletStore')
}

export function useBudgetStore(): BudgetStore {
  return useRequiredContext(BudgetContext, 'useBudgetStore')
}

export function useCustomizationStore(): CustomizationStore {
  return useRequiredContext(CustomizationContext, 'useCustomizationStore')
}

export function usePreferenceStore(): PreferenceStore {
  return useRequiredContext(PreferenceContext, 'usePreferenceStore')
}

export function useFeedbackStore(): FeedbackStore {
  return useRequiredContext(FeedbackContext, 'useFeedbackStore')
}
