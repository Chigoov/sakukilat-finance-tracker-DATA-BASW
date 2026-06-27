'use client'

import { memo, useMemo } from 'react'
import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePreferenceStore, useTransactionData } from '@/lib/store'
import { formatIDRCompact } from '@/lib/parser'

/**
 * 30-day spending heatmap.
 * Each cell = one day. Color intensity = expense relative to the
 * heaviest spending day in the window. Zero-spend days stay dim
 * so the "ritmic chaos" pattern of weekend splurges, mid-month
 * crashes, and quiet weeks becomes visible at a glance.
 */
function dayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayStart(date: Date, offset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)
}

const DAY_LABELS = ['M', 'S', 'S', 'R', 'K', 'J', 'S']

export const SpendingHeatmap = memo(function SpendingHeatmap() {
  const { transactions } = useTransactionData()
  const { zenMode } = usePreferenceStore()

  const { cells, peak, totalSpent, hottestDayLabel } = useMemo(() => {
    const today = dayStart(new Date())
    const buckets = new Map<string, number>()

    for (const tx of transactions) {
      if (tx.type !== 'expense') continue
      const k = dayKey(dayStart(tx.date))
      buckets.set(k, (buckets.get(k) ?? 0) + tx.amount)
    }

    const cellList: Array<{ key: string; date: Date; total: number; isToday: boolean }> = []
    let peakLocal = 0
    let totalLocal = 0
    let hotDate: Date | null = null

    // Align first cell with weekday header: pad with leading blanks
    const firstDate = dayStart(today, -29)
    const leadOffset = firstDate.getDay() // 0..6, 0 = Sunday (matches DAY_LABELS index)
    for (let i = 0; i < leadOffset; i++) {
      cellList.push({ key: `pad-${i}`, date: firstDate, total: -1, isToday: false })
    }

    for (let offset = -29; offset <= 0; offset++) {
      const d = dayStart(today, offset)
      const k = dayKey(d)
      const total = buckets.get(k) ?? 0
      if (total > peakLocal) { peakLocal = total; hotDate = d }
      totalLocal += total
      cellList.push({ key: k, date: d, total, isToday: offset === 0 })
    }

    const hotLabel = hotDate
      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(hotDate)
      : null

    return { cells: cellList, peak: peakLocal, totalSpent: totalLocal, hottestDayLabel: hotLabel }
  }, [transactions])

  const intensity = (val: number) => {
    if (val <= 0 || peak <= 0) return 0
    return Math.min(1, val / peak)
  }

  return (
    <section className="px-4 md:px-8 pb-4">
      <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-4">
        <header className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--sk-amber-dim)] flex items-center justify-center">
              <Flame className="w-4 h-4 text-[var(--sk-amber)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--sk-text)]">Pola 30 hari</p>
              <p className="text-[10px] text-[var(--sk-text-dim)]">
                {hottestDayLabel
                  ? `Hari paling boros: ${hottestDayLabel}`
                  : 'Belum ada pengeluaran 30 hari terakhir.'}
              </p>
            </div>
          </div>
          <span className={cn('text-[11px] font-bold tabular-nums text-[var(--sk-text-muted)]', zenMode && 'sk-zen-blur')}>
            {formatIDRCompact(totalSpent)}
          </span>
        </header>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {DAY_LABELS.map((label, i) => (
            <span key={`hd-${i}`} className="text-center text-[9px] font-medium uppercase tracking-wide text-[var(--sk-text-dim)]">
              {label}
            </span>
          ))}
          {cells.map(cell => {
            // Placeholder (weekday alignment pad)
            if (cell.total === -1) {
              return <div key={cell.key} className="aspect-square rounded-md opacity-0" aria-hidden />
            }
            const i = intensity(cell.total)
            const alpha = 0.08 + i * 0.92
            return (
              <div
                key={cell.key}
                title={`${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(cell.date)} — ${cell.total > 0 ? formatIDRCompact(cell.total) : 'Tidak ada pengeluaran'}`}
                className={cn(
                  'relative aspect-square rounded-md transition-transform hover:scale-110',
                  cell.isToday && 'ring-1 ring-[var(--sk-cyan)] ring-offset-1 ring-offset-[var(--sk-surface)]'
                )}
                style={{
                  background: cell.total > 0
                    ? `rgba(248, 113, 113, ${alpha})`
                    : 'var(--sk-surface-2)',
                }}
              />
            )
          })}
        </div>

        <footer className="mt-3 flex items-center justify-between text-[9px] text-[var(--sk-text-dim)]">
          <span>30 hari lalu</span>
          <div className="flex items-center gap-1">
            <span>Tenang</span>
            {[0.1, 0.3, 0.55, 0.8, 1].map(a => (
              <span
                key={a}
                className="w-2.5 h-2.5 rounded-[3px]"
                style={{ background: `rgba(248, 113, 113, ${a})` }}
              />
            ))}
            <span>Padat</span>
          </div>
          <span>Hari ini</span>
        </footer>
      </div>
    </section>
  )
})
