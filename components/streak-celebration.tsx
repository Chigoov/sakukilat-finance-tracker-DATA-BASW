'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StreakCelebrationProps {
  streak: number
}

/**
 * Lightweight DOM confetti — no canvas, no library, no GPU heat.
 * Fires once per milestone day (7, 14, 30, 60, 100, 200, 365).
 * Persistence via localStorage to avoid repeat-spam if the page
 * is reopened the same day.
 */
const MILESTONES = [7, 14, 30, 60, 100, 200, 365]
const COLORS = ['#38BDF8', '#34D399', '#FBBF24', '#F472B6', '#A78BFA']
const STORAGE_KEY = 'sakukilat:v2:celebrated-streak'

function todayKey(): string {
  const d = new Date()
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-')
}

export const StreakCelebration = memo(function StreakCelebration({ streak }: StreakCelebrationProps) {
  const milestone = useMemo(() => MILESTONES.find(m => m === streak) ?? null, [streak])
  const [show, setShow] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!milestone || firedRef.current) return
    if (typeof window === 'undefined') return
    try {
      const stamp = `${todayKey()}:${milestone}`
      const last = window.localStorage.getItem(STORAGE_KEY)
      if (last === stamp) return
      window.localStorage.setItem(STORAGE_KEY, stamp)
    } catch { /* ignore quota errors */ }

    firedRef.current = true
    setShow(true)

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([20, 40, 20, 40, 60])
    }

    const hideTimer = window.setTimeout(() => setShow(false), 4200)
    return () => window.clearTimeout(hideTimer)
  }, [milestone])

  if (!show || !milestone) return null

  const particles = Array.from({ length: 32 }, (_, i) => {
    const angle = (i / 32) * Math.PI * 2
    const distance = 80 + Math.random() * 120
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance - 40
    const color = COLORS[i % COLORS.length]
    const delay = Math.random() * 100
    const duration = 800 + Math.random() * 700
    return { dx, dy, color, delay, duration, id: i }
  })

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center pt-24"
    >
      {/* Confetti burst origin */}
      <div className="relative">
        {particles.map(p => (
          <span
            key={p.id}
            className="absolute w-1.5 h-2.5 rounded-sm"
            style={{
              background: p.color,
              animation: `sk-confetti ${p.duration}ms cubic-bezier(0.16,1,0.3,1) ${p.delay}ms forwards`,
              ['--sk-dx' as string]: `${p.dx}px`,
              ['--sk-dy' as string]: `${p.dy}px`,
            } as React.CSSProperties}
          />
        ))}

        {/* Trophy card */}
        <div className={cn(
          'pointer-events-auto relative flex items-center gap-3 px-4 py-3 rounded-2xl',
          'bg-[var(--sk-surface)] border border-[var(--sk-cyan)] shadow-[0_0_40px_var(--sk-cyan-glow)]',
          'animate-pop-in'
        )}>
          <div className="w-9 h-9 rounded-xl bg-[var(--sk-amber-dim)] flex items-center justify-center">
            <Trophy className="w-5 h-5 text-[var(--sk-amber)]" />
          </div>
          <div className="text-left">
            <p className="text-[11px] uppercase tracking-wide text-[var(--sk-text-dim)] font-semibold">
              Streak milestone
            </p>
            <p className="text-sm font-bold text-[var(--sk-text)]">
              {milestone} hari berturut nyatat · mantap konsisten
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})
