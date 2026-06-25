'use client'

import { useState } from 'react'
import { Eye, EyeOff, Zap, TrendingUp, TrendingDown } from 'lucide-react'
import { formatIDR, formatIDRCompact } from '@/lib/parser'
import { cn } from '@/lib/utils'

interface BalanceHeaderProps {
  totalBalance: number
  totalIncome: number
  totalExpense: number
  period: string
}

export function BalanceHeader({
  totalBalance,
  totalIncome,
  totalExpense,
  period,
}: BalanceHeaderProps) {
  const [hidden, setHidden] = useState(false)
  const savingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0

  const balanceIsPositive = totalBalance >= 0

  return (
    <header className="relative w-full overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-48 w-72 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(ellipse, rgba(56,189,248,0.08) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 px-4 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6">
        {/* App brand row */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--sk-cyan)] shadow-lg shadow-[var(--sk-cyan-glow)]">
              <Zap className="w-4.5 h-4.5 text-[#0B0F19] fill-current" strokeWidth={0} />
            </div>
            <span className="text-[var(--sk-text)] font-semibold text-[15px] tracking-tight">
              SakuKilat
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setHidden(h => !h)}
              aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--sk-surface-2)] hover:bg-[var(--sk-surface-3)] transition-colors text-[var(--sk-text-muted)]"
            >
              {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-1">
          <p className="text-xs font-medium text-[var(--sk-text-muted)] uppercase tracking-widest mb-2">
            Saldo Bersih — {period}
          </p>
          <div
            className={cn(
              'text-4xl md:text-5xl font-bold tracking-tight tabular-nums leading-none transition-all duration-300',
              balanceIsPositive ? 'text-[var(--sk-text)]' : 'text-[var(--sk-red)]'
            )}
            data-amount
          >
            {hidden ? (
              <span className="select-none tracking-widest text-[var(--sk-text-dim)]">
                •••••••••
              </span>
            ) : (
              <span>{formatIDR(totalBalance)}</span>
            )}
          </div>
        </div>

        {/* Savings rate badge */}
        {!hidden && totalIncome > 0 && (
          <div className="mt-3 mb-5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--sk-surface-2)] border border-[var(--sk-border)]">
            <span
              className={cn(
                'inline-block w-1.5 h-1.5 rounded-full',
                savingsRate >= 20
                  ? 'bg-[var(--sk-green)]'
                  : savingsRate >= 0
                  ? 'bg-[var(--sk-amber)]'
                  : 'bg-[var(--sk-red)]'
              )}
            />
            <span className="text-[var(--sk-text-muted)]">
              Tingkat tabungan{' '}
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  savingsRate >= 20
                    ? 'text-[var(--sk-green)]'
                    : savingsRate >= 0
                    ? 'text-[var(--sk-amber)]'
                    : 'text-[var(--sk-red)]'
                )}
              >
                {savingsRate}%
              </span>
            </span>
          </div>
        )}

        {/* Income / Expense cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Income card */}
          <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--sk-text-muted)] font-medium">Pemasukan</span>
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--sk-green-dim)]">
                <TrendingUp className="w-3.5 h-3.5 text-[var(--sk-green)]" />
              </div>
            </div>
            <div
              className="text-lg font-bold tabular-nums text-[var(--sk-green)]"
              data-amount
            >
              {hidden ? '••••••' : formatIDRCompact(totalIncome)}
            </div>
          </div>

          {/* Expense card */}
          <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--sk-text-muted)] font-medium">Pengeluaran</span>
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--sk-red-dim)]">
                <TrendingDown className="w-3.5 h-3.5 text-[var(--sk-red)]" />
              </div>
            </div>
            <div
              className="text-lg font-bold tabular-nums text-[var(--sk-red)]"
              data-amount
            >
              {hidden ? '••••••' : formatIDRCompact(totalExpense)}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
