'use client'

import { useState } from 'react'
import { Home, BarChart2, Wallet, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useAuthStore,
  useCustomizationStore,
  useFeedbackStore,
  useTransactionActions,
  useTransactionStatus,
} from '@/lib/store'
import { AuthGate } from '@/components/auth-gate'
import { SmartInput } from '@/components/smart-input'
import { TabBeranda } from '@/components/tab-beranda'
import { TabRekapan } from '@/components/tab-rekapan'
import { TabSaku } from '@/components/tab-saku'
import { TabProfil } from '@/components/tab-profil'

type Tab = 'beranda' | 'saku' | 'rekapan' | 'profil'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'beranda',  label: 'Beranda',  icon: Home },
  { id: 'saku',     label: 'Saku',     icon: Wallet },
  { id: 'rekapan',  label: 'Rekapan',  icon: BarChart2 },
  { id: 'profil',   label: 'Profil',   icon: User },
]

function AppShell() {
  const { user, authReady } = useAuthStore()
  const { toast } = useFeedbackStore()
  const { addTransaction } = useTransactionActions()
  const { isSubmitting } = useTransactionStatus()
  const { parserExtras } = useCustomizationStore()
  const [activeTab, setActiveTab] = useState<Tab>('beranda')

  // Loading splash
  if (!authReady) {
    return (
      <div className="min-h-[100dvh] bg-[#090D16] flex items-center justify-center">
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
      <main className="flex-1 overflow-y-auto pb-[176px] md:pb-[124px] md:mb-0">
        {activeTab === 'beranda' && <TabBeranda />}
        {activeTab === 'saku'    && <TabSaku />}
        {activeTab === 'rekapan' && <TabRekapan />}
        {activeTab === 'profil'  && <TabProfil />}
      </main>

      <div className="fixed bottom-[60px] left-0 right-0 z-30 sk-glass border-t border-[var(--sk-border-2)] safe-bottom md:bottom-5 md:left-[96px] md:right-6 md:max-w-2xl md:border md:rounded-2xl md:shadow-2xl">
        <div className="px-4 py-3 md:px-4">
          <SmartInput
            onSubmit={addTransaction}
            isSubmitting={isSubmitting}
            parserExtras={parserExtras}
          />
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        aria-label="Navigasi utama"
        className="fixed bottom-0 left-0 right-0 z-40 sk-glass border-t border-[var(--sk-border-2)] safe-bottom md:hidden"
      >
        <div className="flex items-stretch h-[60px]">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
              onClick={() => setActiveTab(tab.id)}
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
          className="fixed z-50 animate-slide-up bottom-[176px] left-4 right-4 md:bottom-[104px] md:left-auto md:right-6 md:w-auto"
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
            {toast.text}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <AppShell />
}
