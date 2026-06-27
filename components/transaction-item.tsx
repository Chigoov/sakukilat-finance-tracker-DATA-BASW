'use client'

import { useState } from 'react'
import { ArrowRightLeft, Check, ChevronRight, Pencil, PiggyBank, Trash2, X } from 'lucide-react'
import { formatIDR, formatTime } from '@/lib/parser'
import type { Transaction } from '@/lib/mock-data'
import type { TransactionUpdateInput } from '@/lib/store'
import { CategoryIcon, getCategoryConfig, getPaymentLabel } from './category-badge'
import { cn } from '@/lib/utils'

interface TransactionItemProps {
  transaction: Transaction
  onDelete?: (id: string) => void
  onUpdate?: (id: string, updates: TransactionUpdateInput) => void
  isNew?: boolean
}

export function TransactionItem({ transaction, onDelete, onUpdate, isNew }: TransactionItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDescription, setEditDescription] = useState(transaction.description)
  const [editAmount, setEditAmount] = useState(String(transaction.amount))

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

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(true)
    setEditing(true)
    setEditDescription(transaction.description)
    setEditAmount(String(transaction.amount))
  }

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(false)
    setEditDescription(transaction.description)
    setEditAmount(String(transaction.amount))
  }

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdate?.(transaction.id, {
      description: editDescription,
      amount: Number(editAmount),
    })
    setEditing(false)
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
                <span className="font-medium text-[var(--sk-text-muted)]">
                  {transaction.isPending ? 'Menyimpan...' : 'Lokal di perangkat ini'}
                </span>
              </div>
            </div>

            {editing && (
              <div className="mt-3 grid gap-2" onClick={e => e.stopPropagation()}>
                <input
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="h-10 rounded-lg bg-[var(--sk-surface-2)] border border-[var(--sk-border)] px-3 text-sm text-[var(--sk-text)] outline-none focus:border-[var(--sk-cyan)]"
                  aria-label="Edit deskripsi transaksi"
                />
                <input
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  inputMode="numeric"
                  className="h-10 rounded-lg bg-[var(--sk-surface-2)] border border-[var(--sk-border)] px-3 text-sm text-[var(--sk-text)] outline-none focus:border-[var(--sk-cyan)]"
                  aria-label="Edit nominal transaksi"
                />
              </div>
            )}

            {(onUpdate || onDelete) && !transaction.isPending && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={saveEdit}
                      className="min-h-9 px-3 rounded-lg bg-[var(--sk-cyan-dim)] text-[var(--sk-cyan)] text-xs font-semibold flex items-center gap-1.5"
                      aria-label="Simpan perubahan transaksi"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Simpan
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="min-h-9 px-3 rounded-lg bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] text-xs font-semibold flex items-center gap-1.5"
                      aria-label="Batalkan edit transaksi"
                    >
                      <X className="w-3.5 h-3.5" />
                      Batal
                    </button>
                  </>
                ) : (
                  onUpdate && (
                    <button
                      onClick={startEdit}
                      className="min-h-9 px-3 rounded-lg bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] hover:text-[var(--sk-cyan)] transition-colors text-xs font-semibold flex items-center gap-1.5"
                      aria-label="Edit transaksi"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )
                )}

                {onDelete && !editing && (
                  <button
                    onClick={handleDelete}
                    className="min-h-9 px-3 rounded-lg bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] hover:text-[var(--sk-red)] transition-colors text-xs font-semibold flex items-center gap-1.5"
                    aria-label="Hapus transaksi"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
