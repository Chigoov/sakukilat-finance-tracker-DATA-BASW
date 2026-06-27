'use client'

/**
 * SakuKilat — Manual Entry Form
 * ─────────────────────────────
 * Escape hatch when the natural-language parser fails (or when the user
 * just wants explicit control). Surfaced from SmartInput via a button next
 * to the voice mic. Renders as a centred modal-style bottom-sheet so the
 * controls all land inside the thumb-zone.
 *
 * Why a separate component (not part of SmartInput): SmartInput already
 * carries 470+ lines and a complex parser-preview state machine. Mixing
 * a stateful form into it would make both harder to reason about.
 *
 * Optional `seedInput` lets the parent prefill the description field with
 * the unparseable text the user just typed — so they don't lose their
 * keystrokes when switching modes.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  useCustomizationStore,
  useTransactionActions,
  useWalletStore,
} from '@/lib/store'
import { CATEGORY_CONFIG } from '@/components/category-badge'
import { parseAmountInput } from '@/lib/amount'
import { formatIDR } from '@/lib/parser'
import type { Category } from '@/lib/parser'
import { cn } from '@/lib/utils'

interface ManualEntryFormProps {
  open: boolean
  onClose: () => void
  /** Optional pre-fill for the description field (passes the user's
   *  original NL input through when they hit "manual" after a failed parse). */
  seedInput?: string
}

type EntryType = 'expense' | 'income'

// Categories that make semantic sense for expense (everything except income types)
const INCOME_CATEGORY_IDS = new Set(['gaji', 'freelance', 'investasi', 'penjualan', 'cashback', 'refund', 'hadiah'])

