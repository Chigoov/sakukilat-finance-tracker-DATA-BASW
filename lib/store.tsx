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
  type ReactNode,
} from 'react'
import {
  SEED_TRANSACTIONS,
  generateId,
  mockSupabaseMutate,
  type Transaction,
} from './mock-data'
import {
  parseTransaction,
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

const StoreContext = createContext<StoreValue | null>(null)

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

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `c-${Date.now()}`
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const [transactions, setTransactions] = useState<Transaction[]>(SEED_TRANSACTIONS)
  const [newTransactionId, setNewTransactionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [customPayments, setCustomPayments] = useState<CustomPayment[]>(SEED_PAYMENTS)
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(SEED_CATEGORIES)

  const [zenMode, setZenMode] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  // Simulate Supabase session restore on mount
  useEffect(() => {
    // SUPABASE: const { data } = await supabase.auth.getSession()
    const t = setTimeout(() => setAuthReady(true), 350)
    return () => clearTimeout(t)
  }, [])

  // Keep the display registry in sync with custom slang
  useEffect(() => {
    registerCustomCategories(customCategories)
    registerCustomPayments(customPayments)
  }, [customCategories, customPayments])

  const parserExtras = useMemo<ParserExtras>(
    () => ({
      payments: customPayments.map(p => ({ id: p.id, label: p.label, keywords: p.keywords })),
      categories: customCategories.map(c => ({ id: c.id, label: c.label, keywords: c.keywords })),
    }),
    [customPayments, customCategories]
  )

  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
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

  // ── Optimistic add ──────────────────────────────────────────────────────────
  const addTransaction = useCallback(
    async (input: string): Promise<boolean> => {
      const parsed = parseTransaction(input, parserExtras)
      if (!parsed || parsed.amount === 0) {
        showToast('Belum paham. Coba: "makan 25k gopay"', 'error')
        return false
      }

      setIsSubmitting(true)
      const optimisticId = generateId()
      const optimistic: Transaction = {
        id: optimisticId,
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
      setNewTransactionId(optimisticId)
      setIsSubmitting(false)

      // Haptic thumb feedback
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(40)
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
    [parserExtras, showToast]
  )

  const deleteTransaction = useCallback(
    (id: string) => {
      // SUPABASE: await supabase.from('transactions').delete().eq('id', id)
      setTransactions(prev => prev.filter(t => t.id !== id))
      showToast('Transaksi dihapus.', 'success')
    },
    [showToast]
  )

  // ── Custom slang management ──────────────────────────────────────────────────
  const addCustomPayment = useCallback(
    (label: string, keywords: string[]) => {
      const id = slugify(label)
      const kws = Array.from(new Set([id, ...keywords.map(k => k.toLowerCase().trim()).filter(Boolean)]))
      setCustomPayments(prev =>
        prev.some(p => p.id === id) ? prev : [...prev, { id, label: label.trim(), keywords: kws }]
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
      customPayments, customCategories, addCustomPayment, removeCustomPayment,
      addCustomCategory, removeCustomCategory, parserExtras,
      zenMode, toggleZen, toast, showToast,
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
