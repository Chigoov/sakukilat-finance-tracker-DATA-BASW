'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowRightLeft, PiggyBank, SendHorizonal, Sparkles, X, Loader2 } from 'lucide-react'
import { parseEntry, formatIDR, type ParserExtras } from '@/lib/parser'
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
}

const EXAMPLE_HINTS = [
  'makan soto 25k gopay',
  'terima gaji 5jt transfer',
  'bensin 50rb tunai',
  'bayar listrik 200rb bca',
  'kopi 18.500 ovo',
  'belanja shopee 299rb shopeepay',
  'netflix 186rb kartu',
  'grab 18k dana',
]

interface SmartInputProps {
  onSubmit: (input: string) => void
  isSubmitting?: boolean
  className?: string
  parserExtras?: ParserExtras
  autoFocus?: boolean
}

export function SmartInput({ onSubmit, isSubmitting, className, parserExtras, autoFocus }: SmartInputProps) {
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState<ParsePreview | null>(null)
  const [focused, setFocused] = useState(false)
  const [hintIndex, setHintIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cycle through example hints
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex(i => (i + 1) % EXAMPLE_HINTS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Optional autofocus (desktop top bar)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Live parse preview
  useEffect(() => {
    if (!value.trim()) {
      setPreview(null)
      return
    }
    const parsed = parseEntry(value, parserExtras)
    if (parsed && parsed.amount > 0) {
      if (parsed.kind === 'transfer' || parsed.kind === 'saving') {
        setPreview({
          kind: parsed.kind,
          description: parsed.description,
          amount: parsed.amount,
          fromWalletId: parsed.fromWalletId,
          toWalletId: parsed.toWalletId,
          confidence: parsed.confidence,
        })
      } else {
        setPreview({
          kind: 'transaction',
          description: parsed.description,
          amount: parsed.amount,
          type: parsed.type,
          category: parsed.category,
          paymentMethod: parsed.paymentMethod,
          confidence: parsed.confidence,
        })
      }
    } else {
      setPreview(null)
    }
  }, [value, parserExtras])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isSubmitting) return
    onSubmit(trimmed)
    setValue('')
    setPreview(null)
    inputRef.current?.focus()
  }, [value, isSubmitting, onSubmit])

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
              {preview.kind !== 'transaction' ? '' : preview.type === 'expense' ? '-' : '+'}{formatIDR(preview.amount)}
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={`cth. "${EXAMPLE_HINTS[hintIndex]}"`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          aria-label="Input transaksi bahasa natural"
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none border-none',
            'text-sm text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)]',
            'caret-[var(--sk-cyan)]'
          )}
        />

        {/* Clear / Submit */}
        {value && (
          <button
            type="button"
            onClick={() => { setValue(''); setPreview(null); inputRef.current?.focus() }}
            className="text-[var(--sk-text-dim)] hover:text-[var(--sk-text-muted)] flex-shrink-0"
            aria-label="Bersihkan input"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || isSubmitting}
          aria-label="Tambah transaksi"
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200',
            value.trim() && !isSubmitting
              ? 'bg-[var(--sk-cyan)] text-[#0B0F19] shadow-[0_0_12px_var(--sk-cyan-glow)] hover:opacity-90 active:scale-95'
              : 'bg-[var(--sk-surface-3)] text-[var(--sk-text-dim)]'
          )}
        >
          {isSubmitting ? (
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
