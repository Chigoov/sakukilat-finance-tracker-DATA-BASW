'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
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

function useClientDateInfo() {
  const [dateInfo, setDateInfo] = useState({
    period: 'Bulan ini',
    fullDate: 'Hari ini',
    monthProgress: '',
  })

  useEffect(() => {
    const syncDate = () => {
      const now = new Date()
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      setDateInfo({
        period: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now),
        fullDate: new Intl.DateTimeFormat('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(now),
        monthProgress: `Hari ke-${now.getDate()} dari ${daysInMonth}`,
      })
    }

    syncDate()
    const intervalId = window.setInterval(syncDate, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  return dateInfo
}

function localDayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayStart(date: Date, offset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)
}

function PieHoverTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload: { category: string; total: number; pct: number }
  }>
}) {
  if (!active || !payload?.length) return null

  const slice = payload[0].payload
  const config = getCategoryConfig(slice.category)

  return (
    <div className="rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border-2)] px-3 py-2 shadow-2xl">
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: getCategoryHex(slice.category) }}
        />
        <span className="text-xs font-semibold text-[var(--sk-text)]">{config.label}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-sm font-bold tabular-nums text-[var(--sk-red)]">
          {formatIDRCompact(slice.total)}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-[var(--sk-text-muted)]">
          {Math.round(slice.pct * 100)}%
        </span>
      </div>
    </div>
  )
}

export const TabBeranda = memo(function TabBeranda() {
  const { user } = useAuthStore()
  const { transactions } = useTransactionData()
  const { deleteTransaction, updateTransaction } = useTransactionActions()
  const { newTransactionId } = useTransactionStatus()
  const { zenMode, toggleZen } = usePreferenceStore()

  const [activeFilter, setActiveFilter] = useState<FilterTab>('semua')
  const hour = useClientHour()
  const { period, fullDate, monthProgress } = useClientDateInfo()

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

  const insightBar = useMemo(() => {
    const today = dayStart(new Date())
    const daySet = new Set(transactions.map(t => localDayKey(t.date)))
    let streak = 0

    for (let offset = 0; offset > -120; offset--) {
      if (!daySet.has(localDayKey(dayStart(today, offset)))) break
      streak += 1
    }

    const thisWeekStart = dayStart(today, -6).getTime()
    const prevWeekStart = dayStart(today, -13).getTime()
    const prevWeekEnd = dayStart(today, -7).getTime()
    let thisWeekExpense = 0
    let prevWeekExpense = 0

    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue
      const time = dayStart(transaction.date).getTime()
      if (time >= thisWeekStart) thisWeekExpense += transaction.amount
      if (time >= prevWeekStart && time <= prevWeekEnd) prevWeekExpense += transaction.amount
    }

    const delta = prevWeekExpense > 0
      ? Math.round(((thisWeekExpense - prevWeekExpense) / prevWeekExpense) * 100)
      : 0

    return {
      streak,
      trendText: prevWeekExpense === 0
        ? 'Minggu ini mulai terbaca.'
        : delta <= 0
          ? `Lebih hemat ${Math.abs(delta)}% dari minggu lalu.`
          : `Naik ${delta}% dari minggu lalu.`,
      tone: prevWeekExpense > 0 && delta > 0 ? 'warn' : 'good',
    }
  }, [transactions])

  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0
  const isEmpty = slices.length === 0

  return (
    <div className="flex flex-col min-h-full md:ml-[72px]">

      {/* ── Desktop top bar ── */}
      <div className="hidden md:flex sticky top-0 z-30 bg-[var(--sk-bg)] backdrop-blur-xl border-b border-[var(--sk-border)] px-8 py-4 items-center justify-between">
        <div>
          <p className="text-xs text-[var(--sk-text-dim)] mb-0.5">{fullDate}</p>
          <h1 className="text-base font-semibold text-[var(--sk-text)]">
            {user ? getGreeting(user.givenName, hour) : 'SakuKilat'}
          </h1>
          <p className="text-[11px] text-[var(--sk-text-dim)] mt-0.5">{monthProgress}</p>
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
          <div>
            <p className="text-xs text-[var(--sk-text-muted)]">
              {getGreeting(user.givenName, hour)}
            </p>
            <p className="text-[11px] text-[var(--sk-text-dim)] mt-0.5">
              {fullDate} · {monthProgress}
            </p>
          </div>
        )}
      </header>

      <section className="px-4 md:px-8 pb-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border)] px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-2 h-2 rounded-full bg-[var(--sk-cyan)] shadow-[0_0_10px_var(--sk-cyan-glow)]" />
            <span className="text-xs font-semibold text-[var(--sk-text)]">
              {insightBar.streak > 0 ? `${insightBar.streak} hari rutin nyatat` : 'Mulai catat hari ini'}
            </span>
          </div>
          <span className={cn(
            'text-xs font-medium',
            insightBar.tone === 'good' ? 'text-[var(--sk-green)]' : 'text-[var(--sk-amber)]'
          )}>
            {insightBar.trendText}
          </span>
        </div>
      </section>

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
            <div className={cn('w-full sm:w-44 md:w-48 flex-shrink-0 relative flex flex-col items-center', zenMode && 'sk-zen-blur')}>
              {isEmpty ? (
                <div className="w-36 h-36 md:w-40 md:h-40 rounded-full border-4 border-dashed border-[var(--sk-border-2)] flex items-center justify-center">
                  <span className="text-[10px] text-[var(--sk-text-dim)] text-center leading-tight">Belum<br/>ada data</span>
                </div>
              ) : (
                <div className="w-full">
                  <div className="mb-1 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--sk-text-dim)]">Alokasi keluar</p>
                    <p className="text-[10px] text-[var(--sk-text-dim)]">Arahkan ke potongan chart</p>
                  </div>
                  <div className="w-36 h-36 md:w-40 md:h-40 mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          content={<PieHoverTooltip />}
                          cursor={false}
                          wrapperStyle={{ outline: 'none', zIndex: 20 }}
                        />
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          outerRadius="82%"
                          paddingAngle={2}
                          dataKey="total"
                          labelLine={false}
                        >
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.category === 'empty' ? 'var(--sk-surface-3)' : getCategoryHex(entry.category)}
                              stroke="var(--sk-surface)"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category legend */}
          {slices.length > 0 && (
            <div className={cn('mt-4 pt-3.5 border-t border-[var(--sk-border)] grid gap-2 sm:grid-cols-2', zenMode && 'sk-zen-blur')}>
              {slices.slice(0, 6).map(s => {
                const conf = getCategoryConfig(s.category)
                return (
                  <div
                    key={s.category}
                    className="flex items-center gap-2 rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border)] px-2.5 py-2"
                  >
                    <span
                      className="w-10 shrink-0 rounded-lg px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums text-[#090D16]"
                      style={{ background: getCategoryHex(s.category) }}
                    >
                      {Math.round(s.pct * 100)}%
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--sk-text-muted)]">
                      {conf.label}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums text-[var(--sk-text)]">
                      {formatIDRCompact(s.total)}
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
        <div className="sticky top-0 z-20 bg-[var(--sk-bg)] backdrop-blur-xl px-4 md:px-0 py-3 border-b border-[var(--sk-border)]">
          <FilterTabs active={activeFilter} onChange={setActiveFilter} counts={filterCounts} />
        </div>
        <div className="pt-3 pb-4">
          <TransactionList
            transactions={filteredTransactions}
            onDelete={deleteTransaction}
            onUpdate={updateTransaction}
            newTransactionId={newTransactionId}
          />
        </div>
      </section>

    </div>
  )
})
