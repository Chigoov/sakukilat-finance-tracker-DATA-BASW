'use client'

/**
 * SakuKilat — First-run Onboarding Tour
 * ──────────────────────────────────────
 * Shows a 4-slide guided intro ONCE for genuinely new users. Never loops.
 *
 * "Once" semantics:
 *  - We persist a completion flag in localStorage under a versioned key.
 *    Bumping the version (ONBOARDING_VERSION) re-triggers the tour for
 *    every user, which we intentionally do not do on patch releases.
 *  - On mount we also check whether the user already has any persisted
 *    state from a previous session (`sakukilat:v2:local-state`). If they
 *    do, we treat them as a returning user and silently mark the tour
 *    as completed — no one who has used the app before should be forced
 *    through it. This catches users who upgrade from a pre-onboarding
 *    build of the app.
 *  - Closing the tour via the X button or "Selesai" both count as
 *    completion. There is no skip-vs-finish distinction — once seen,
 *    it's done.
 *  - SSR-safe: nothing reads localStorage before the component mounts.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  EyeOff,
  Mic,
  Repeat,
  Split,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Storage ──────────────────────────────────────────────────────────────────
const ONBOARDING_VERSION = 1
const ONBOARDING_KEY = `sakukilat:v2:onboarding-completed-v${ONBOARDING_VERSION}`
const EXISTING_STATE_KEY = 'sakukilat:v2:local-state'

function readCompleted(): boolean {
  if (typeof window === 'undefined') return true // SSR: assume completed, decide on client
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    return true // private mode / quota — fail-closed so we don't spam the user
  }
}

function writeCompleted(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    /* ignore */
  }
}

function hasExistingLocalState(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(EXISTING_STATE_KEY) !== null
  } catch {
    return false
  }
}

// ── Slide content ────────────────────────────────────────────────────────────
interface Slide {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  body: string
  example?: string
}

const SLIDES: Slide[] = [
  {
    icon: Sparkles,
    iconColor: 'text-[var(--sk-cyan)]',
    iconBg: 'bg-[var(--sk-cyan-dim)]',
    title: 'Cukup ketik kayak ngobrol',
    body:
      'Lupain form berisi dropdown. Tulis aja transaksinya pakai bahasa kamu — Smart Input ngerti nominal, kategori, dan metode bayar otomatis.',
    example: 'kopi kenangan 18k spay',
  },
  {
    icon: Split,
    iconColor: 'text-[var(--sk-amber)]',
    iconBg: 'bg-[var(--sk-amber-dim)]',
    title: 'Patungan? Tinggal "bagi N"',
    body:
      'Bayar bareng temen, gak perlu kalkulator. Tambahin "bagi 2" atau "bagi 3" di akhir, nominal otomatis dibagi rata.',
    example: 'grab 60k bagi 3 gopay',
  },
  {
    icon: EyeOff,
    iconColor: 'text-[var(--sk-green)]',
    iconBg: 'bg-[var(--sk-green-dim)]',
    title: 'Tahan saldo untuk Zen Mode',
    body:
      'Stres lihat angka di tempat umum? Tahan ~0.5 detik di kartu saldo. Semua nominal nge-blur sampai kamu tahan lagi.',
    example: '🤚 Long-press → Zen on',
  },
  {
    icon: Repeat,
    iconColor: 'text-[var(--sk-cyan)]',
    iconBg: 'bg-[var(--sk-cyan-dim)]',
    title: 'Otomatis untuk yang berulang',
    body:
      'Gaji, langganan, cicilan — set sekali di Tab Saku, sisanya jalan sendiri. Tiap kamu buka app, transaksi yang due tercatat otomatis.',
    example: 'spotify 54k debit · tiap bulan',
  },
]

