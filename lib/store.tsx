'use client'

/**
 * SakuKilat local-first store
 * ---------------------------------
 * Data stays local-first for snappy UX, then syncs to Firestore when the
 * user is logged in with Google.
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
  type Transaction,
  type TransactionKind,
  type WalletAccount,
  type WalletType,
} from './mock-data'
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  firebaseAuth,
  googleProvider,
  initFirebaseAnalytics,
  loadUserCloudSlice,
  saveUserCloudSlice,
} from './firebase'
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
  action?: {
    label: string
    onClick: () => void
  }
}

export interface TransactionUpdateInput {
  description: string
  amount: number
}

/** Pre-validated transaction payload used by the manual-entry escape hatch.
 *  All fields required — the form must collect them or default sensibly. */
export interface ManualTransactionInput {
  description: string
  amount: number
  type: 'expense' | 'income'
  category: string
  subcategory?: string
  paymentMethod: string
  date?: Date
}

export type ThemeMode = 'system' | 'dark' | 'light'

interface StoreValue {
  // auth
  user: MockUser | null
  authReady: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => void

  // data
  transactions: Transaction[]
  addTransaction: (input: string) => Promise<boolean>
  /** Manual escape hatch: bypass the natural-language parser entirely. */
  addManualTransaction: (input: ManualTransactionInput) => Promise<boolean>
  updateTransaction: (id: string, updates: TransactionUpdateInput) => void
  deleteTransaction: (id: string) => void
  newTransactionId: string | null
  isSubmitting: boolean

  // wallets
  wallets: WalletAccount[]
  totalStored: number
  addWallet: (label: string, type: WalletType, balance: number, keywords: string[]) => void
  updateWallet: (id: string, updates: { label: string; type: WalletType; balance: number; keywords: string[] }) => void
  removeWallet: (id: string) => void
  transferMoney: (fromWalletId: string, toWalletId: string, amount: number, note?: string, kind?: TransactionKind, date?: Date) => boolean
  saveMoney: (fromWalletId: string, amount: number, toWalletId?: string) => boolean

  // budget
  monthlyBudget: number
  setMonthlyBudget: (amount: number) => void

  // custom slang
  customPayments: CustomPayment[]
  customCategories: CustomCategory[]
  hiddenPaymentIds: string[]
  addCustomPayment: (label: string, keywords: string[]) => void
  updateCustomPayment: (id: string, updates: { label: string; keywords: string[] }) => void
  removeCustomPayment: (id: string) => void
  restoreHiddenPayment: (id: string) => void
  addCustomCategory: (label: string, keywords: string[], subcategories?: string[]) => void
  updateCustomCategory: (id: string, updates: { label: string; keywords: string[]; subcategories?: string[] }) => void
  removeCustomCategory: (id: string) => void
  parserExtras: ParserExtras

  // ergonomics
  zenMode: boolean
  themeMode: ThemeMode
  toggleZen: () => void
  setThemeMode: (mode: ThemeMode) => void
  updateProfile: (name: string) => void
  updateProfileAvatar: (avatarUrl: string | null) => void

  // feedback
  toast: Toast | null
  showToast: (text: string, type: 'success' | 'error', action?: Toast['action'], durationMs?: number) => void
  dismissToast: () => void
}

interface AuthStore {
  user: MockUser | null
  authReady: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => void
  updateProfile: (name: string) => void
  updateProfileAvatar: (avatarUrl: string | null) => void
}

interface TransactionDataStore {
  transactions: Transaction[]
}

interface TransactionActionsStore {
  addTransaction: (input: string) => Promise<boolean>
  /** Manual escape hatch: bypass the natural-language parser entirely. */
  addManualTransaction: (input: ManualTransactionInput) => Promise<boolean>
  updateTransaction: (id: string, updates: TransactionUpdateInput) => void
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
  updateWallet: (id: string, updates: { label: string; type: WalletType; balance: number; keywords: string[] }) => void
  removeWallet: (id: string) => void
  transferMoney: (fromWalletId: string, toWalletId: string, amount: number, note?: string, kind?: TransactionKind, date?: Date) => boolean
  saveMoney: (fromWalletId: string, amount: number, toWalletId?: string) => boolean
}

interface BudgetStore {
  monthlyBudget: number
  setMonthlyBudget: (amount: number) => void
}

interface CustomizationStore {
  customPayments: CustomPayment[]
  customCategories: CustomCategory[]
  hiddenPaymentIds: string[]
  addCustomPayment: (label: string, keywords: string[]) => void
  updateCustomPayment: (id: string, updates: { label: string; keywords: string[] }) => void
  removeCustomPayment: (id: string) => void
  restoreHiddenPayment: (id: string) => void
  addCustomCategory: (label: string, keywords: string[], subcategories?: string[]) => void
  updateCustomCategory: (id: string, updates: { label: string; keywords: string[]; subcategories?: string[] }) => void
  removeCustomCategory: (id: string) => void
  parserExtras: ParserExtras
}

