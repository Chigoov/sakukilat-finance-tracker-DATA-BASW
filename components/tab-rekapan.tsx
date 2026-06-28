'use client'

import { memo, useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useTransactionActions, useTransactionData, useTransactionStatus } from '@/lib/store'
import { TransactionItem } from '@/components/transaction-item'
import { TransactionList } from '@/components/transaction-list'
import { FilterTabs, type FilterTab } from '@/components/filter-tabs'
import {
  dailyAggregates, transactionsForDay, trendSeries, trendSeriesForPeriod, topSavedCategory,
  categoryBreakdown, monthlyTotals,
  type TrendRange,
} from '@/lib/stats'
import { formatIDRCompact, formatIDR } from '@/lib/parser'
import { dayKey } from '@/lib/stats'
import { getCategoryConfig, getCategoryHex } from '@/components/category-badge'
import { cn } from '@/lib/utils'

type RekapView = 'kalender' | 'history' | 'tren'
type TrendMode = TrendRange | 'custom'

const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

const RANGES: { id: TrendMode; label: string }[] = [
  { id: '7d',  label: '7 Hari' },
  { id: '30d', label: '30 Hari' },
  { id: '1y',  label: '1 Tahun' },
  { id: 'custom', label: 'Periode' },
]

function dateFromDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function dayKeyFromOffset(daysAgo: number): string {
  const now = new Date()
  return dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo))
}