// ── Component ────────────────────────────────────────────────────────────────
export const OnboardingTour = memo(function OnboardingTour() {
  // Tri-state: null = still checking, false = needs to show, true = already done.
  // We do the storage probe in an effect so SSR HTML stays clean.
  const [resolved, setResolved] = useState<boolean | null>(null)
  const [index, setIndex] = useState(0)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (readCompleted()) {
      setResolved(true)
      return
    }
    // Returning user without an onboarding flag (= upgraded from a previous
    // version that didn't have onboarding). Silently mark complete.
    if (hasExistingLocalState()) {
      writeCompleted()
      setResolved(true)
      return
    }
    setResolved(false)
  }, [])

  const total = SLIDES.length
  const slide = SLIDES[index]
  const isLast = index === total - 1
  const isFirst = index === 0

  const next = useCallback(() => {
    if (isLast) return
    setIndex(i => Math.min(total - 1, i + 1))
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8)
    }
  }, [isLast, total])

  const prev = useCallback(() => {
    if (isFirst) return
    setIndex(i => Math.max(0, i - 1))
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8)
    }
  }, [isFirst])

  const dismiss = useCallback(() => {
    setClosing(true)
    // Persist immediately so a fast reload during the fade-out also counts.
    writeCompleted()
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([10, 30, 10])
    }
    // Unmount after the fade transition completes.
    window.setTimeout(() => setResolved(true), 200)
  }, [])

  // Keyboard nav: Esc dismisses, ← / → flip slides.
  useEffect(() => {
    if (resolved !== false) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
      else if (e.key === 'ArrowRight') {
        if (isLast) dismiss()
        else next()
      } else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [resolved, isLast, dismiss, next, prev])

  // Lock body scroll while the modal is up.
  useEffect(() => {
    if (resolved !== false) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [resolved])

  // Memoise the icon so we don't re-instantiate on every state change.
  const Icon = useMemo(() => slide.icon, [slide.icon])

  if (resolved !== false) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sk-onboarding-title"
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center px-4 py-6',
        'bg-[rgba(9,13,22,0.78)] backdrop-blur-md',
        'transition-opacity duration-200',
        closing ? 'opacity-0' : 'opacity-100'
      )}
      onClick={e => {
        // Tap outside the card to dismiss — feels native on mobile.
        if (e.target === e.currentTarget) dismiss()
      }}
    >
      <div
        className={cn(
          'relative w-full max-w-sm rounded-3xl bg-[var(--sk-surface)] border border-[var(--sk-border-2)]',
          'p-6 sm:p-7 shadow-2xl shadow-[rgba(56,189,248,0.08)]',
          'transition-transform duration-200',
          closing ? 'scale-95' : 'scale-100'
        )}
      >
        {/* Close (X) — top-right, in the thumb-reach safe zone */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup tutorial"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-text)] hover:bg-[var(--sk-surface-2)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center mb-5',
          slide.iconBg
        )}>
          <Icon className={cn('w-7 h-7', slide.iconColor)} />
        </div>

        {/* Title */}
        <h2
          id="sk-onboarding-title"
          className="text-xl font-bold text-[var(--sk-text)] leading-tight mb-2"
        >
          {slide.title}
        </h2>

        {/* Body */}
        <p className="text-sm text-[var(--sk-text-muted)] leading-relaxed mb-4">
          {slide.body}
        </p>

        {/* Example chip */}
        {slide.example && (
          <div className="rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border)] px-3 py-2.5 mb-6 font-mono text-xs text-[var(--sk-cyan)]">
            {slide.example}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-5" aria-hidden>
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                i === index
                  ? 'w-6 bg-[var(--sk-cyan)]'
                  : i < index
                    ? 'w-1.5 bg-[var(--sk-cyan)] opacity-50'
                    : 'w-1.5 bg-[var(--sk-border-2)]'
              )}
            />
          ))}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={isFirst}
            aria-label="Sebelumnya"
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
              isFirst
                ? 'text-[var(--sk-text-dim)] opacity-40 cursor-not-allowed'
                : 'text-[var(--sk-text-muted)] hover:text-[var(--sk-text)] hover:bg-[var(--sk-surface-2)]'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 bg-[var(--sk-cyan)] text-[var(--sk-bg)] font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <Check className="w-4 h-4" />
              Mulai catat
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 bg-[var(--sk-cyan)] text-[var(--sk-bg)] font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Lanjut
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={dismiss}
            className="px-3 h-11 rounded-xl flex items-center justify-center text-[11px] font-medium text-[var(--sk-text-dim)] hover:text-[var(--sk-text-muted)] transition-colors"
          >
            Lewati
          </button>
        </div>

        {/* Subtle feature hints — three more killers we don't dedicate slides
            to but want users to know exist. */}
        {isLast && (
          <div className="mt-5 pt-4 border-t border-[var(--sk-border)] flex items-center justify-center gap-4 text-[10px] text-[var(--sk-text-dim)]">
            <span className="inline-flex items-center gap-1">
              <Mic className="w-3 h-3" /> Voice input
            </span>
            <span className="inline-flex items-center gap-1">
              <Zap className="w-3 h-3" /> Live preview
            </span>
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Zero-guilt
            </span>
          </div>
        )}
      </div>
    </div>
  )
})