interface PreferenceStore {
  zenMode: boolean
  themeMode: ThemeMode
  toggleZen: () => void
  setThemeMode: (mode: ThemeMode) => void
}

interface FeedbackStore {
  toast: Toast | null
  showToast: (text: string, type: 'success' | 'error', action?: Toast['action'], durationMs?: number) => void
  dismissToast: () => void
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
const SEED_PAYMENTS: CustomPayment[] = [
  { id: 'seabank', label: 'SeaBank', keywords: ['seabank', 'sea'] },
]
const SEED_CATEGORIES: CustomCategory[] = [
  { id: 'peliharaan', label: 'Peliharaan', keywords: ['kucing', 'anjing', 'catfood', 'vet', 'grooming'] },
]
const DEFAULT_MONTHLY_BUDGET = 0
export const STORAGE_KEY = 'sakukilat:v2:local-state'
const ONBOARDING_STORAGE_KEY_PREFIX = 'sakukilat:v2:onboarding-completed-v'
const KNOWN_STORAGE_KEYS = new Set([
  STORAGE_KEY,
  'sakukilat:v2:goals',
  'sakukilat:v2:celebrated-goals',
  'sakukilat:v2:recurring',
  'sakukilat:v2:celebrated-streak',
])
const DEMO_USER: MockUser = {
  name: 'Teman SakuKilat',
  givenName: 'Teman',
  email: 'demo@sakukilat.local',
  avatarUrl: '/avatar.png',
}

interface PersistedState {
  schemaVersion?: number
  transactions?: Array<Omit<Transaction, 'date'> & { date: string }>
  wallets?: WalletAccount[]
  monthlyBudget?: number
  customPayments?: CustomPayment[]
  customCategories?: CustomCategory[]
  hiddenPaymentIds?: string[]
  zenMode?: boolean
  themeMode?: ThemeMode
  profileName?: string | null
  profileAvatarUrl?: string | null
}

export const CURRENT_SCHEMA_VERSION = 3

// ── v2 → v3 demo-data purge helpers ─────────────────────────────────────────
// Old builds shipped with hard-coded seed transactions and pre-filled wallet
// balances. Any user / tester who opened the previous version still has that
// data in localStorage, so even after the clean-slate commit they keep seeing
// dummy entries. v3 migrates them away — surgically, never destructively.

/** Old createMockTransactions used ids `txn-001`..`txn-010`. Old
 *  generateHistory used `seed-{daysAgo}-{j}` and `seed-income-{m}`. Live
 *  user input goes through generateId() which uses `txn-{epochMs}-{random}`,
 *  so the patterns below cannot collide with real data. */
function isLegacySeedTransactionId(id: unknown): boolean {
  if (typeof id !== 'string') return false
  return /^txn-0\d{2}$/.test(id) || id.startsWith('seed-')
}

/** Exact balances shipped with the previous SEED_WALLETS. If every wallet in
 *  the persisted state matches verbatim, the user never touched the wallet
 *  manager → it's safe to zero them. The moment any value differs we leave
 *  ALL of them alone, because at that point real bookkeeping is at stake. */
const LEGACY_WALLET_BALANCES: Record<string, number> = {
  tunai:     650_000,
  bca:       4_850_000,
  seabank:   1_200_000,
  gopay:     240_000,
  ovo:       185_000,
  dana:      165_000,
  shopeepay: 90_000,
  tabungan:  2_500_000,
}

function reviveTransactions(items: PersistedState['transactions']): Transaction[] | null {
  if (!Array.isArray(items)) return null

  return items
    .map(item => ({
      ...item,
      date: new Date(item.date),
    }))
    .filter(item => Number.isFinite(item.date.getTime()))
}

function migratePersistedState(state: PersistedState): PersistedState {
  const prevVersion = state.schemaVersion ?? 1
  const next: PersistedState = { ...state }

  if (prevVersion < 3) {
    // 1. Strip leftover seed transactions. User-entered ones (timestamp ids)
    //    survive untouched — `isLegacySeedTransactionId` only matches the
    //    fixed pre-baked patterns.
    if (Array.isArray(next.transactions)) {
      next.transactions = next.transactions.filter(t => !isLegacySeedTransactionId(t.id))
    }

    // 2. Zero out wallet balances ONLY if every wallet still has the exact
    //    pre-baked seed amount. Any divergence → user has been bookkeeping
    //    here, leave the whole thing alone.
    if (Array.isArray(next.wallets) && next.wallets.length > 0) {
      const allPristine = next.wallets.every(w => {
        const expected = LEGACY_WALLET_BALANCES[w.id]
        // Wallets the user has added themselves won't appear in the legacy
        // table — those don't count as "untouched seed" so we treat them
        // as user data and bail out of the reset.
        return expected !== undefined && w.balance === expected
      })
      if (allPristine) {
        next.wallets = next.wallets.map(w => ({ ...w, balance: 0 }))
      }
    }

    // 3. Reset monthlyBudget only if it's still the old hard-coded default.
    if (next.monthlyBudget === 1_500_000) {
      next.monthlyBudget = 0
    }
  }

  return { ...next, schemaVersion: CURRENT_SCHEMA_VERSION }
}

function loadPersistedState(): PersistedState {
  if (typeof window === 'undefined') return {}

  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith('sakukilat:')) continue
      if (KNOWN_STORAGE_KEYS.has(key) || key.startsWith(ONBOARDING_STORAGE_KEY_PREFIX)) continue
      window.localStorage.removeItem(key)
    }

    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed || typeof parsed !== 'object') return {}
    return migratePersistedState(parsed)
  } catch (error) {
    console.warn('Gagal membaca auto-save SakuKilat:', error)
    return {}
  }
}

