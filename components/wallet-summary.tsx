'use client'

import { Landmark, Wallet } from 'lucide-react'
import { usePreferenceStore, useWalletStore } from '@/lib/store'
import { formatIDR, formatIDRCompact } from '@/lib/parser'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  ewallet: 'E-wallet',
  card: 'Kartu',
  savings: 'Simpan',
  other: 'Lainnya',
}

export function WalletSummary() {
  const { wallets, totalStored } = useWalletStore()
  const { zenMode } = usePreferenceStore()
  const visibleWallets = wallets
    .slice()
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)

  return (
    <section className="px-4 md:px-8 pb-4">
      <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-[var(--sk-cyan-dim)] flex items-center justify-center">
            <Wallet className="w-4 h-4 text-[var(--sk-cyan)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--sk-text-muted)]">Uang tersimpan</p>
            <p className={cn('text-lg font-bold tabular-nums text-[var(--sk-text)]', zenMode && 'sk-zen-blur')} data-amount>
              {formatIDR(totalStored)}
            </p>
          </div>
          <span className="text-[10px] text-[var(--sk-text-dim)] tabular-nums">{wallets.length} saku</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          {visibleWallets.map(wallet => (
            <div key={wallet.id} className="rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border)] px-3 py-2.5 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-3.5 h-3.5 text-[var(--sk-text-dim)] flex-shrink-0" />
                <span className="text-xs font-medium text-[var(--sk-text-muted)] truncate">{wallet.label}</span>
                <span className="ml-auto text-[9px] text-[var(--sk-text-dim)]">{TYPE_LABELS[wallet.type]}</span>
              </div>
              <p className={cn('text-sm font-bold tabular-nums text-[var(--sk-text)] truncate', zenMode && 'sk-zen-blur')} data-amount>
                {formatIDRCompact(wallet.balance)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
