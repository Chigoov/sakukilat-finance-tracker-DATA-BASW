'use client'

import { useState } from 'react'
import { Zap, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M12 10.2v3.92h5.5c-.24 1.42-1.66 4.16-5.5 4.16-3.32 0-6.02-2.74-6.02-6.12S8.68 6.04 12 6.04c1.88 0 3.14.8 3.86 1.5l2.64-2.54C16.82 3.38 14.62 2.4 12 2.4 6.96 2.4 2.88 6.48 2.88 11.52S6.96 20.64 12 20.64c5.5 0 9.14-3.86 9.14-9.3 0-.62-.06-1.1-.16-1.58H12z"
      />
    </svg>
  )
}

function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''

  if (code.includes('unauthorized-domain')) {
    return 'Domain Vercel belum diizinkan di Firebase Auth.'
  }

  if (code.includes('api-key-not-valid') || code.includes('invalid-api-key')) {
    return 'Firebase API key di build ini tidak valid. Refresh halaman lalu coba lagi.'
  }

  if (code.includes('popup-blocked')) {
    return 'Popup Google diblokir browser. Izinkan popup lalu coba lagi.'
  }

  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
    return 'Popup Google tertutup sebelum login selesai.'
  }

  if (code.includes('operation-not-allowed')) {
    return 'Provider Google belum aktif di Firebase Authentication.'
  }

  return 'Login Google gagal. Coba lagi sebentar.'
}

export function AuthGate() {
  const { signInWithGoogle } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-[100dvh] bg-[var(--sk-bg)] flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center">
        {/* Logo mark */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--sk-cyan)] shadow-[0_0_40px_var(--sk-cyan-glow)] mb-7 animate-pop-in">
          <Zap className="w-8 h-8 text-[#090D16] fill-current" strokeWidth={0} />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-[var(--sk-text)] text-balance">
          SakuKilat
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--sk-text-muted)] text-pretty max-w-[280px]">
          Catat keuangan secepat kilat, pakai bahasa sehari-hari. Tanpa drama, tanpa rasa bersalah.
        </p>

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className={cn(
            'group mt-9 w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl',
            'bg-[var(--sk-text)] text-[#090D16] font-semibold text-sm',
            'shadow-[0_0_30px_rgba(232,237,247,0.12)] transition-all duration-200',
            'hover:shadow-[0_0_44px_rgba(232,237,247,0.22)] hover:-translate-y-0.5',
            'active:translate-y-0 active:scale-[0.99] disabled:opacity-70 disabled:cursor-wait'
          )}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Menghubungkan...
            </>
          ) : (
            <>
              <GoogleGlyph className="w-5 h-5" />
              Masuk dengan Google
            </>
          )}
        </button>

        {error && (
          <div
            role="alert"
            className="mt-4 w-full rounded-xl border border-[rgba(248,113,113,0.28)] bg-[var(--sk-red-dim)] px-4 py-3 text-left"
          >
            <p className="text-xs font-semibold text-[var(--sk-red)]">{error}</p>
            {error.includes('Domain Vercel') && (
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--sk-text-muted)]">
                Tambahkan sakukilat-finance-tracker.vercel.app di Firebase Authentication - Settings - Authorized domains.
              </p>
            )}
          </div>
        )}

        {/* Trust row */}
        <div className="mt-6 flex items-center gap-2 text-xs text-[var(--sk-text-dim)]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Data kamu privat & aman. Login sekali, langsung jalan.</span>
        </div>

        {/* Feature hint */}
        <div className="mt-12 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[var(--sk-surface)] border border-[var(--sk-border)] text-[var(--sk-text-muted)]">
          <Sparkles className="w-3.5 h-3.5 text-[var(--sk-cyan)]" />
          <span className="text-xs">
            Ketik <span className="text-[var(--sk-text)] font-medium">&quot;kopi 18k gopay&quot;</span> - beres.
          </span>
        </div>
      </div>

      <footer className="absolute bottom-7 text-[11px] text-[var(--sk-text-dim)]">
        SakuKilat v2.0 - dibuat untuk ketenangan finansialmu
      </footer>
    </main>
  )
}
