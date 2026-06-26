'use client'

import { Gauge } from 'lucide-react'
import { useBudgetStore, useTransactionData } from '@/lib/store'
import { monthlyBudgetStatus } from '@/lib/stats'
import { formatIDRCompact } from '@/lib/parser'
import { cn } from '@/lib/utils'

export function BudgetCard() {
  const { monthlyBudget } = useBudgetStore()
  const { transactions } = useTransactionData()
  const status = monthlyBudgetStatus(transactions, monthlyBudget)
  const pct = Math.min(100, Math.round(status.pctUsed * 100))

  return (
    <section className="px-4 md:px-8 pb-4">
      <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center',
            status.roast ? 'bg-[var(--sk-red-dim)]' : 'bg-[var(--sk-amber-dim)]'
          )}>
            <Gauge className={cn('w-4 h-4', status.roast ? 'text-[var(--sk-red)]' : 'text-[var(--sk-amber)]')} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--sk-text-muted)]">Budget bulan ini</p>
            <p className="text-lg font-bold tabular-nums text-[var(--sk-text)]" data-amount>
              {formatIDRCompact(status.budget)}
            </p>
          </div>
          <span className={cn(
            'ml-auto text-xs font-semibold tabular-nums',
            status.roast ? 'text-[var(--sk-red)]' : pct > 75 ? 'text-[var(--sk-amber)]' : 'text-[var(--sk-green)]'
          )}>
            {pct}%
          </span>
        </div>

        <div className="h-2 rounded-full bg-[var(--sk-surface-2)] overflow-hidden mb-3">
          <div
            className={cn('h-full rounded-full', status.roast ? 'bg-[var(--sk-red)]' : 'bg-[var(--sk-cyan)]')}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-[var(--sk-text-dim)]">Terpakai</p>
            <p className="font-semibold tabular-nums text-[var(--sk-red)]">{formatIDRCompact(status.spent)}</p>
          </div>
          <div>
            <p className="text-[var(--sk-text-dim)]">Jatah/hari</p>
            <p className="font-semibold tabular-nums text-[var(--sk-cyan)]">{formatIDRCompact(status.dynamicDailyBudget)}</p>
          </div>
          <div>
            <p className="text-[var(--sk-text-dim)]">Hari tersisa</p>
            <p className="font-semibold tabular-nums text-[var(--sk-text)]">{status.remainingDays}</p>
          </div>
        </div>

        {status.roast && (
          <p className="mt-3 text-xs leading-relaxed text-[var(--sk-red)]">
            {status.roast}
          </p>
        )}
      </div>
    </section>
  )
}
