'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ArrowRightLeft, PiggyBank, SendHorizonal, Sparkles, X, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { parseEntry, splitEntries, formatIDR, type ParserExtras, type ParsedEntry } from '@/lib/parser'
import { cn } from '@/lib/utils'
import { getCategoryConfig, getPaymentLabel } from './category-badge'

interface ParsePreview {
  kind: 'transaction' | 'transfer' | 'saving'
  description: string
  amount: number
  type?: 'expense' | 'income'
  category?: string
  paymentMethod?: string
  fromWalletId?: string
  toWalletId?: string
  confidence: number
  warning?: string
  extraCount?: number   // jumlah transaksi tambahan pada input multi-item
  totalAmount?: number  // total nominal seluruh segmen (untuk input multi-item)
}

const EXAMPLE_HINTS = [
  'makan soto 25k gopay',
  'gaji 5jt bca',
  'bonus 500k gopay',
  'bensin 50rb tunai',
  'bayar listrik 200rb bca',
  'kopi 18.500 ovo',
  'belanja shopee 299rb shopeepay',
  'netflix 186rb kartu',
  'grab 18k dana',
]

const INCOME_HINTS = [
  '100000 shopee',
  'gaji 5jt bca',
  'bonus 500k gopay',
  'jual barang 250rb',
  'cashback 25k dana',
]

const EXPENSE_HINTS = [
  'makan soto 25k gopay',
  'bensin 50rb tunai',
  'kopi 18.500 ovo',
  'belanja 299rb shopeepay',
  'listrik 200rb bca',
]

interface SmartInputProps {
  onSubmit: (input: string) => boolean | void | Promise<boolean | void>
  isSubmitting?: boolean
  className?: string
  parserExtras?: ParserExtras
  autoFocus?: boolean
}

type InputMode = 'auto' | 'expense' | 'income'

