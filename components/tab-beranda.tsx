'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import {
  useAuthStore,
  usePreferenceStore,
  useTransactionActions,
  useTransactionData,
  useTransactionStatus,
} from '@/lib/store'
import { TransactionList } from '@/components/transaction-list'
import { FilterTabs, type FilterTab } from '@/components/filter-tabs'
import { BudgetCard } from '@/components/budget-card'
import { WalletSummary } from '@/components/wallet-summary'
import { getCategoryHex, getCategoryConfig } from '@/components/category-badge'
import { monthlyTotals, categoryBreakdown } from '@/lib/stats'
import { formatIDR, formatIDRCompact } from '@/lib/parser'
import { cn } from '@/lib/utils'

// ── Greeting ──────────────────────────────────────────────────────────────────
function getGreeting(name: string, hour: number | null): string {
  if (hour === null) return `Halo, ${name}!`
  if (hour < 5)  return `Begadang lagi, ${name}?`
  if (hour < 11) return `Selamat pagi, ${name}!`
  if (hour < 15) return `Selamat siang, ${name}!`
  if (hour < 18) return `Selamat sore, ${name}!`
  return `Selamat malam, ${name}!`
}

function useClientHour(): number | null {
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => {
    const syncHour = () => setHour(new Date().getHours())
    syncHour()
    const intervalId = window.setInterval(syncHour, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  return hour
}

// ── Donut center label ────────────────────────────────────────────────────────
interface DonutCenterProps {
  cx: number; cy: number; total: number; zen: boolean
}
function DonutCenter({ cx, cy, total, zen }: DonutCenterProps) {
  return (
    <g>
      <text
        x={cx} y={cy - 10}
        textAnchor="middle"
        fill="var(--sk-text-muted)"
        fontSize={10}
        fontFamily="var(--font-sans)"
        letterSpacing="0.06em"
      >
        PENGELUARAN
      </text>
      <text
        x={cx} y={cy + 14}
        textAnchor="middle"
        fill={zen ? 'var(--sk-text-dim)' : 'var(--sk-text)'}
        fontSize={zen ? 16 : 18}
        fontWeight="700"
        fontFamily="var(--font-sans)"
      >
        {zen ? '•••••••' : formatIDRCompact(total)}
      </text>
    </g>
  )
}

export const TabBeranda = memo(function TabBeranda() {
  const { user } = useAuthStore()
  const { transactions } = useTransactionData()
  const { deleteTransaction } = useTransactionActions()
  const { newTransactionId } = useTransactionStatus()
  const { zenMode, toggleZen } = usePreferenceStore()

  const [activeFilter, setActiveFilter] = useState<FilterTab>('semua')
  const hour = useClientHour()

  const period = useMemo(() =>
    new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date()),
  [])

  const { income, expense, balance } = useMemo(
    () => monthlyTotals(transactions),
    [transactions]
  )

  const slices = useMemo(
    () => categoryBreakdown(transactions),
    [transactions]
  )

  const chartData = useMemo(
    () => slices.length > 0 ? slices : [{ category: 'empty', total: 1, pct: 1 }],
    [slices]
  )

  const recentTransactions = useMemo(() =>
    [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 7),
  [transactions])

  const filteredTransactions = useMemo(() => {
    if (activeFilter === 'semua') return recentTransactions
    if (activeFilter === 'pengeluaran') return recentTransactions.filter(t => t.type === 'expense')
    return recentTransactions.filter(t => t.type === 'income')
  }, [recentTransactions, activeFilter])

  const filterCounts = useMemo(() => ({
    semua: recentTransactions.length,
    pengeluaran: recentTransactions.filter(t => t.type === 'expense').length,
    pemasukan: recentTransactions.filter(t => t.type === 'income').length,
  }), [recentTransactions])

  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0
  const isEmpty = slices.length === 0

  return (
    <div className="flex flex-col min-h-full md:ml-[72px]">

      {/* ── Desktop top bar ── */}
      <div className="hidden md:flex sticky top-0 z-30 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-[var(--sk-border)] px-8 py-4 items-center justify-between">
        <div>
          <p className="text-xs text-[var(--sk-text-dim)] mb-0.5">{period}</p>
          <h1 className="text-base font-semibold text-[var(--sk-text)]">
            {user ? getGreeting(user.givenName, hour) : 'SakuKilat'}
          </h1>
        </div>
        <button
          onClick={toggleZen}
          aria-label={zenMode ? 'Matikan Zen Mode' : 'Aktifkan Zen Mode'}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
            zenMode
              ? 'bg-[var(--sk-cyan-dim)] border-[rgba(56,189,248,0.3)] text-[var(--sk-cyan)]'
              : 'bg-[var(--sk-surface-2)] border-[var(--sk-border)] text-[var(--sk-text-muted)]'
          )}
        >
          {zenMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Zen
        </button>
      </div>

      {/* ── Mobile header ── */}
      <header className="md:hidden px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--sk-cyan)] flex items-center justify-center shadow-[0_0_12px_var(--sk-cyan-glow)]">
              <Zap className="w-4 h-4 fill-[#0B0F19]" strokeWidth={0} />
            </div>
            <span className="text-sm font-semibold text-[var(--sk-text)]">SakuKilat</span>
          </div>
          <button
            onClick={toggleZen}
            aria-label={zenMode ? 'Matikan Zen Mode' : 'Aktifkan Zen Mode'}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center border transition-colors',
              zenMode
                ? 'bg-[var(--sk-cyan-dim)] border-[rgba(56,189,248,0.25)] text-[var(--sk-cyan)]'
                : 'bg-[var(--sk-surface-2)] border-[var(--sk-border)] text-[var(--sk-text-muted)]'
            )}
          >
            {zenMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
        {user && (
          <p className="text-xs text-[var(--sk-text-muted)]">
            {getGreeting(user.givenName, hour)}
          </p>
        )}
      </header>

      {/* ── Balance + Donut card ── */}
      <section className="px-4 md:px-8 pb-4">
        <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-5 overflow-hidden relative">
          {/* ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 right-0 w-48 h-48 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 70%)' }}
          />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            {/* Left: balance text */}
            <div className="flex-1 min-w-[200px]">
              <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-1.5">
                Saldo bersih — {period}
              </p>
              <div className={cn(
                'text-3xl font-bold tabular-nums leading-none mb-3',
                balance >= 0 ? 'text-[var(--sk-text)]' : 'text-[var(--sk-red)]',
                zenMode && 'sk-zen-blur'
              )} data-amount>
                {balance >= 0 ? '' : '−'}{formatIDR(Math.abs(balance))}
              </div>

              {/* Savings rate */}
              {income > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium bg-[var(--sk-surface-2)] border border-[var(--sk-border)]">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    savingsRate >= 20 ? 'bg-[var(--sk-green)]' : savingsRate >= 0 ? 'bg-[var(--sk-amber)]' : 'bg-[var(--sk-red)]'
                  )} />
                  <span className="text-[var(--sk-text-dim)]">Tabungan</span>
                  <span className={cn(
                    'font-semibold tabular-nums',
                    savingsRate >= 20 ? 'text-[var(--sk-green)]' : savingsRate >= 0 ? 'text-[var(--sk-amber)]' : 'text-[var(--sk-red)]'
                  )}>{savingsRate}%</span>
                </div>
              )}

              {/* Income / Expense mini stats */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-[var(--sk-green-dim)] flex items-center justify-center">
                    <TrendingUp className="w-3 h-3 text-[var(--sk-green)]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--sk-text-dim)] leading-tight">Masuk</p>
                    <p className={cn('text-sm font-bold tabular-nums text-[var(--sk-green)]', zenMode && 'sk-zen-blur')} data-amount>
                      {formatIDRCompact(income)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-[var(--sk-red-dim)] flex items-center justify-center">
                    <TrendingDown className="w-3 h-3 text-[var(--sk-red)]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--sk-text-dim)] leading-tight">Keluar</p>
                    <p className={cn('text-sm font-bold tabular-nums text-[var(--sk-red)]', zenMode && 'sk-zen-blur')} data-amount>
                      {formatIDRCompact(expense)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Donut chart */}
            <div className={cn('w-24 h-24 md:w-[120px] md:h-[120px] flex-shrink-0 relative', zenMode && 'sk-zen-blur')}>
              {isEmpty ? (
                <div className="w-full h-full rounded-full border-4 border-dashed border-[var(--sk-border-2)] flex items-center justify-center">
                  <span className="text-[10px] text-[var(--sk-text-dim)] text-center leading-tight">Belum<br/>ada data</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="34%"
                      outerRadius="48%"
                      paddingAngle={2}
                      dataKey="total"
                      labelLine={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.category === 'empty' ? 'var(--sk-surface-3)' : getCategoryHex(entry.category)}
                          strokeWidth={0}
                        />
                      ))}
                    </Pie>
                    {/* Custom center label via customized */}
                    <text
                      x="50%" y="44%"
                      textAnchor="middle"
                      fill="var(--sk-text-dim)"
                      fontSize={8}
                      fontFamily="var(--font-sans)"
                      letterSpacing="0.05em"
                    >
                      KELUAR
                    </text>
                    <text
                      x="50%" y="62%"
                      textAnchor="middle"
                      fill="var(--sk-text)"
                      fontSize={11}
                      fontWeight="700"
                      fontFamily="var(--font-sans)"
                    >
                      {formatIDRCompact(expense)}
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category legend */}
          {slices.length > 0 && (
            <div className={cn('mt-4 pt-3.5 border-t border-[var(--sk-border)] flex flex-wrap gap-x-3 gap-y-1.5', zenMode && 'sk-zen-blur')}>
              {slices.slice(0, 5).map(s => {
                const conf = getCategoryConfig(s.category)
                return (
                  <div key={s.category} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: getCategoryHex(s.category) }}
                    />
                    <span className="text-[11px] text-[var(--sk-text-muted)]">{conf.label}</span>
                    <span className="text-[11px] font-semibold tabular-nums text-[var(--sk-text-dim)]">
                      {Math.round(s.pct * 100)}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Filter + Transactions ── */}
      <div className="md:grid md:grid-cols-2">
        <WalletSummary />
        <BudgetCard />
      </div>

      <section className="flex-1 md:px-8">
        <div className="sticky top-0 z-20 bg-[#0B0F19]/90 backdrop-blur-xl px-4 md:px-0 py-3 border-b border-[var(--sk-border)]">
          <FilterTabs active={activeFilter} onChange={setActiveFilter} counts={filterCounts} />
        </div>
        <div className="pt-3 pb-4">
          <TransactionList
            transactions={filteredTransactions}
            onDelete={deleteTransaction}
            newTransactionId={newTransactionId}
          />
        </div>
      </section>

    </div>
  )
})
