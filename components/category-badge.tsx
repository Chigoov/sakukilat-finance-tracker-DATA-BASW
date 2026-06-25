import {
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Gamepad2,
  Heart,
  BookOpen,
  Zap,
  Briefcase,
  TrendingUp,
  ArrowRightLeft,
  MoreHorizontal,
} from 'lucide-react'
import type { Category, PaymentMethod } from '@/lib/parser'
import { cn } from '@/lib/utils'

interface CategoryConfig {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
  bg: string
}

export const CATEGORY_CONFIG: Record<Category, CategoryConfig> = {
  makanan:      { icon: UtensilsCrossed, label: 'Makanan',       color: 'text-[var(--sk-amber)]',  bg: 'bg-[var(--sk-amber-dim)]' },
  transportasi: { icon: Car,             label: 'Transportasi',  color: 'text-[#60A5FA]',           bg: 'bg-[rgba(96,165,250,0.12)]' },
  belanja:      { icon: ShoppingBag,     label: 'Belanja',       color: 'text-[#F472B6]',           bg: 'bg-[rgba(244,114,182,0.12)]' },
  hiburan:      { icon: Gamepad2,        label: 'Hiburan',       color: 'text-[#A78BFA]',           bg: 'bg-[rgba(167,139,250,0.12)]' },
  kesehatan:    { icon: Heart,           label: 'Kesehatan',     color: 'text-[var(--sk-red)]',     bg: 'bg-[var(--sk-red-dim)]' },
  pendidikan:   { icon: BookOpen,        label: 'Pendidikan',    color: 'text-[#34D399]',           bg: 'bg-[var(--sk-green-dim)]' },
  tagihan:      { icon: Zap,             label: 'Tagihan',       color: 'text-[var(--sk-cyan)]',    bg: 'bg-[var(--sk-cyan-dim)]' },
  gaji:         { icon: Briefcase,       label: 'Gaji/Usaha',    color: 'text-[var(--sk-green)]',   bg: 'bg-[var(--sk-green-dim)]' },
  investasi:    { icon: TrendingUp,      label: 'Investasi',     color: 'text-[#34D399]',           bg: 'bg-[var(--sk-green-dim)]' },
  transfer:     { icon: ArrowRightLeft,  label: 'Transfer',      color: 'text-[var(--sk-text-muted)]', bg: 'bg-[var(--sk-surface-3)]' },
  lainnya:      { icon: MoreHorizontal,  label: 'Lainnya',       color: 'text-[var(--sk-text-muted)]', bg: 'bg-[var(--sk-surface-3)]' },
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  gopay:     'GoPay',
  ovo:       'OVO',
  dana:      'DANA',
  shopeepay: 'ShopeePay',
  bca:       'BCA',
  bni:       'BNI',
  bri:       'BRI',
  mandiri:   'Mandiri',
  tunai:     'Tunai',
  transfer:  'Transfer',
  qris:      'QRIS',
  kartu:     'Kartu',
  lainnya:   'Lainnya',
}

interface CategoryIconProps {
  category: Category
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CategoryIcon({ category, size = 'md', className }: CategoryIconProps) {
  const config = CATEGORY_CONFIG[category]
  const Icon = config.icon

  const sizeClasses = {
    sm: { wrapper: 'w-8 h-8', icon: 'w-4 h-4' },
    md: { wrapper: 'w-10 h-10', icon: 'w-5 h-5' },
    lg: { wrapper: 'w-12 h-12', icon: 'w-6 h-6' },
  }

  const s = sizeClasses[size]

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center flex-shrink-0',
        config.bg,
        s.wrapper,
        className
      )}
    >
      <Icon className={cn(config.color, s.icon)} />
    </div>
  )
}

interface SyncDotProps {
  status?: 'synced' | 'syncing' | 'error'
}

export function SyncDot({ status = 'synced' }: SyncDotProps) {
  if (status === 'synced') return null
  return (
    <span
      aria-label={status === 'syncing' ? 'Menyinkronkan...' : 'Gagal sinkronisasi'}
      className={cn(
        'inline-flex w-1.5 h-1.5 rounded-full flex-shrink-0',
        status === 'syncing' && 'bg-[var(--sk-amber)] animate-pulse-soft',
        status === 'error' && 'bg-[var(--sk-red)]'
      )}
    />
  )
}