export const ManualEntryForm = memo(function ManualEntryForm({
  open, onClose, seedInput,
}: ManualEntryFormProps) {
  const { wallets } = useWalletStore()
  const { customCategories } = useCustomizationStore()
  const { addManualTransaction } = useTransactionActions()

  const [type, setType]                       = useState<EntryType>('expense')
  const [description, setDescription]         = useState('')
  const [amountRaw, setAmountRaw]             = useState('')
  const [category, setCategory]               = useState<string>('lainnya')
  const [paymentMethod, setPaymentMethod]     = useState<string>('')
  const [submitting, setSubmitting]           = useState(false)

  // Reset whenever the modal opens
  useEffect(() => {
    if (!open) return
    setType('expense')
    setDescription(seedInput?.trim() ?? '')
    setAmountRaw('')
    setCategory('lainnya')
    // Default to first wallet so user always has a target.
    setPaymentMethod(wallets[0]?.id ?? 'tunai')
    setSubmitting(false)
  }, [open, seedInput, wallets])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const parsedAmount = useMemo(() => parseAmountInput(amountRaw), [amountRaw])
  const canSubmit = !!parsedAmount && !!description.trim() && !!paymentMethod && !submitting

  // Categories list: built-in (filtered by type) + custom (always shown)
  const categoryOptions = useMemo(() => {
    const allBuiltIn = Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => ({
      id, label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg, isCustom: false,
    }))
    const filtered = allBuiltIn.filter(b => {
      // Always allow "lainnya" and "transfer". Otherwise filter by income/expense relevance.
      if (b.id === 'lainnya' || b.id === 'transfer') return true
      if (type === 'income') return INCOME_CATEGORY_IDS.has(b.id)
      return !INCOME_CATEGORY_IDS.has(b.id)
    })
    const custom = customCategories.map(c => ({
      id: c.id, label: c.label,
      icon: CATEGORY_CONFIG.lainnya.icon,
      color: CATEGORY_CONFIG.lainnya.color,
      bg: CATEGORY_CONFIG.lainnya.bg,
      isCustom: true,
    }))
    return [...filtered, ...custom]
  }, [type, customCategories])

  // If user switches type and the current category isn't valid anymore, snap
  // back to a safe default. Otherwise leave their pick alone.
  useEffect(() => {
    if (!categoryOptions.some(c => c.id === category)) {
      setCategory(type === 'income' ? 'gaji' : 'lainnya')
    }
  }, [type, categoryOptions, category])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !parsedAmount) return
    setSubmitting(true)
    const ok = await addManualTransaction({
      description: description.trim(),
      amount: parsedAmount,
      type,
      category,
      paymentMethod,
    })
    setSubmitting(false)
    if (ok) onClose()
  }, [canSubmit, parsedAmount, description, type, category, paymentMethod, addManualTransaction, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sk-manual-title"
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center px-3 py-4 bg-[rgba(9,13,22,0.78)] backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border-2)] shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--sk-border)] flex-shrink-0">
          <div className="flex flex-col">
            <h2 id="sk-manual-title" className="text-sm font-semibold text-[var(--sk-text)]">
              Catat manual
            </h2>
            <p className="text-[11px] text-[var(--sk-text-dim)] mt-0.5">
              Kontrol penuh nominal, kategori, dan saku.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-text)] hover:bg-[var(--sk-surface-2)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                'flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors',
                type === 'expense'
                  ? 'bg-[var(--sk-red-dim)] text-[var(--sk-red)] border border-[var(--sk-red)]'
                  : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] border border-transparent hover:text-[var(--sk-text)]'
              )}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={cn(
                'flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors',
                type === 'income'
                  ? 'bg-[var(--sk-green-dim)] text-[var(--sk-green)] border border-[var(--sk-green)]'
                  : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] border border-transparent hover:text-[var(--sk-text)]'
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Pemasukan
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-medium text-[var(--sk-text-dim)]">
              Deskripsi
            </label>
            <input
              type="text"
              autoFocus
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="cth. Mie ayam Pak Slamet"
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border)] text-sm text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] focus:outline-none focus:border-[var(--sk-cyan)] caret-[var(--sk-cyan)]"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-medium text-[var(--sk-text-dim)] flex items-center justify-between">
              <span>Nominal</span>
              {parsedAmount && (
                <span className={cn(
                  'text-[11px] font-bold tabular-nums normal-case tracking-normal',
                  type === 'expense' ? 'text-[var(--sk-red)]' : 'text-[var(--sk-green)]'
                )}>
                  {type === 'expense' ? '-' : '+'}{formatIDR(parsedAmount)}
                </span>
              )}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountRaw}
              onChange={e => setAmountRaw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
              placeholder="cth. 50000, 50rb, 1,5jt"
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border)] text-sm text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] focus:outline-none focus:border-[var(--sk-cyan)] caret-[var(--sk-cyan)] tabular-nums"
            />
          </div>

          {/* Wallet */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-medium text-[var(--sk-text-dim)]">
              Saku (sumber dana)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
              {wallets.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setPaymentMethod(w.id)}
                  className={cn(
                    'px-2 py-2 rounded-lg text-[11px] font-medium transition-colors truncate text-left',
                    paymentMethod === w.id
                      ? 'bg-[var(--sk-cyan-dim)] text-[var(--sk-cyan)] border border-[var(--sk-cyan)]'
                      : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] border border-transparent hover:text-[var(--sk-text)]'
                  )}
                  title={`${w.label} · Rp ${w.balance.toLocaleString('id-ID')}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-medium text-[var(--sk-text-dim)]">
              Kategori
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-1">
              {categoryOptions.map(c => {
                const Icon = c.icon
                const active = category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      'px-2 py-2 rounded-lg flex flex-col items-center gap-1 transition-colors',
                      active
                        ? cn(c.bg, c.color, 'border border-current')
                        : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] border border-transparent hover:text-[var(--sk-text)]'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium truncate w-full text-center">
                      {c.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {customCategories.length === 0 && (
              <p className="text-[10px] text-[var(--sk-text-dim)] mt-1.5 leading-relaxed">
                Bisa tambah kategori sendiri di <strong className="text-[var(--sk-text-muted)]">Saku → Kategori</strong>.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--sk-border)] flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-11 rounded-xl text-sm font-medium text-[var(--sk-text-muted)] hover:text-[var(--sk-text)] hover:bg-[var(--sk-surface-2)] transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-opacity',
              canSubmit
                ? type === 'expense'
                  ? 'bg-[var(--sk-red)] text-[var(--sk-bg)] hover:opacity-90'
                  : 'bg-[var(--sk-green)] text-[var(--sk-bg)] hover:opacity-90'
                : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-dim)] cursor-not-allowed'
            )}
          >
            {type === 'expense' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
            {submitting ? 'Menyimpan…' : type === 'expense' ? 'Catat pengeluaran' : 'Catat pemasukan'}
          </button>
        </div>
      </div>
    </div>
  )
})