// ── Custom tooltip for charts ─────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--sk-surface-2)] border border-[var(--sk-border-2)] rounded-xl px-3 py-2.5 shadow-2xl text-xs">
      <p className="text-[var(--sk-text-muted)] mb-2 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--sk-text-dim)]">{p.name === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</span>
          <span className="font-semibold text-[var(--sk-text)] tabular-nums ml-auto pl-3">
            {formatIDRCompact(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────
function CalendarView() {
  const { transactions } = useTransactionData()
  const { deleteTransaction, updateTransaction } = useTransactionActions()
  const [month, setMonth] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const today = useMemo(() => dayKey(new Date()), [])

  const dailyMap = useMemo(() => dailyAggregates(transactions), [transactions])

  // Build calendar grid
  const { cells, monthLabel } = useMemo(() => {
    const { year, month: m } = month
    const firstDay = new Date(year, m, 1)
    const lastDay  = new Date(year, m + 1, 0)
    const startOffset = firstDay.getDay() // 0=Sun
    const totalCells = startOffset + lastDay.getDate()
    const paddedCells = Math.ceil(totalCells / 7) * 7

    const cells: Array<{ key: string | null; day: number | null }> = []
    for (let i = 0; i < paddedCells; i++) {
      if (i < startOffset || i >= startOffset + lastDay.getDate()) {
        cells.push({ key: null, day: null })
      } else {
        const d = i - startOffset + 1
        const k = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        cells.push({ key: k, day: d })
      }
    }

    const monthLabel = `${MONTHS_ID[m]} ${year}`
    return { cells, monthLabel }
  }, [month])

  const expenseScale = useMemo(() => {
    const values = Array.from(dailyMap.values())
      .map(agg => agg.expense)
      .filter(value => value > 0)
      .sort((a, b) => a - b)

    if (values.length === 0) return 1
    const index = Math.min(values.length - 1, Math.floor(values.length * 0.9))
    return values[index] || 1
  }, [dailyMap])

  const selectedTransactions = useMemo(() =>
    selectedDay ? transactionsForDay(transactions, selectedDay) : [],
  [transactions, selectedDay])

  const selectedAgg = selectedDay ? dailyMap.get(selectedDay) : undefined

  return (
    <div>
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonth(p => {
            const d = new Date(p.year, p.month - 1, 1)
            return { year: d.getFullYear(), month: d.getMonth() }
          })}
          aria-label="Bulan sebelumnya"
          className="w-8 h-8 rounded-lg bg-[var(--sk-surface-2)] flex items-center justify-center text-[var(--sk-text-muted)] hover:bg-[var(--sk-surface-3)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-[var(--sk-text)]">{monthLabel}</span>
        <button
          onClick={() => setMonth(p => {
            const d = new Date(p.year, p.month + 1, 1)
            return { year: d.getFullYear(), month: d.getMonth() }
          })}
          aria-label="Bulan berikutnya"
          className="w-8 h-8 rounded-lg bg-[var(--sk-surface-2)] flex items-center justify-center text-[var(--sk-text-muted)] hover:bg-[var(--sk-surface-3)] transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-[var(--sk-text-dim)] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.key) {
            return <div key={`empty-${i}`} className="aspect-square" />
          }
          const agg = dailyMap.get(cell.key)
          const hasData = !!agg
          const intensity = hasData && agg.expense > 0
            ? Math.min(1, Math.log1p(agg.expense) / Math.log1p(expenseScale))
            : 0
          const isToday = cell.key === today
          const isSelected = cell.key === selectedDay

          return (
            <button
              key={cell.key}
              onClick={() => setSelectedDay(k => k === cell.key ? null : cell.key)}
              aria-label={`${cell.day}, masuk ${formatIDR(agg?.income ?? 0)}, keluar ${formatIDR(agg?.expense ?? 0)}`}
              aria-pressed={isSelected}
              className={cn(
                'min-h-[58px] rounded-lg flex flex-col items-center justify-start gap-0.5 transition-all duration-150 relative px-1 py-1.5',
                isSelected
                  ? 'ring-1 ring-[var(--sk-cyan)] bg-[var(--sk-cyan-dim)]'
                  : isToday
                  ? 'ring-1 ring-[var(--sk-border-2)] bg-[var(--sk-surface-2)]'
                  : hasData
                  ? 'bg-[var(--sk-surface)] hover:bg-[var(--sk-surface-2)]'
                  : 'bg-transparent hover:bg-[var(--sk-surface)]'
              )}
            >
              <span className={cn(
                'text-[11px] font-medium leading-none',
                isToday ? 'text-[var(--sk-cyan)]' : 'text-[var(--sk-text-muted)]'
              )}>
                {cell.day}
              </span>
              {hasData && (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: agg.income > agg.expense
                        ? 'var(--sk-green)'
                        : `rgba(248,113,113,${0.4 + intensity * 0.6})`
                      }}
                  />
                  <div className="w-full min-w-0 space-y-0.5">
                    {agg.income > 0 && (
                      <span className="block text-[8px] leading-none tabular-nums text-[var(--sk-green)] truncate">
                        +{formatIDR(agg.income)}
                      </span>
                    )}
                    {agg.expense > 0 && (
                      <span className="block text-[8px] leading-none tabular-nums text-[var(--sk-red)] truncate">
                        -{formatIDR(agg.expense)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day bottom sheet */}
      {selectedDay && (
        <div className="mt-4 rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border-2)] overflow-hidden animate-slide-up">
          <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--sk-border)]">
            <div>
              <p className="text-xs text-[var(--sk-text-dim)]">
                {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(
                  dateFromDayKey(selectedDay)
                )}
              </p>
              {selectedAgg && (
                <div className="flex items-center gap-3 mt-0.5">
                  {selectedAgg.expense > 0 && (
                    <span className="text-xs font-semibold tabular-nums text-[var(--sk-red)]">
                      -{formatIDR(selectedAgg.expense)}
                    </span>
                  )}
                  {selectedAgg.income > 0 && (
                    <span className="text-xs font-semibold tabular-nums text-[var(--sk-green)]">
                      +{formatIDR(selectedAgg.income)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="w-7 h-7 rounded-lg bg-[var(--sk-surface-2)] flex items-center justify-center text-[var(--sk-text-muted)]"
              aria-label="Tutup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3 flex flex-col gap-2 max-h-[280px] overflow-y-auto">
            {selectedTransactions.length === 0 ? (
              <p className="text-xs text-center text-[var(--sk-text-dim)] py-4">Tidak ada transaksi</p>
            ) : (
              selectedTransactions.map(t => (
                <TransactionItem key={t.id} transaction={t} onDelete={deleteTransaction} onUpdate={updateTransaction} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trend view ────────────────────────────────────────────────────────────────
function AllocationStrip({ slices, emptyText }: { slices: ReturnType<typeof categoryBreakdown>; emptyText: string }) {
  if (slices.length === 0) {
    return (
      <div className="h-2 rounded-full bg-[var(--sk-surface-3)]" aria-label={emptyText} />
    )
  }

  return (
    <div className="h-2 rounded-full bg-[var(--sk-surface-3)] overflow-hidden flex">
      {slices.map(slice => (
        <div
          key={slice.category}
          className="h-full"
          style={{
            width: `${slice.pct * 100}%`,
            background: getCategoryHex(slice.category),
          }}
        />
      ))}
    </div>
  )
}

function AllocationRows({ slices, tone }: { slices: ReturnType<typeof categoryBreakdown>; tone: 'expense' | 'income' }) {
  if (slices.length === 0) {
    return (
      <p className="text-xs text-[var(--sk-text-dim)] py-2">
        Belum ada {tone === 'expense' ? 'pengeluaran' : 'pemasukan'} di bulan ini.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {slices.map(slice => {
        const conf = getCategoryConfig(slice.category)
        return (
          <div
            key={slice.category}
            className="flex items-center gap-3 border-b border-[var(--sk-border)] py-2.5 last:border-b-0"
          >
            <span
              className="w-11 shrink-0 rounded-lg px-2 py-1 text-center text-[11px] font-bold tabular-nums text-[#090D16]"
              style={{ background: getCategoryHex(slice.category) }}
            >
              {Math.round(slice.pct * 100)}%
            </span>
            <span className="text-sm font-semibold uppercase tracking-wide text-[var(--sk-text)] truncate">{conf.label}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-[var(--sk-text)]">
              {formatIDRCompact(slice.total)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MonthlyAllocationCard() {
  const { transactions } = useTransactionData()
  const [monthOffset, setMonthOffset] = useState(0)
  const [focus, setFocus] = useState<'expense' | 'income'>('expense')

  const monthRef = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  }, [monthOffset])

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(monthRef),
    [monthRef]
  )
  const totals = useMemo(() => monthlyTotals(transactions, monthRef), [transactions, monthRef])
  const expenseSlices = useMemo(() => categoryBreakdown(transactions, monthRef, 'expense'), [transactions, monthRef])
  const incomeSlices = useMemo(() => categoryBreakdown(transactions, monthRef, 'income'), [transactions, monthRef])
  const activeSlices = focus === 'expense' ? expenseSlices : incomeSlices
  const activeTotal = focus === 'expense' ? totals.expense : totals.income
  const emptyLabel = focus === 'expense' ? 'Belum ada pengeluaran' : 'Belum ada pemasukan'

  return (
    <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => setMonthOffset(value => value - 1)}
          aria-label="Bulan sebelumnya"
          className="w-8 h-8 rounded-lg bg-[var(--sk-surface-2)] flex items-center justify-center text-[var(--sk-text-muted)] hover:bg-[var(--sk-surface-3)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-sm font-semibold text-[var(--sk-text)] truncate">{monthLabel}</p>
          <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest">Alokasi bulanan</p>
        </div>
        <button
          onClick={() => setMonthOffset(value => Math.min(0, value + 1))}
          disabled={monthOffset === 0}
          aria-label="Bulan berikutnya"
          className="w-8 h-8 rounded-lg bg-[var(--sk-surface-2)] flex items-center justify-center text-[var(--sk-text-muted)] hover:bg-[var(--sk-surface-3)] transition-colors disabled:opacity-35 disabled:hover:bg-[var(--sk-surface-2)]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          type="button"
          onClick={() => setFocus('income')}
          className={cn(
            'rounded-xl bg-[var(--sk-surface-2)] border p-3 text-left transition-colors',
            focus === 'income' ? 'border-[var(--sk-green)] shadow-[inset_0_-3px_0_var(--sk-green)]' : 'border-[var(--sk-border)]'
          )}
        >
          <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">Pendapatan</p>
          <p className="text-base font-bold tabular-nums text-[var(--sk-green)]">{formatIDRCompact(totals.income)}</p>
        </button>
        <button
          type="button"
          onClick={() => setFocus('expense')}
          className={cn(
            'rounded-xl bg-[var(--sk-surface-2)] border p-3 text-left transition-colors',
            focus === 'expense' ? 'border-[var(--sk-red)] shadow-[inset_0_-3px_0_var(--sk-red)]' : 'border-[var(--sk-border)]'
          )}
        >
          <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">Pengeluaran</p>
          <p className="text-base font-bold tabular-nums text-[var(--sk-red)]">{formatIDRCompact(totals.expense)}</p>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.9fr)_minmax(260px,1.1fr)] lg:items-center">
        <div className="min-h-[260px]">
          {activeSlices.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={activeSlices}
                  cx="50%"
                  cy="50%"
                  outerRadius="86%"
                  paddingAngle={1}
                  dataKey="total"
                  labelLine={false}
                >
                  {activeSlices.map(slice => (
                    <Cell
                      key={slice.category}
                      fill={getCategoryHex(slice.category)}
                      stroke="var(--sk-surface)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] rounded-2xl border border-dashed border-[var(--sk-border-2)] bg-[var(--sk-surface-2)] flex items-center justify-center">
              <p className="text-xs text-[var(--sk-text-dim)]">{emptyLabel}</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[var(--sk-surface-2)] border border-[var(--sk-border)] p-3">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--sk-border)] pb-3 mb-1">
            <div>
              <p className="text-xs font-semibold text-[var(--sk-text-muted)]">
                {focus === 'expense' ? 'Alokasi pengeluaran' : 'Sumber pendapatan'}
              </p>
              <p className="text-[10px] text-[var(--sk-text-dim)]">{activeSlices.length} kategori tercatat</p>
            </div>
            <p className={cn(
              'text-sm font-bold tabular-nums',
              focus === 'expense' ? 'text-[var(--sk-red)]' : 'text-[var(--sk-green)]'
            )}>
              {formatIDRCompact(activeTotal)}
            </p>
          </div>
          <AllocationRows slices={activeSlices} tone={focus} />
        </div>
      </div>
    </div>
  )
}

function TrenView() {
  const { transactions } = useTransactionData()
  const [range, setRange] = useState<TrendMode>('30d')
  const [customStart, setCustomStart] = useState(() => dayKeyFromOffset(29))
  const [customEnd, setCustomEnd] = useState(() => dayKeyFromOffset(0))

  const customStartDate = customStart ? dateFromDayKey(customStart) : null
  const customEndDate = customEnd ? dateFromDayKey(customEnd) : null
  const customValid = !!customStartDate && !!customEndDate && customStartDate <= customEndDate

  const series = useMemo(() => {
    if (range !== 'custom') return trendSeries(transactions, range)
    if (!customValid || !customStartDate || !customEndDate) return []
    return trendSeriesForPeriod(transactions, customStartDate, customEndDate)
  }, [transactions, range, customValid, customStartDate, customEndDate])

  const totalExpense = useMemo(() => series.reduce((s, p) => s + p.expense, 0), [series])
  const totalIncome  = useMemo(() => series.reduce((s, p) => s + p.income, 0), [series])
  const saved = useMemo(() => topSavedCategory(transactions), [transactions])
  const savedConf = useMemo(() => saved ? getCategoryConfig(saved) : null, [saved])
  const xInterval = useMemo(() => series.length > 12 ? Math.ceil(series.length / 6) : 0, [series.length])
  const customRangeLabel = customValid && customStartDate && customEndDate
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(customStartDate)
      + ' - '
      + new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(customEndDate)
    : 'Pilih tanggal awal dan akhir yang valid'

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {RANGES.map(r => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              range === r.id
                ? 'bg-[var(--sk-cyan)] text-[#0B0F19]'
                : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] hover:bg-[var(--sk-surface-3)]'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5 mb-5">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="min-w-0">
              <span className="block text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">
                Dari
              </span>
              <input
                type="date"
                value={customStart}
                onInput={e => setCustomStart(e.currentTarget.value)}
                onChange={e => setCustomStart(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-2.5 py-2 text-xs text-[var(--sk-text)] outline-none focus:border-[var(--sk-cyan)]"
              />
            </label>
            <label className="min-w-0">
              <span className="block text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">
                Sampai
              </span>
              <input
                type="date"
                value={customEnd}
                onInput={e => setCustomEnd(e.currentTarget.value)}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-2.5 py-2 text-xs text-[var(--sk-text)] outline-none focus:border-[var(--sk-cyan)]"
              />
            </label>
          </div>
          <p className={cn(
            'text-[11px] leading-relaxed',
            customValid ? 'text-[var(--sk-text-dim)]' : 'text-[var(--sk-red)]'
          )}>
            History: {customRangeLabel}
          </p>
        </div>
      )}

      <MonthlyAllocationCard />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5">
          <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">Pengeluaran</p>
          <p className="text-lg font-bold tabular-nums text-[var(--sk-red)]">{formatIDRCompact(totalExpense)}</p>
        </div>
        <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5">
          <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">Pemasukan</p>
          <p className="text-lg font-bold tabular-nums text-[var(--sk-green)]">{formatIDRCompact(totalIncome)}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-4 mb-4">
        <p className="text-xs font-medium text-[var(--sk-text-muted)] mb-3">Pengeluaran vs Pemasukan</p>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} barGap={2} margin={{ top: 0, right: 0, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sk-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--sk-text-dim)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={xInterval}
              />
              <YAxis
                width={82}
                tick={{ fill: 'var(--sk-text-dim)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => formatIDRCompact(v)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="expense" fill="var(--sk-red)" radius={[3, 3, 0, 0]} name="expense" maxBarSize={20} />
              <Bar dataKey="income"  fill="var(--sk-green)" radius={[3, 3, 0, 0]} name="income" maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Line chart */}
      <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-4 mb-4">
        <p className="text-xs font-medium text-[var(--sk-text-muted)] mb-3">Tren Pengeluaran</p>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 0, right: 0, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sk-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--sk-text-dim)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={xInterval}
              />
              <YAxis
                width={82}
                tick={{ fill: 'var(--sk-text-dim)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => formatIDRCompact(v)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="var(--sk-cyan)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--sk-cyan)', strokeWidth: 0 }}
                name="expense"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insight card */}
      {savedConf && (
        <div className="rounded-xl bg-[var(--sk-green-dim)] border border-[rgba(52,211,153,0.2)] p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--sk-green-dim)] border border-[rgba(52,211,153,0.3)] flex items-center justify-center flex-shrink-0">
            <savedConf.icon className={cn('w-4 h-4', savedConf.color)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--sk-green)] mb-0.5">Penghematan minggu ini</p>
            <p className="text-xs text-[var(--sk-text-muted)] leading-relaxed">
              Pengeluaran <span className="font-medium text-[var(--sk-text)]">{savedConf.label}</span> kamu lebih hemat dari minggu lalu. Pertahankan!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Main tab ──────────────────────────────────────────────────────────────────
function HistoryView() {
  const { transactions } = useTransactionData()
  const { deleteTransaction, updateTransaction } = useTransactionActions()
  const { newTransactionId } = useTransactionStatus()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('semua')
  const [range, setRange] = useState<TrendMode>('30d')
  const [customStart, setCustomStart] = useState(() => dayKeyFromOffset(29))
  const [customEnd, setCustomEnd] = useState(() => dayKeyFromOffset(0))

  const customStartDate = customStart ? dateFromDayKey(customStart) : null
  const customEndDate = customEnd ? dateFromDayKey(customEnd) : null
  const customValid = !!customStartDate && !!customEndDate && customStartDate <= customEndDate

  const period = useMemo(() => {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    if (range === 'custom') {
      if (!customValid || !customStartDate || !customEndDate) return null
      return {
        start: customStartDate,
        end: new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate() + 1),
      }
    }

    const days = range === '7d' ? 6 : range === '30d' ? 29 : 364
    return {
      start: dateFromDayKey(dayKeyFromOffset(days)),
      end,
    }
  }, [customEndDate, customStartDate, customValid, range])

  const rangedTransactions = useMemo(
    () => period
      ? transactions.filter(t => t.date >= period.start && t.date < period.end)
      : [],
    [period, transactions]
  )

  const sortedTransactions = useMemo(
    () => [...rangedTransactions].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [rangedTransactions]
  )

  const filteredTransactions = useMemo(() => {
    if (activeFilter === 'semua') return sortedTransactions
    if (activeFilter === 'pengeluaran') return sortedTransactions.filter(t => t.type === 'expense')
    return sortedTransactions.filter(t => t.type === 'income')
  }, [activeFilter, sortedTransactions])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const transaction of rangedTransactions) {
      if (transaction.kind === 'transfer' || transaction.kind === 'saving') continue
      if (transaction.type === 'income') income += transaction.amount
      else expense += transaction.amount
    }
    return { income, expense }
  }, [rangedTransactions])

  const counts = useMemo(() => ({
    semua: sortedTransactions.length,
    pengeluaran: sortedTransactions.filter(t => t.type === 'expense').length,
    pemasukan: sortedTransactions.filter(t => t.type === 'income').length,
  }), [sortedTransactions])

  const rangeLabel = period
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(period.start)
      + ' - '
      + new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate() - 1))
    : 'Pilih tanggal awal dan akhir yang valid'

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {RANGES.map(r => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              range === r.id
                ? 'bg-[var(--sk-cyan)] text-[#0B0F19]'
                : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] hover:bg-[var(--sk-surface-3)]'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5 mb-4">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="min-w-0">
              <span className="block text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">
                Dari
              </span>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-2.5 py-2 text-xs text-[var(--sk-text)] outline-none focus:border-[var(--sk-cyan)]"
              />
            </label>
            <label className="min-w-0">
              <span className="block text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">
                Sampai
              </span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-2.5 py-2 text-xs text-[var(--sk-text)] outline-none focus:border-[var(--sk-cyan)]"
              />
            </label>
          </div>
          <p className={cn('text-[11px]', period ? 'text-[var(--sk-text-dim)]' : 'text-[var(--sk-red)]')}>
            History: {rangeLabel}
          </p>
        </div>
      )}

      {range !== 'custom' && (
        <p className="text-[11px] text-[var(--sk-text-dim)] mb-3">
          History: {rangeLabel}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5">
          <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">Total keluar</p>
          <p className="text-base font-bold tabular-nums text-[var(--sk-red)]">{formatIDR(totals.expense)}</p>
        </div>
        <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5">
          <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">Total masuk</p>
          <p className="text-base font-bold tabular-nums text-[var(--sk-green)]">{formatIDR(totals.income)}</p>
        </div>
      </div>

      <div className="sticky top-[97px] z-10 bg-[var(--sk-bg)] backdrop-blur-xl py-3 border-y border-[var(--sk-border)] mb-3">
        <FilterTabs active={activeFilter} onChange={setActiveFilter} counts={counts} />
      </div>

      <TransactionList
        transactions={filteredTransactions}
        onDelete={deleteTransaction}
        onUpdate={updateTransaction}
        newTransactionId={newTransactionId}
        className="px-0 md:px-0"
      />
    </div>
  )
}

export const TabRekapan = memo(function TabRekapan() {
  const [view, setView] = useState<RekapView>('kalender')

  return (
    <div className="flex flex-col min-h-full md:ml-[72px]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--sk-bg)] backdrop-blur-xl border-b border-[var(--sk-border)] px-4 md:px-8 py-4">
        <h2 className="text-base font-semibold text-[var(--sk-text)] mb-3">Rekapan</h2>
        {/* Toggle */}
        <div className="inline-flex bg-[var(--sk-surface)] rounded-xl p-1 border border-[var(--sk-border)]" data-tour="rekapan-tabs">
          {(['kalender', 'history', 'tren'] as RekapView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 capitalize',
                view === v
                  ? 'bg-[var(--sk-surface-3)] text-[var(--sk-text)] shadow-sm'
                  : 'text-[var(--sk-text-dim)] hover:text-[var(--sk-text-muted)]'
              )}
            >
              {v === 'kalender' ? 'Kalender' : v === 'history' ? 'History' : 'Tren'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 pt-5 pb-8">
        {view === 'kalender' && <CalendarView />}
        {view === 'history' && <HistoryView />}
        {view === 'tren' && <TrenView />}
      </div>
    </div>
  )
})