export function SmartInput({ onSubmit, isSubmitting, className, parserExtras, autoFocus }: SmartInputProps) {
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState<ParsePreview | null>(null)
  const [focused, setFocused] = useState(false)
  const [hintIndex, setHintIndex] = useState(0)
  const [localSubmitting, setLocalSubmitting] = useState(false)
  const [mode, setMode] = useState<InputMode>('auto')
  const inputRef = useRef<HTMLInputElement>(null)
  const locked = Boolean(isSubmitting || localSubmitting)
  // Memberi awalan "masuk " per-segmen agar input multi-item bermode pemasukan
  // tetap dikenali sebagai pemasukan di setiap segmennya.
  const withModePrefix = useCallback(
    (segment: string) => (mode === 'income' ? `masuk ${segment}` : segment),
    [mode]
  )
  const activeHints = useMemo(() => {
    if (mode === 'income') return INCOME_HINTS
    if (mode === 'expense') return EXPENSE_HINTS
    return EXAMPLE_HINTS
  }, [mode])
  const placeholderHint = activeHints[hintIndex % activeHints.length]

  // Cycle through example hints
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex(i => (i + 1) % activeHints.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [activeHints.length])

  // Optional autofocus (desktop top bar)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Live parse preview — kini sadar multi-item: input gabungan dipecah per-segmen
  // sehingga pengguna melihat transaksi PERTAMA + indikator "+N" dan total nominal.
  useEffect(() => {
    const raw = value.trim()
    if (!raw) {
      setPreview(null)
      return
    }

    const entries: ParsedEntry[] = splitEntries(raw)
      .map(segment => parseEntry(withModePrefix(segment), parserExtras))
      .filter((entry): entry is ParsedEntry => entry !== null && entry.amount > 0)

    if (entries.length === 0) {
      setPreview(null)
      return
    }

    const [first, ...rest] = entries
    const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0)
    const extraCount = rest.length

    if (first.kind === 'transfer' || first.kind === 'saving') {
      setPreview({
        kind: first.kind,
        description: first.description,
        amount: first.amount,
        fromWalletId: first.fromWalletId,
        toWalletId: first.toWalletId,
        confidence: first.confidence,
        warning: first.warning,
        extraCount,
        totalAmount,
      })
    } else {
      setPreview({
        kind: 'transaction',
        description: first.description,
        amount: first.amount,
        type: first.type,
        category: first.category,
        paymentMethod: first.paymentMethod,
        confidence: first.confidence,
        warning: first.warning,
        extraCount,
        totalAmount,
      })
    }
  }, [value, parserExtras, withModePrefix])

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed || locked) return

    // PATCH: pecah input multi-item menjadi beberapa segmen, lalu submit satu per
    // satu secara berurutan. Tiap segmen melewati pipeline parser yang sama persis,
    // sehingga "kopi 18k spay sama parkir 2rb tunai" tercatat sebagai DUA transaksi
    // utuh — bukan satu transaksi dengan nominal terakhir saja.
    const segments = splitEntries(trimmed).map(withModePrefix)

    setLocalSubmitting(true)
    try {
      let allOk = true
      for (const segment of segments) {
        const ok = await Promise.resolve(onSubmit(segment))
        if (ok === false) allOk = false
      }
      // Hanya bersihkan input bila SELURUH segmen berhasil; jika ada yang gagal,
      // teks dibiarkan agar pengguna bisa memperbaiki tanpa kehilangan ketikannya.
      if (allOk) {
        setValue('')
        setPreview(null)
      }
    } finally {
      setLocalSubmitting(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [value, locked, withModePrefix, onSubmit])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setValue('')
      setPreview(null)
      inputRef.current?.blur()
    }
  }

  const categoryConfig = preview?.category ? getCategoryConfig(preview.category) : null
  const CategoryIcon = categoryConfig?.icon
  const MoveIcon = preview?.kind === 'saving' ? PiggyBank : ArrowRightLeft

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-2 grid grid-cols-3 gap-1.5 px-1">
        {([
          ['auto', Sparkles, 'Auto'],
          ['expense', TrendingDown, 'Keluar'],
          ['income', TrendingUp, 'Masuk'],
        ] as Array<[InputMode, React.ComponentType<{ className?: string }>, string]>).map(([itemMode, Icon, label]) => (
          <button
            key={itemMode}
            type="button"
            onClick={() => setMode(itemMode)}
            className={cn(
              'h-8 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-colors',
              mode === itemMode
                ? itemMode === 'income'
                  ? 'bg-[var(--sk-green)] border-[var(--sk-green)] text-[#090D16]'
                  : itemMode === 'expense'
                  ? 'bg-[var(--sk-red)] border-[var(--sk-red)] text-[#090D16]'
                  : 'bg-[var(--sk-cyan)] border-[var(--sk-cyan)] text-[#090D16]'
                : 'bg-[var(--sk-surface-2)] border-[var(--sk-border)] text-[var(--sk-text-muted)]'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Parse preview pill */}
      {preview && focused && (
        <div className="animate-slide-up mb-2 px-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border-2)]">
            {preview.kind !== 'transaction' ? (
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--sk-cyan-dim)]">
                <MoveIcon className="w-3.5 h-3.5 text-[var(--sk-cyan)]" />
              </div>
            ) : CategoryIcon && categoryConfig ? (
              <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', categoryConfig.bg)}>
                <CategoryIcon className={cn('w-3.5 h-3.5', categoryConfig.color)} />
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <span className="text-xs text-[var(--sk-text-muted)] mr-1.5 capitalize truncate">
                {preview.description}
              </span>
              {preview.extraCount ? (
                <span className="text-[10px] font-semibold text-[var(--sk-cyan)] bg-[var(--sk-cyan-dim)] rounded px-1.5 py-0.5 mr-1.5">
                  +{preview.extraCount} transaksi lagi
                </span>
              ) : null}
              {preview.warning && (
                <span className="text-[10px] text-[var(--sk-amber)] mr-1.5">
                  {preview.warning}
                </span>
              )}
              <span className="text-[var(--sk-text-dim)] text-xs">·</span>
              <span className="text-xs text-[var(--sk-text-muted)] mx-1.5 capitalize">
                {preview.kind === 'transaction'
                  ? getPaymentLabel(preview.paymentMethod ?? 'tunai')
                  : `${getPaymentLabel(preview.fromWalletId ?? '')} -> ${getPaymentLabel(preview.toWalletId ?? '')}`}
              </span>
            </div>
            <span
              className={cn(
                'text-sm font-bold tabular-nums flex-shrink-0',
                preview.kind !== 'transaction'
                  ? 'text-[var(--sk-cyan)]'
                  : preview.type === 'expense' ? 'text-[var(--sk-red)]' : 'text-[var(--sk-green)]'
              )}
              data-amount
            >
              {preview.kind !== 'transaction' ? '' : preview.type === 'expense' ? '-' : '+'}{formatIDR(preview.extraCount ? (preview.totalAmount ?? preview.amount) : preview.amount)}
            </span>
            {/* Confidence indicator */}
            <div
              title={`Tingkat keyakinan: ${Math.round(preview.confidence * 100)}%`}
              className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                preview.confidence >= 0.9 ? 'bg-[var(--sk-green)]' :
                preview.confidence >= 0.7 ? 'bg-[var(--sk-amber)]' :
                'bg-[var(--sk-text-dim)]'
              )}
            />
          </div>
        </div>
      )}

      {/* Input container */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 rounded-2xl transition-all duration-200',
          'bg-[var(--sk-surface-2)] border',
          focused
            ? 'border-[var(--sk-cyan)] shadow-[0_0_0_3px_var(--sk-cyan-glow)]'
            : 'border-[var(--sk-border-2)]'
        )}
      >
        {/* Sparkle icon */}
        <div className={cn(
          'flex-shrink-0 transition-colors duration-200',
          focused ? 'text-[var(--sk-cyan)]' : 'text-[var(--sk-text-dim)]'
        )}>
          <Sparkles className="w-4 h-4" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={locked}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={`cth. "${placeholderHint}"`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          aria-label="Input transaksi bahasa natural"
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none border-none',
            'text-sm text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)]',
            'caret-[var(--sk-cyan)] disabled:cursor-not-allowed disabled:opacity-60'
          )}
        />

        {/* Clear / Submit */}
        {value && (
          <button
            type="button"
            onClick={() => { setValue(''); setPreview(null); inputRef.current?.focus() }}
            disabled={locked}
            className="text-[var(--sk-text-dim)] hover:text-[var(--sk-text-muted)] flex-shrink-0"
            aria-label="Bersihkan input"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || locked}
          aria-label="Tambah transaksi"
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200',
            value.trim() && !locked
              ? mode === 'income'
                ? 'bg-[var(--sk-green)] text-[#0B0F19] shadow-[0_0_12px_rgba(52,211,153,0.24)] hover:opacity-90 active:scale-95'
                : 'bg-[var(--sk-cyan)] text-[#0B0F19] shadow-[0_0_12px_var(--sk-cyan-glow)] hover:opacity-90 active:scale-95'
              : 'bg-[var(--sk-surface-3)] text-[var(--sk-text-dim)]'
          )}
        >
          {locked ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <SendHorizonal className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Helper text */}
      {!focused && !value && (
        <p className="text-center text-[10px] text-[var(--sk-text-dim)] mt-2 leading-relaxed px-2">
          Tulis transaksi pakai bahasa natural • tekan Enter untuk menyimpan
        </p>
      )}
    </div>
  )
}
