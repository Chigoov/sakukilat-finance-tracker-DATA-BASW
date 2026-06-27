'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Home, BarChart2, Wallet, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useAuthStore,
  useCustomizationStore,
  useFeedbackStore,
  useTransactionActions,
  useTransactionData,
  useTransactionStatus,
} from '@/lib/store'
import { formatIDRCompact } from '@/lib/parser'
import { AuthGate } from '@/components/auth-gate'
import { SmartInput } from '@/components/smart-input'
import { TabBeranda } from '@/components/tab-beranda'
import { TabSaku } from '@/components/tab-saku'
import { TabProfil } from '@/components/tab-profil'

type Tab = 'beranda' | 'saku' | 'rekapan' | 'profil'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'beranda',  label: 'Beranda',  icon: Home },
  { id: 'saku',     label: 'Saku',     icon: Wallet },
  { id: 'rekapan',  label: 'Rekapan',  icon: BarChart2 },
  { id: 'profil',   label: 'Profil',   icon: User },
]

const TabRekapan = dynamic(
  () => import('@/components/tab-rekapan').then(mod => mod.TabRekapan),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[100dvh] px-5 pt-8 text-sm text-[var(--sk-text-muted)]">
        Memuat rekapan...
      </div>
    ),
  }
)

function triggerTinyHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(18)
  }
}

function AppShell() {
  const { user, authReady } = useAuthStore()
  const { toast, dismissToast } = useFeedbackStore()
  const { addTransaction } = useTransactionActions()
  const { isSubmitting } = useTransactionStatus()
  const { transactions } = useTransactionData()
  const { parserExtras } = useCustomizationStore()

  // Reconstruct natural-language hints from history so the chip suggestions
  // reflect what the user actually types, not the generic example list.
  const recentInputs = useMemo(() => {
    if (!transactions || transactions.length === 0) return [] as string[]
    return [...transactions]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 16)
      .filter(tx => tx.kind === 'transaction' || tx.kind === undefined)
      .map(tx => {
        const amt = formatIDRCompact(tx.amount).replace(/^Rp\s?/, '').toLowerCase()
        return `${tx.description} ${amt} ${tx.paymentMethod}`.trim()
      })
  }, [transactions])
  const [activeTab, setActiveTab] = useState<Tab>('beranda')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const switchTab = (tab: Tab) => {
    if (tab !== activeTab) triggerTinyHaptic()
    setActiveTab(tab)
  }

  // Loading splash
  if (!mounted || !authReady) {
    return (
      <div className="min-h-[100dvh] bg-[var(--sk-bg)] flex items-center justify-center">
        <div className="w-10 h-10 rounded-2xl bg-[var(--sk-cyan)] animate-pulse-soft flex items-center justify-center shadow-[0_0_30px_var(--sk-cyan-glow)]">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#090D16]" aria-hidden>
            <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
          </svg>
        </div>
      </div>
    )
  }

  // Auth gate
  if (!user) return <AuthGate />

  return (
    <div className="min-h-[100dvh] bg-[var(--sk-bg)] flex flex-col">
      {/* ── Tab content area ── */}
      <main className="flex-1 overflow-y-auto pb-[150px] md:pb-[112px] md:mb-0">
        {activeTab === 'beranda' && <TabBeranda />}
        {activeTab === 'saku'    && <TabSaku />}
        {activeTab === 'rekapan' && <TabRekapan />}
        {activeTab === 'profil'  && <TabProfil />}
      </main>

      <div className="fixed bottom-[56px] left-0 right-0 z-30 sk-glass border-t border-[var(--sk-border-2)] safe-bottom md:bottom-5 md:left-[96px] md:right-6 md:max-w-2xl md:border md:rounded-2xl md:shadow-2xl">
        <div className="px-4 py-2.5 md:px-4">
          <SmartInput
            onSubmit={addTransaction}
            isSubmitting={isSubmitting}
            parserExtras={parserExtras}
            recentInputs={recentInputs}
          />
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        aria-label="Navigasi utama"
        className="fixed bottom-0 left-0 right-0 z-40 sk-glass border-t border-[var(--sk-border-2)] safe-bottom md:hidden"
      >
        <div className="flex items-stretch h-[56px]">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tab.label}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150',
                  isActive ? 'text-[var(--sk-cyan)]' : 'text-[var(--sk-text-dim)]'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className={cn(
                  'text-[10px] font-medium transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-60'
                )}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── Desktop sidebar nav ── */}
      <nav
        aria-label="Navigasi utama"
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-[72px] flex-col items-center py-6 gap-2 sk-glass border-r border-[var(--sk-border-2)]"
      >
        {/* Logo */}
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--sk-cyan)] shadow-[0_0_20px_var(--sk-cyan-glow)] mb-4">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#0B0F19]" aria-hidden>
            <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
          </svg>
        </div>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              title={tab.label}
              className={cn(
                'w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150',
                isActive
                  ? 'bg-[var(--sk-cyan-dim)] text-[var(--sk-cyan)]'
                  : 'text-[var(--sk-text-dim)] hover:bg-[var(--sk-surface-2)] hover:text-[var(--sk-text-muted)]'
              )}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </nav>

      {/* ── Toast ── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-50 animate-slide-up top-4 left-4 right-4 md:top-auto md:bottom-[104px] md:left-auto md:right-6 md:w-auto"
        >
          <div
            className={cn(
              'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border backdrop-blur-xl',
              toast.type === 'success'
                ? 'bg-[var(--sk-green-dim)] border-[rgba(52,211,153,0.3)] text-[var(--sk-green)]'
                : 'bg-[var(--sk-red-dim)] border-[rgba(248,113,113,0.3)] text-[var(--sk-red)]'
            )}
          >
            <span className={cn(
              'inline-block w-2 h-2 rounded-full flex-shrink-0',
              toast.type === 'success' ? 'bg-[var(--sk-green)]' : 'bg-[var(--sk-red)]'
            )} />
            <span className="min-w-0 flex-1">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  dismissToast()
                  toast.action?.onClick()
                }}
                className="min-h-8 px-2.5 rounded-lg bg-white/10 text-[11px] font-bold uppercase tracking-wide"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Tutup notifikasi"
              className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-current opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <AppShell />
}
