'use client'

import { useState } from 'react'
import { ArrowRightLeft, ChevronRight, PiggyBank, Trash2 } from 'lucide-react'
import { formatIDR, formatTime } from '@/lib/parser'
import type { Transaction } from '@/lib/mock-data'
import { CategoryIcon, SyncDot, getCategoryConfig, getPaymentLabel } from './category-badge'
import { cn } from '@/lib/utils'

interface TransactionItemProps {
  transaction: Transaction
  onDelete?: (id: string) => void
  isNew?: boolean
}

export function TransactionItem({ transaction, onDelete, isNew }: TransactionItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const kind = transaction.kind ?? 'transaction'
  const isMove = kind === 'transfer' || kind === 'saving'
  const isExpense = transaction.type === 'expense'
  const config = getCategoryConfig(transaction.category)
  const MoveIcon = kind === 'saving' ? PiggyBank : ArrowRightLeft
  const routeLabel = `${getPaymentLabel(transaction.fromWalletId ?? transaction.paymentMethod)} -> ${getPaymentLabel(transaction.toWalletId ?? '')}`
  const typeLabel = isMove ? (kind === 'saving' ? 'Simpan' : 'Pindah') : isExpense ? 'Pengeluaran' : 'Pemasukan'
  const signedAmount = `${isMove ? '' : isExpense ? '-' : '+'}${formatIDR(transaction.amount)}`

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleting(true)
    setTimeout(() => {
      onDelete?.(transaction.id)
    }, 300)
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border transition-all duration-300 cursor-pointer select-none',
        'bg-[var(--sk-surface)] border-[var(--sk-border)]',
        'hover:border-[var(--sk-border-2)] hover:bg-[var(--sk-surface-2)]',
        'active:scale-[0.99]',
        isNew && 'animate-pop-in',
        deleting && 'opacity-0 scale-95 pointer-events-none',
        transaction.isPending && 'opacity-70',
        expanded && 'border-[var(--sk-border-2)]'
      )}
      onClick={() => setExpanded(e => !e)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={e => e.key === 'Enter' && setExpanded(x => !x)}
    >
      {transaction.isPending && (
        <div aria-hidden className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-[shimmer_1.5s_ease-in-out_infinite] -skew-x-12" />
        </div>
      )}

      <div className="flex items-center gap-3 p-3.5">
        {isMove ? (
          <div className="w-10 h-10 rounded-xl bg-[var(--sk-cyan-dim)] flex items-center justify-center flex-shrink-0">
            <MoveIcon className="w-5 h-5 text-[var(--sk-cyan)]" />
          </div>
        ) : (
          <CategoryIcon category={transaction.category} size="md" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-[var(--sk-text)] truncate leading-tight capitalize">
              {transaction.description}
            </span>
            <SyncDot status={transaction.syncStatus} />
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
            <span className="text-xs text-[var(--sk-text-muted)] shrink-0">
              {isMove ? typeLabel : config.label}
            </span>
            <span className="text-[var(--sk-text-dim)] text-xs shrink-0">.</span>
            <span className="text-xs text-[var(--sk-text-muted)] min-w-0 break-words">
              {isMove ? routeLabel : getPaymentLabel(transaction.paymentMethod)}
            </span>
            <span className="text-[var(--sk-text-dim)] text-xs shrink-0">.</span>
            <span className="text-xs text-[var(--sk-text-dim)] shrink-0">
              {formatTime(transaction.date)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span
              className={cn(
                'text-sm font-bold tabular-nums leading-tight block',
                isMove ? 'text-[var(--sk-cyan)]' : isExpense ? 'text-[var(--sk-red)]' : 'text-[var(--sk-green)]'
              )}
              data-amount
            >
              {signedAmount}
            </span>
          </div>
          <ChevronRight
            className={cn(
              'w-4 h-4 text-[var(--sk-text-dim)] flex-shrink-0 transition-transform duration-200',
              expanded && 'rotate-90'
            )}
          />
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 animate-slide-up">
          <div className="pt-2.5 border-t border-[var(--sk-border)]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-[var(--sk-text-dim)] block mb-0.5">Tipe</span>
                <span className={cn(
                  'font-medium',
                  isMove ? 'text-[var(--sk-cyan)]' : isExpense ? 'text-[var(--sk-red)]' : 'text-[var(--sk-green)]'
                )}>
                  {typeLabel}
                </span>
              </div>
              <div>
                <span className="text-[var(--sk-text-dim)] block mb-0.5">Jumlah</span>
                <span className="font-semibold tabular-nums text-[var(--sk-text)]" data-amount>
                  {formatIDR(transaction.amount)}
                </span>
              </div>
              <div>
                <span className="text-[var(--sk-text-dim)] block mb-0.5">{isMove ? 'Rute' : 'Metode'}</span>
                <span className="font-medium text-[var(--sk-text)]">
                  {isMove ? routeLabel : getPaymentLabel(transaction.paymentMethod)}
                </span>
              </div>
              <div>
                <span className="text-[var(--sk-text-dim)] block mb-0.5">Status</span>
                <span className={cn(
                  'font-medium',
                  transaction.syncStatus === 'synced' && 'text-[var(--sk-green)]',
                  transaction.syncStatus === 'syncing' && 'text-[var(--sk-amber)]',
                  transaction.syncStatus === 'error' && 'text-[var(--sk-red)]',
                  !transaction.syncStatus && 'text-[var(--sk-text-muted)]'
                )}>
                  {transaction.isPending
                    ? 'Menyimpan...'
                    : transaction.syncStatus === 'synced' ? 'Tersimpan'
                    : transaction.syncStatus === 'syncing' ? 'Menyinkronkan'
                    : transaction.syncStatus === 'error' ? 'Gagal'
                    : 'Lokal'}
                </span>
              </div>
            </div>

            {onDelete && !transaction.isPending && (
              <button
                onClick={handleDelete}
                className="mt-3 flex items-center gap-1.5 text-xs text-[var(--sk-text-muted)] hover:text-[var(--sk-red)] transition-colors py-1"
                aria-label="Hapus transaksi"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus transaksi
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
