'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BarChart2, Check, PenLine, Repeat, Sparkles, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

const ONBOARDING_VERSION = 2
const ONBOARDING_KEY_PREFIX = `sakukilat:v2:onboarding-completed-v${ONBOARDING_VERSION}`

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
    title: 'Catatan otomatis ada di bawah',
    body: 'Ketik transaksi pakai bahasa sehari-hari. SakuKilat membaca nominal, kategori, dan metode bayar otomatis dari kalimatmu.',
    example: 'kopi 18k gopay',
  },
  {
    icon: PenLine,
    iconColor: 'text-[var(--sk-amber)]',
    iconBg: 'bg-[var(--sk-amber-dim)]',
    title: 'Catat manual untuk detail rapi',
    body: 'Pakai tombol manual saat kamu ingin memilih tipe, dompet, kategori, tanggal, dan deskripsi sendiri.',
    example: 'Pilih Keluar, Masuk, atau Pindah',
  },
  {
    icon: Wallet,
    iconColor: 'text-[var(--sk-green)]',
    iconBg: 'bg-[var(--sk-green-dim)]',
    title: 'Saku adalah pusat pengaturan',
    body: 'Di Saku kamu mengatur dompet, budget, pindah uang, metode bayar, kategori, tabungan, dan transaksi otomatis.',
    example: 'Gaji, langganan, cicilan -> otomatis',
  },
  {
    icon: BarChart2,
    iconColor: 'text-[var(--sk-cyan)]',
    iconBg: 'bg-[var(--sk-cyan-dim)]',
    title: 'Rekapan bisa pakai periode sendiri',
    body: 'Buka Rekapan lalu pilih Tren untuk melihat history 7 hari, 30 hari, 1 tahun, atau periode tanggal yang kamu tentukan.',
    example: 'History: 1 Jun 2026 - 28 Jun 2026',
  },
]

function storageKey(userId?: string | null): string {
  return `${ONBOARDING_KEY_PREFIX}:${encodeURIComponent(userId || 'local')}`
}

function readCompleted(userId?: string | null): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1'
  } catch {
    return true
  }
}

function writeCompleted(userId?: string | null): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), '1')
  } catch {
    /* localStorage can be blocked in private mode */
  }
}

export const OnboardingTour = memo(function OnboardingTour({ userId }: { userId?: string | null }) {
  const [resolved, setResolved] = useState<boolean | null>(null)
  const [index, setIndex] = useState(0)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setResolved(readCompleted(userId))
  }, [userId])

  const total = SLIDES.length
  const slide = SLIDES[index]
  const isFirst = index === 0
  const isLast = index === total - 1
  const Icon = useMemo(() => slide.icon, [slide.icon])

  const finish = useCallback(() => {
    writeCompleted(userId)
    setClosing(true)
    window.setTimeout(() => setResolved(true), 180)
  }, [userId])

  const next = useCallback(() => {
    if (isLast) {
      finish()
      return
    }
    setIndex(value => Math.min(total - 1, value + 1))
  }, [finish, isLast, total])

  const prev = useCallback(() => {
    if (!isFirst) setIndex(value => Math.max(0, value - 1))
  }, [isFirst])

  useEffect(() => {
    if (resolved !== false) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, resolved])

  useEffect(() => {
    if (resolved !== false) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [resolved])

  if (resolved !== false) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sk-onboarding-title"
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center px-4 py-6',
        'bg-[rgba(9,13,22,0.82)] backdrop-blur-md transition-opacity duration-200',
        closing ? 'opacity-0' : 'opacity-100'
      )}
    >
      <div
        className={cn(
          'w-full max-w-sm rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border-2)] p-5 shadow-2xl',
          'transition-transform duration-200',
          closing ? 'scale-95' : 'scale-100'
        )}
      >
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-4', slide.iconBg)}>
          <Icon className={cn('w-6 h-6', slide.iconColor)} />
        </div>

        <p className="text-[10px] font-semibold text-[var(--sk-text-dim)] uppercase tracking-widest mb-1">
          Panduan {index + 1}/{total}
        </p>
        <h2 id="sk-onboarding-title" className="text-xl font-bold text-[var(--sk-text)] leading-tight mb-2">
          {slide.title}
        </h2>
        <p className="text-sm text-[var(--sk-text-muted)] leading-relaxed mb-4">
          {slide.body}
        </p>

        {slide.example && (
          <div className="rounded-xl bg-[var(--sk-surface-2)] border border-[var(--sk-border)] px-3 py-2.5 mb-5 font-mono text-xs text-[var(--sk-cyan)]">
            {slide.example}
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mb-5" aria-hidden>
          {SLIDES.map((_, slideIndex) => (
            <span
              key={slideIndex}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                slideIndex === index ? 'w-6 bg-[var(--sk-cyan)]' : 'w-1.5 bg-[var(--sk-border-2)]'
              )}
            />
          ))}
        </div>

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
          <button
            type="button"
            onClick={next}
            className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 bg-[var(--sk-cyan)] text-[var(--sk-bg)] font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {isLast ? (
              <>
                <Check className="w-4 h-4" />
                Mulai pakai
              </>
            ) : (
              <>
                Lanjut
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {isLast && (
          <p className="mt-4 text-center text-[10px] text-[var(--sk-text-dim)] leading-relaxed">
            Setelah selesai, panduan ini tidak muncul lagi untuk akun ini.
          </p>
        )}
      </div>
    </div>
  )
})