function persistState(state: PersistedState) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, ...state }))
  } catch (error) {
    console.warn('Gagal menyimpan auto-save SakuKilat:', error)
  }
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Teman'
}

function applyProfileSettings(user: MockUser, profileName: string | null, profileAvatarUrl: string | null): MockUser {
  const name = profileName?.trim()
  const avatarUrl = profileAvatarUrl?.trim()
  return {
    ...user,
    name: name || user.name,
    givenName: name ? firstName(name) : user.givenName,
    avatarUrl: avatarUrl || user.avatarUrl,
  }
}

function shouldUseLocalDemoAuth(): boolean {
  return true
}

function shouldUseRedirectAuth(): boolean {
  if (typeof window === 'undefined') return false

  const isSmallTouchDevice =
    window.innerWidth <= 768 ||
    window.matchMedia('(pointer: coarse)').matches
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

  return isSmallTouchDevice || isStandalone
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `c-${Date.now()}`
}

function normalizeKeywords(id: string, keywords: string[]): string[] {
  return Array.from(new Set([id, ...keywords.map(k => k.toLowerCase().trim()).filter(Boolean)]))
}

function mapFirebaseUser(firebaseUser: FirebaseUser): MockUser {
  const displayName = firebaseUser.displayName?.trim() || firebaseUser.email?.split('@')[0] || 'Teman SakuKilat'
  const givenName = displayName.split(/\s+/)[0] || 'Teman'

  return {
    name: displayName,
    givenName,
    email: firebaseUser.email ?? 'Email belum tersedia',
    avatarUrl: firebaseUser.photoURL ?? '/avatar.png',
  }
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

function walletDropsBelowZero(wallets: WalletAccount[], transaction: Transaction): boolean {
  const impacts = transactionImpact(transaction, 1)

  return Object.entries(impacts).some(([walletId, delta]) => {
    if (delta >= 0) return false
    const wallet = wallets.find(item => item.id === walletId)
    return (wallet?.balance ?? 0) + delta < 0
  })
}

function triggerHaptic(duration = 35) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(duration)
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: ReactNode }) {
  const persistedStateRef = useRef<PersistedState | null>(null)
  if (persistedStateRef.current === null) {
    persistedStateRef.current = loadPersistedState()
  }
  const persisted = persistedStateRef.current

  const [user, setUser] = useState<MockUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const [transactions, setTransactions] = useState<Transaction[]>(() => reviveTransactions(persisted.transactions) ?? createSeedTransactions())
  const [wallets, setWallets] = useState<WalletAccount[]>(() => Array.isArray(persisted.wallets) && persisted.wallets.length > 0 ? persisted.wallets : createSeedWallets())
  const [lastActiveWalletId, setLastActiveWalletId] = useState('tunai')
  const [newTransactionId, setNewTransactionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [monthlyBudget, setMonthlyBudgetState] = useState(() =>
    typeof persisted.monthlyBudget === 'number' ? persisted.monthlyBudget : DEFAULT_MONTHLY_BUDGET
  )

  const [customPayments, setCustomPayments] = useState<CustomPayment[]>(() =>
    Array.isArray(persisted.customPayments) ? persisted.customPayments : SEED_PAYMENTS
  )
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() =>
    Array.isArray(persisted.customCategories) ? persisted.customCategories : SEED_CATEGORIES
  )
  const [hiddenPaymentIds, setHiddenPaymentIds] = useState<string[]>(() =>
    Array.isArray(persisted.hiddenPaymentIds) ? persisted.hiddenPaymentIds : []
  )

  const [zenMode, setZenMode] = useState(() => Boolean(persisted.zenMode))
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => persisted.themeMode ?? 'dark')
  const [profileName, setProfileName] = useState<string | null>(() => persisted.profileName ?? null)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(() => persisted.profileAvatarUrl ?? null)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileNameRef = useRef(profileName)
  const profileAvatarRef = useRef(profileAvatarUrl)
  const redirectHandledRef = useRef(false)
  const [cloudHydrated, setCloudHydrated] = useState(false)

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)
    toastTimerRef.current = null
  }, [])

  const showToast = useCallback((text: string, type: 'success' | 'error', action?: Toast['action'], durationMs?: number) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ text, type, action })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, durationMs ?? (action ? 5500 : 3000))
  }, [])

  useEffect(() => {
    profileNameRef.current = profileName
  }, [profileName])

  useEffect(() => {
    profileAvatarRef.current = profileAvatarUrl
  }, [profileAvatarUrl])

  const applyPersistedSnapshot = useCallback((state: PersistedState) => {
    const next = migratePersistedState(state)
    const revivedTransactions = reviveTransactions(next.transactions)
    if (revivedTransactions) setTransactions(revivedTransactions)
    if (Array.isArray(next.wallets) && next.wallets.length > 0) setWallets(next.wallets)
    if (typeof next.monthlyBudget === 'number') setMonthlyBudgetState(next.monthlyBudget)
    if (Array.isArray(next.customPayments)) setCustomPayments(next.customPayments)
    if (Array.isArray(next.customCategories)) setCustomCategories(next.customCategories)
    if (Array.isArray(next.hiddenPaymentIds)) setHiddenPaymentIds(next.hiddenPaymentIds)
    if (typeof next.zenMode === 'boolean') setZenMode(next.zenMode)
    if (next.themeMode) setThemeModeState(next.themeMode)
    if ('profileName' in next) setProfileName(next.profileName ?? null)
    if ('profileAvatarUrl' in next) setProfileAvatarUrl(next.profileAvatarUrl ?? null)
  }, [])

  const persistedSnapshot = useMemo<PersistedState>(() => ({
    transactions: transactions.map(transaction => ({
      ...transaction,
      date: transaction.date.toISOString(),
    })),
    wallets,
    monthlyBudget,
    customPayments,
    customCategories,
    hiddenPaymentIds,
    zenMode,
    themeMode,
    profileName,
    profileAvatarUrl,
  }), [
    transactions,
    wallets,
    monthlyBudget,
    customPayments,
    customCategories,
    hiddenPaymentIds,
    zenMode,
    themeMode,
    profileName,
    profileAvatarUrl,
  ])

  useEffect(() => {
    let cancelled = false
    redirectHandledRef.current = false

    void initFirebaseAnalytics()
    void getRedirectResult(firebaseAuth)
      .then(async result => {
        redirectHandledRef.current = true

        if (!result?.user || cancelled) {
          if (!cancelled && !firebaseAuth.currentUser) {
            setUser(shouldUseLocalDemoAuth() ? applyProfileSettings(DEMO_USER, profileNameRef.current, profileAvatarRef.current) : null)
            setAuthReady(true)
          }
          return
        }

        setUser(applyProfileSettings(mapFirebaseUser(result.user), profileNameRef.current, profileAvatarRef.current))
        try {
          const remoteState = await loadUserCloudSlice<PersistedState>(result.user.uid, 'main')
          if (!cancelled && remoteState && typeof remoteState === 'object') {
            applyPersistedSnapshot(remoteState)
          }
        } catch (error) {
          console.error('SakuKilat redirect cloud restore failed:', error)
        } finally {
          if (!cancelled) {
            setCloudHydrated(true)
            setAuthReady(true)
          }
        }
        showToast('Login Google berhasil. Saku siap dipakai.', 'success')
      })
      .catch(error => {
        redirectHandledRef.current = true
        console.error('Firebase Google redirect sign-in failed:', error)
        if (cancelled) return
        setUser(shouldUseLocalDemoAuth() ? applyProfileSettings(DEMO_USER, profileNameRef.current, profileAvatarRef.current) : null)
        setAuthReady(true)
        showToast('Login Google gagal. Coba lagi sebentar.', 'error')
      })

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      currentUser => {
        void (async () => {
          if (!currentUser) {
            if (!redirectHandledRef.current) return
            setCloudHydrated(false)
            const nextUser = shouldUseLocalDemoAuth() ? DEMO_USER : null
            setUser(nextUser ? applyProfileSettings(nextUser, profileNameRef.current, profileAvatarRef.current) : null)
            setAuthReady(true)
            return
          }

          redirectHandledRef.current = true
          setUser(applyProfileSettings(mapFirebaseUser(currentUser), profileNameRef.current, profileAvatarRef.current))

          try {
            const remoteState = await loadUserCloudSlice<PersistedState>(currentUser.uid, 'main')
            if (cancelled) return
            if (remoteState && typeof remoteState === 'object') {
              applyPersistedSnapshot(remoteState)
            }
          } catch (error) {
            console.error('SakuKilat cloud restore failed:', error)
            if (!cancelled) {
              showToast('Data cloud belum bisa ditarik. Pakai data perangkat ini dulu.', 'error')
            }
          } finally {
            if (!cancelled) {
              setCloudHydrated(true)
              setAuthReady(true)
            }
          }
        })()
      },
      error => {
        console.error('Firebase auth session restore failed:', error)
        setUser(shouldUseLocalDemoAuth() ? applyProfileSettings(DEMO_USER, profileNameRef.current, profileAvatarRef.current) : null)
        setAuthReady(true)
      }
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [applyPersistedSnapshot, showToast])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const resolved = themeMode === 'system'
        ? media.matches ? 'dark' : 'light'
        : themeMode

      root.dataset.theme = resolved
      root.classList.toggle('dark', resolved === 'dark')
      root.classList.toggle('light', resolved === 'light')
      root.style.colorScheme = resolved
    }

    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [themeMode])

  useEffect(() => {
    persistState(persistedSnapshot)
  }, [persistedSnapshot])

  useEffect(() => {
    const currentUser = firebaseAuth.currentUser
    if (!cloudHydrated || !currentUser) return

    if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current)
    cloudSaveTimerRef.current = setTimeout(() => {
      void saveUserCloudSlice(currentUser.uid, 'main', persistedSnapshot).catch(error => {
        console.error('SakuKilat cloud save failed:', error)
      })
      cloudSaveTimerRef.current = null
    }, 700)

    return () => {
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current)
    }
  }, [cloudHydrated, persistedSnapshot])

  // Keep the display registry in sync with custom slang
  useEffect(() => {
    registerCustomCategories(customCategories)
    registerCustomPayments([
      ...wallets
        .filter(wallet => !hiddenPaymentIds.includes(wallet.id))
        .map(wallet => ({ id: wallet.id, label: wallet.label })),
      ...customPayments,
    ])
  }, [customCategories, customPayments, hiddenPaymentIds, wallets])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current)
    }
  }, [])

  const parserExtras = useMemo<ParserExtras>(
    () => ({
      payments: [
        ...wallets
          .filter(wallet => !hiddenPaymentIds.includes(wallet.id))
          .map(wallet => ({ id: wallet.id, label: wallet.label, keywords: wallet.keywords })),
        ...customPayments.map(p => ({ id: p.id, label: p.label, keywords: p.keywords })),
      ],
      categories: customCategories.map(c => ({ id: c.id, label: c.label, keywords: c.keywords, subcategories: c.subcategories })),
      lastActiveWalletId,
    }),
    [wallets, customPayments, customCategories, hiddenPaymentIds, lastActiveWalletId]
  )

  // ── Auth ──────────────────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    try {
      if (shouldUseRedirectAuth()) {
        await signInWithRedirect(firebaseAuth, googleProvider)
        return
      }

      const result = await signInWithPopup(firebaseAuth, googleProvider)
      setUser(applyProfileSettings(mapFirebaseUser(result.user), profileNameRef.current, profileAvatarRef.current))
      showToast('Login Google berhasil. Saku siap dipakai.', 'success')
    } catch (error) {
      console.error('Firebase Google sign-in failed:', error)
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : ''

      if (
        !code.includes('invalid-api-key') &&
        !code.includes('unauthorized-domain') &&
        !code.includes('operation-not-allowed')
      ) {
        await signInWithRedirect(firebaseAuth, googleProvider)
        return
      }

      showToast('Login Google gagal. Coba detail error di bawah tombol login.', 'error')
      throw error
    }
  }, [showToast])

  const updateProfile = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast('Nama profil tidak boleh kosong.', 'error')
      return
    }

    setProfileName(trimmed)
    setUser(prev => {
      if (!prev) return prev
      const baseUser =
        firebaseAuth.currentUser
          ? mapFirebaseUser(firebaseAuth.currentUser)
          : shouldUseLocalDemoAuth()
            ? DEMO_USER
            : prev
      return applyProfileSettings(baseUser, trimmed, profileAvatarRef.current)
    })
    showToast('Profil diperbarui.', 'success')
  }, [showToast])

  const updateProfileAvatar = useCallback((avatarUrl: string | null) => {
    const trimmed = avatarUrl?.trim() || null
    setProfileAvatarUrl(trimmed)
    setUser(prev => {
      if (!prev) return prev
      const baseUser =
        firebaseAuth.currentUser
          ? mapFirebaseUser(firebaseAuth.currentUser)
          : shouldUseLocalDemoAuth()
            ? DEMO_USER
            : prev
      return applyProfileSettings(baseUser, profileNameRef.current, trimmed)
    })
    showToast(trimmed ? 'Foto profil diperbarui.' : 'Foto profil dikembalikan ke bawaan.', 'success')
  }, [showToast])

  const signOut = useCallback(async () => {
    if (shouldUseLocalDemoAuth()) {
      setUser(applyProfileSettings(DEMO_USER, profileNameRef.current, profileAvatarRef.current))
      showToast('Mode demo lokal tetap aktif.', 'success')
      return
    }

    try {
      await firebaseSignOut(firebaseAuth)
      setUser(null)
      showToast('Kamu sudah keluar.', 'success')
    } catch (error) {
      console.error('Firebase sign-out failed:', error)
      showToast('Gagal keluar. Coba lagi.', 'error')
    }
  }, [showToast])

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

  const updateWallet = useCallback(
    (id: string, updates: { label: string; type: WalletType; balance: number; keywords: string[] }) => {
      const label = updates.label.trim()
      if (!label) {
        showToast('Nama saku tidak boleh kosong.', 'error')
        return
      }

      const normalizedKeywords = normalizeKeywords(id, updates.keywords)
      setWallets(prev =>
        prev.map(wallet =>
          wallet.id === id
            ? {
                ...wallet,
                label,
                type: updates.type,
                balance: Math.round(updates.balance),
                keywords: normalizedKeywords,
              }
            : wallet
        )
      )
      setCustomPayments(prev => {
        const payment = { id, label, keywords: normalizedKeywords }
        return prev.some(item => item.id === id)
          ? prev.map(item => item.id === id ? payment : item)
          : [...prev, payment]
      })
      showToast(`Saku "${label}" diperbarui.`, 'success')
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
    (fromWalletId: string, toWalletId: string, amount: number, note = 'Pindah uang', kind: TransactionKind = 'transfer', date = new Date()) => {
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
        date,
      }

      if (walletDropsBelowZero(wallets, move)) return null

      setWallets(prev => adjustWallets(prev, transactionImpact(move, 1)))
      setTransactions(prev => [move, ...prev])
      setLastActiveWalletId(fromWalletId)
      setNewTransactionId(id)
      triggerHaptic()
      setTimeout(() => setNewTransactionId(null), 700)
      return move
    },
    [wallets]
  )

  const transferMoney = useCallback(
    (fromWalletId: string, toWalletId: string, amount: number, note = 'Pindah uang', kind: TransactionKind = 'transfer', date?: Date) => {
      const move = createMove(fromWalletId, toWalletId, amount, note, kind, date)
      if (!move) {
        showToast('Pindah uang belum valid atau saldo saku asal tidak cukup.', 'error')
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

      if (parsed.warning) {
        showToast(parsed.warning, 'error')
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
        subcategory: parsed.subcategory,
        paymentMethod: parsed.paymentMethod,
        date: parsed.date ?? new Date(),
      }

      // Soft balance gate. We INTENTIONALLY no longer block submission when
      // a wallet would drop below zero — credit cards exist, debt happens,
      // and users routinely log expenses before income lands. We warn so
      // the user notices, then let the transaction through.
      if (optimistic.type === 'expense' && walletDropsBelowZero(wallets, optimistic)) {
        showToast(
          'Saldo saku ini jadi minus. Transaksi tetap tercatat — edit jika perlu.',
          'error'
        )
      }
      setTransactions(prev => [optimistic, ...prev])
      setWallets(prev => adjustWallets(prev, transactionImpact(optimistic, 1)))
      setLastActiveWalletId(optimistic.paymentMethod)
      setNewTransactionId(optimisticId)
      setIsSubmitting(false)

      // Haptic thumb feedback
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(40)
      }
      setTimeout(() => setNewTransactionId(null), 700)
      showToast(
        'Tercatat di perangkat ini.',
        'success',
        {
          label: 'Urungkan',
          onClick: () => {
            setTransactions(prev => prev.filter(t => t.id !== optimisticId))
            setWallets(prev => adjustWallets(prev, transactionImpact(optimistic, -1)))
            showToast('Transaksi diurungkan.', 'success')
          },
        },
        5500
      )
      return true
    },
    [parserExtras, showToast, transferMoney, wallets]
  )

  /** Manual entry — bypasses the parser entirely. Used by the modal form
   *  surfaced from SmartInput when the NL parser fails or the user wants
   *  precise wallet assignment. Same soft-balance semantics. */
  const addManualTransaction = useCallback(
    async (input: ManualTransactionInput): Promise<boolean> => {
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        showToast('Lengkapi nominal dulu.', 'error')
        return false
      }
      setIsSubmitting(true)
      const optimisticId = generateId()
      const description = input.description.trim() || (input.type === 'income' ? 'Pemasukan manual' : 'Pengeluaran manual')
      const optimistic: Transaction = {
        id: optimisticId,
        kind: 'transaction',
        description,
        amount: Math.round(input.amount),
        type: input.type,
        category: input.category,
        subcategory: input.subcategory,
        paymentMethod: input.paymentMethod,
        date: input.date ?? new Date(),
      }

      if (optimistic.type === 'expense' && walletDropsBelowZero(wallets, optimistic)) {
        showToast(
          'Saldo saku ini jadi minus. Transaksi tetap tercatat — edit jika perlu.',
          'error'
        )
      }

      setTransactions(prev => [optimistic, ...prev])
      setWallets(prev => adjustWallets(prev, transactionImpact(optimistic, 1)))
      setLastActiveWalletId(optimistic.paymentMethod)
      setNewTransactionId(optimisticId)
      setIsSubmitting(false)

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(28)
      }
      return true
    },
    [wallets, showToast]
  )

  const deleteTransaction = useCallback(
    (id: string) => {
      const transaction = transactions.find(t => t.id === id)
      if (!transaction) return

      setWallets(prev => adjustWallets(prev, transactionImpact(transaction, -1)))
      setTransactions(prev => prev.filter(t => t.id !== id))
      triggerHaptic(25)
      showToast(
        'Transaksi dihapus.',
        'success',
        {
          label: 'Urungkan',
          onClick: () => {
            setTransactions(prev => prev.some(t => t.id === transaction.id) ? prev : [transaction, ...prev])
            setWallets(prev => adjustWallets(prev, transactionImpact(transaction, 1)))
            showToast('Transaksi dikembalikan.', 'success')
          },
        },
        5500
      )
    },
    [transactions, showToast]
  )

  // ── Custom slang management ──────────────────────────────────────────────────
  const updateTransaction = useCallback(
    (id: string, updates: TransactionUpdateInput) => {
      const transaction = transactions.find(t => t.id === id)
      if (!transaction) return

      const description = updates.description.trim()
      const amount = Math.round(updates.amount)
      if (!description || !Number.isFinite(amount) || amount <= 0) {
        showToast('Deskripsi dan nominal harus valid.', 'error')
        return
      }

      const updated: Transaction = {
        ...transaction,
        description,
        amount,
        isPending: false,
      }
      const walletsWithoutCurrent = adjustWallets(wallets, transactionImpact(transaction, -1))
      if (walletDropsBelowZero(walletsWithoutCurrent, updated)) {
        showToast('Perubahan ini membuat saldo saku minus.', 'error')
        return
      }

      setTransactions(prev => prev.map(t => (t.id === id ? updated : t)))
      setWallets(prev =>
        adjustWallets(
          adjustWallets(prev, transactionImpact(transaction, -1)),
          transactionImpact(updated, 1)
        )
      )
      triggerHaptic(25)
      showToast('Transaksi diperbarui.', 'success')
    },
    [transactions, wallets, showToast]
  )

  const addCustomPayment = useCallback(
    (label: string, keywords: string[]) => {
      const id = slugify(label)
      const kws = Array.from(new Set([id, ...keywords.map(k => k.toLowerCase().trim()).filter(Boolean)]))
      setHiddenPaymentIds(prev => prev.filter(item => item !== id))
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

  const updateCustomPayment = useCallback(
    (id: string, updates: { label: string; keywords: string[] }) => {
      const label = updates.label.trim()
      if (!label) {
        showToast('Nama metode bayar tidak boleh kosong.', 'error')
        return
      }
      const kws = normalizeKeywords(id, updates.keywords)
      setHiddenPaymentIds(prev => prev.filter(item => item !== id))
      setCustomPayments(prev =>
        prev.some(payment => payment.id === id)
          ? prev.map(payment => payment.id === id ? { id, label, keywords: kws } : payment)
          : [...prev, { id, label, keywords: kws }]
      )
      setWallets(prev =>
        prev.map(wallet => wallet.id === id ? { ...wallet, label, keywords: kws } : wallet)
      )
      showToast(`Metode "${label}" diperbarui.`, 'success')
    },
    [showToast]
  )

  const removeCustomPayment = useCallback((id: string) => {
    const isBuiltin = [
      'gopay', 'ovo', 'dana', 'shopeepay',
      'bca', 'bni', 'bri', 'mandiri',
      'jago', 'qris', 'kartu', 'transfer', 'tunai',
    ].includes(id)

    setCustomPayments(prev => prev.filter(p => p.id !== id))
    if (isBuiltin) {
      setHiddenPaymentIds(prev => prev.includes(id) ? prev : [...prev, id])
      showToast('Metode bawaan disembunyikan.', 'success')
      return
    }
    showToast('Metode dihapus.', 'success')
  }, [showToast])

  const restoreHiddenPayment = useCallback((id: string) => {
    setHiddenPaymentIds(prev => prev.filter(item => item !== id))
    showToast('Metode bawaan dimunculkan lagi.', 'success')
  }, [showToast])

  const addCustomCategory = useCallback(
    (label: string, keywords: string[], subcategories: string[] = []) => {
      const id = slugify(label)
      const kws = Array.from(new Set(keywords.map(k => k.toLowerCase().trim()).filter(Boolean)))
      const subs = Array.from(new Set(subcategories.map(item => item.trim()).filter(Boolean)))
      setCustomCategories(prev =>
        prev.some(c => c.id === id) ? prev : [...prev, { id, label: label.trim(), keywords: kws, subcategories: subs }]
      )
      showToast(`Kategori "${label.trim()}" ditambahkan.`, 'success')
    },
    [showToast]
  )

  const updateCustomCategory = useCallback(
    (id: string, updates: { label: string; keywords: string[]; subcategories?: string[] }) => {
      const label = updates.label.trim()
      if (!label) return
      const kws = Array.from(new Set(updates.keywords.map(k => k.toLowerCase().trim()).filter(Boolean)))
      const subs = updates.subcategories?.map(item => item.trim()).filter(Boolean)
      setCustomCategories(prev =>
        prev.some(c => c.id === id)
          ? prev.map(c => (c.id === id ? { ...c, label, keywords: kws, subcategories: subs ?? c.subcategories ?? [] } : c))
          : [...prev, { id, label, keywords: kws, subcategories: subs ?? [] }]
      )
      showToast(`Kategori "${label}" diperbarui.`, 'success')
    },
    [showToast]
  )

  const removeCustomCategory = useCallback((id: string) => {
    setCustomCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  const toggleZen = useCallback(() => setZenMode(z => !z), [])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
    showToast(`Tema ${mode === 'system' ? 'mengikuti perangkat' : mode === 'dark' ? 'gelap' : 'terang'} diaktifkan.`, 'success')
  }, [showToast])

  const authValue = useMemo<AuthStore>(
    () => ({ user, authReady, signInWithGoogle, signOut, updateProfile, updateProfileAvatar }),
    [user, authReady, signInWithGoogle, signOut, updateProfile, updateProfileAvatar]
  )

  const transactionDataValue = useMemo<TransactionDataStore>(
    () => ({ transactions }),
    [transactions]
  )

  const transactionActionsValue = useMemo<TransactionActionsStore>(
    () => ({ addTransaction, addManualTransaction, updateTransaction, deleteTransaction }),
    [addTransaction, addManualTransaction, updateTransaction, deleteTransaction]
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
      updateWallet,
      removeWallet,
      transferMoney,
      saveMoney,
    }),
    [wallets, totalStored, addWallet, updateWallet, removeWallet, transferMoney, saveMoney]
  )

  const budgetValue = useMemo<BudgetStore>(
    () => ({ monthlyBudget, setMonthlyBudget }),
    [monthlyBudget, setMonthlyBudget]
  )

  const customizationValue = useMemo<CustomizationStore>(
    () => ({
      customPayments,
      customCategories,
      hiddenPaymentIds,
      addCustomPayment,
      updateCustomPayment,
      removeCustomPayment,
      restoreHiddenPayment,
      addCustomCategory,
      updateCustomCategory,
      removeCustomCategory,
      parserExtras,
    }),
    [
      customPayments,
      customCategories,
      hiddenPaymentIds,
      addCustomPayment,
      updateCustomPayment,
      removeCustomPayment,
      restoreHiddenPayment,
      addCustomCategory,
      updateCustomCategory,
      removeCustomCategory,
      parserExtras,
    ]
  )

  const preferenceValue = useMemo<PreferenceStore>(
    () => ({ zenMode, themeMode, toggleZen, setThemeMode }),
    [zenMode, themeMode, toggleZen, setThemeMode]
  )

  const feedbackValue = useMemo<FeedbackStore>(
    () => ({ toast, showToast, dismissToast }),
    [toast, showToast, dismissToast]
  )

  const value = useMemo<StoreValue>(
    () => ({
      user,
      authReady,
      signInWithGoogle,
      signOut,
      updateProfile,
      updateProfileAvatar,
      transactions,
      addTransaction,
      addManualTransaction,
      updateTransaction,
      deleteTransaction,
      newTransactionId,
      isSubmitting,
      wallets,
      totalStored,
      addWallet,
      updateWallet,
      removeWallet,
      transferMoney,
      saveMoney,
      monthlyBudget,
      setMonthlyBudget,
      customPayments,
      customCategories,
      hiddenPaymentIds,
      addCustomPayment,
      removeCustomPayment,
      updateCustomPayment,
      restoreHiddenPayment,
      addCustomCategory,
      updateCustomCategory,
      removeCustomCategory,
      parserExtras,
      zenMode,
      themeMode,
      toggleZen,
      setThemeMode,
      toast,
      showToast,
      dismissToast,
    }),
    [
      user, authReady, signInWithGoogle, signOut, updateProfile, updateProfileAvatar,
      transactions, addTransaction, addManualTransaction, updateTransaction, deleteTransaction, newTransactionId, isSubmitting,
      wallets, totalStored, addWallet, updateWallet, removeWallet, transferMoney, saveMoney,
      monthlyBudget, setMonthlyBudget,
      customPayments, customCategories, hiddenPaymentIds, addCustomPayment, updateCustomPayment, removeCustomPayment,
      restoreHiddenPayment, addCustomCategory, updateCustomCategory, removeCustomCategory, parserExtras,
      zenMode, themeMode, toggleZen, setThemeMode, toast, showToast, dismissToast,
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
