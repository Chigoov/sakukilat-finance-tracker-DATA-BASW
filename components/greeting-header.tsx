'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Eye, EyeOff, Sunrise, Sun, Sunset, Moon } from 'lucide-react'
import { useAuthStore, usePreferenceStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface Greeting {
  text: string
  Icon: React.ComponentType<{ className?: string }>
  tint: string
}

function getGreeting(hour: number): Greeting {
  if (hour >= 4 && hour < 11) return { text: 'Selamat Pagi', Icon: Sunrise, tint: 'text-[var(--sk-amber)]' }
  if (hour >= 11 && hour < 15) return { text: 'Selamat Siang', Icon: Sun, tint: 'text-[var(--sk-amber)]' }
  if (hour >= 15 && hour < 19) return { text: 'Selamat Sore', Icon: Sunset, tint: 'text-[#FB923C]' }
  return { text: 'Selamat Malam', Icon: Moon, tint: 'text-[var(--sk-cyan)]' }
}

export function GreetingHeader() {
  const { user } = useAuthStore()
  const { zenMode, toggleZen } = usePreferenceStore()
  // Resolve greeting on the client to honor the user's actual system clock
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => {
    setHour(new Date().getHours())
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  const greeting = getGreeting(hour ?? 9)
  const GreetingIcon = greeting.Icon

  return (
    <header className="flex items-center justify-between gap-3 px-4 md:px-8 pt-6 pb-2">
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Image
            src={user?.avatarUrl ?? '/avatar.png'}
            alt={`Foto profil ${user?.givenName ?? 'pengguna'}`}
            width={44}
            height={44}
            className="rounded-full object-cover ring-2 ring-[var(--sk-border-2)]"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--sk-green)] ring-2 ring-[#0B0F19]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <GreetingIcon className={cn('w-3.5 h-3.5', greeting.tint)} />
            <span className="text-xs font-medium text-[var(--sk-text-muted)]">{greeting.text}</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[var(--sk-text)] truncate leading-tight">
            {user?.givenName ?? 'Teman'}!
          </h1>
        </div>
      </div>

      {/* Zen Mode toggle */}
      <button
        onClick={toggleZen}
        aria-pressed={zenMode}
        aria-label={zenMode ? 'Matikan Mode Zen' : 'Nyalakan Mode Zen'}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex-shrink-0',
          zenMode
            ? 'bg-[var(--sk-cyan-dim)] text-[var(--sk-cyan)] border border-[rgba(56,189,248,0.3)]'
            : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] border border-[var(--sk-border)] hover:text-[var(--sk-text)]'
        )}
      >
        {zenMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        <span className="hidden xs:inline">Zen</span>
      </button>
    </header>
  )
}
