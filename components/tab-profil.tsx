'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import {
  BookOpen, Camera, LogOut, Shield, Moon, Sun, Monitor, ChevronRight, RotateCcw, Zap, Check, Save,
} from 'lucide-react'
import Image from 'next/image'
import { useAuthStore, useFeedbackStore, usePreferenceStore, useTransactionData, type ThemeMode } from '@/lib/store'
import { monthlyTotals } from '@/lib/stats'
import { formatIDR } from '@/lib/parser'
import { DataPortability } from '@/components/data-portability'
import { cn } from '@/lib/utils'

// ── Export transactions to JSON ───────────────────────────────────────────────
// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3.5 flex flex-col gap-1">
      <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest font-medium">{label}</p>
      <p className={cn('text-sm md:text-base font-bold leading-tight break-words', color)}>{value}</p>
    </div>
  )
}

// ── Settings row ──────────────────────────────────────────────────────────────
function SettingRow({
  icon: Icon,
  label,
  description,
  onClick,
  danger,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  onClick?: () => void
  danger?: boolean
  right?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors text-left',
        danger
          ? 'bg-[var(--sk-red-dim)] border-[rgba(248,113,113,0.2)] hover:bg-[rgba(248,113,113,0.18)]'
          : 'bg-[var(--sk-surface)] border-[var(--sk-border)] hover:bg-[var(--sk-surface-2)]'
      )}
    >
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
        danger ? 'bg-[rgba(248,113,113,0.15)]' : 'bg-[var(--sk-surface-2)]'
      )}>
        <Icon className={cn('w-4 h-4', danger ? 'text-[var(--sk-red)]' : 'text-[var(--sk-text-muted)]')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium leading-tight', danger ? 'text-[var(--sk-red)]' : 'text-[var(--sk-text)]')}>
          {label}
        </p>
        {description && (
          <p className="text-xs text-[var(--sk-text-dim)] mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      {right ?? <ChevronRight className={cn('w-4 h-4 flex-shrink-0', danger ? 'text-[var(--sk-red)]' : 'text-[var(--sk-text-dim)]')} />}
    </button>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export function TabProfil() {
  const { user, signOut, updateProfile, updateProfileAvatar } = useAuthStore()
  const { showToast } = useFeedbackStore()
  const { transactions } = useTransactionData()
  const { zenMode, themeMode, toggleZen, setThemeMode } = usePreferenceStore()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [profileNameDraft, setProfileNameDraft] = useState(user?.name ?? '')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const { income, expense, balance } = monthlyTotals(transactions)

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true)
      setTimeout(() => setConfirmLogout(false), 3000)
      return
    }
    signOut()
  }

  const handleSaveProfile = () => {
    updateProfile(profileNameDraft)
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Pilih file gambar untuk foto profil.', 'error')
      return
    }
    if (file.size > 900_000) {
      showToast('Pilih foto di bawah 900 KB supaya simpan lokal tetap ringan.', 'error')
      return
    }

    const reader = new FileReader()
    setAvatarBusy(true)
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      if (!result) {
        setAvatarBusy(false)
        showToast('Foto profil belum berhasil dibaca. Coba foto lain.', 'error')
        return
      }
      updateProfileAvatar(result)
      setAvatarBusy(false)
    }
    reader.onerror = () => {
      setAvatarBusy(false)
      showToast('Foto profil gagal diproses. Coba lagi.', 'error')
    }
    reader.readAsDataURL(file)
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-full md:ml-[72px]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--sk-bg)] backdrop-blur-xl border-b border-[var(--sk-border)] px-4 md:px-8 py-4">
        <h2 className="text-base font-semibold text-[var(--sk-text)]">Profil</h2>
      </div>

      <div className="flex-1 px-4 md:px-8 py-5 flex flex-col gap-5 pb-10">

        {/* ── User card ── */}
        <div className="rounded-2xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-5 flex items-center gap-4 relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)' }}
          />
          <div className="relative flex-shrink-0">
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={56}
              height={56}
              className="rounded-full border-2 border-[var(--sk-border-2)]"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--sk-cyan)] flex items-center justify-center border-2 border-[var(--sk-bg)]">
              <Zap className="w-2.5 h-2.5 fill-[#0B0F19]" strokeWidth={0} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--sk-text)] truncate">{user.name}</p>
            <p className="text-xs text-[var(--sk-text-dim)] truncate mt-0.5">{user.email}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--sk-cyan-dim)] border border-[rgba(56,189,248,0.2)]">
              <Shield className="w-2.5 h-2.5 text-[var(--sk-cyan)]" />
              <span className="text-[10px] text-[var(--sk-cyan)] font-medium">Login aktif</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
                className="h-8 px-3 rounded-lg bg-[var(--sk-surface-2)] border border-[var(--sk-border)] text-[11px] font-semibold text-[var(--sk-text)] inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                {avatarBusy ? 'Memproses...' : 'Ubah foto'}
              </button>
              <button
                type="button"
                onClick={() => updateProfileAvatar(null)}
                className="h-8 px-3 rounded-lg bg-[var(--sk-surface-2)] border border-[var(--sk-border)] text-[11px] font-semibold text-[var(--sk-text-dim)] inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Foto bawaan
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* ── Monthly stats ── */}
        <div>
          <p className="text-xs text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-2.5">
            Edit profil
          </p>
          <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3 flex items-center gap-2">
            <input
              value={profileNameDraft}
              onChange={e => setProfileNameDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveProfile()}
              placeholder="Nama panggilan"
              className="flex-1 min-w-0 bg-[var(--sk-surface-2)] border border-[var(--sk-border)] rounded-lg px-3 py-2 text-sm text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] outline-none focus:border-[var(--sk-cyan)]"
            />
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={!profileNameDraft.trim()}
              className="w-9 h-9 rounded-lg bg-[var(--sk-cyan)] text-[#090D16] disabled:bg-[var(--sk-surface-2)] disabled:text-[var(--sk-text-dim)] flex items-center justify-center"
              aria-label="Simpan profil"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-[var(--sk-text-dim)] mt-2">
            Nama ini hanya dipakai di SakuKilat, bukan mengubah akun Google.
          </p>
        </div>

        <div>
          <p className="text-xs text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-2.5">
            Bulan ini
          </p>
          <div className="flex gap-2.5">
            <StatCard label="Saldo" value={formatIDR(Math.abs(balance))} color={balance >= 0 ? 'text-[var(--sk-text)]' : 'text-[var(--sk-red)]'} />
            <StatCard label="Masuk" value={formatIDR(income)} color="text-[var(--sk-green)]" />
            <StatCard label="Keluar" value={formatIDR(expense)} color="text-[var(--sk-red)]" />
          </div>
          <div className="mt-2 rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-xs text-[var(--sk-text-dim)]">Total transaksi dicatat</span>
            <span className="text-sm font-bold tabular-nums text-[var(--sk-text)]">{transactions.length}</span>
          </div>
        </div>

        {/* ── Settings ── */}
        <div>
          <p className="text-xs text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-2.5">
            Pakai maksimal
          </p>
          <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--sk-cyan-dim)] flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[var(--sk-cyan)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--sk-text)]">Panduan penggunaan penuh</p>
                <p className="text-[11px] text-[var(--sk-text-dim)] mt-0.5">
                  Ini urutan paling enak supaya catatan, budget, dan rekapanmu cepat rapi.
                </p>
              </div>
            </div>
            <ol className="space-y-2 text-[12px] leading-relaxed text-[var(--sk-text-dim)]">
              <li>1. Isi saku dan saldo awal dulu supaya semua transaksi masuk ke dompet yang benar.</li>
              <li>2. Tentukan budget bulanan biar beranda bisa kasih peringatan harian dan mingguan.</li>
              <li>3. Pakai Smart Tracker untuk catatan cepat, lalu pindah ke catat manual kalau butuh tanggal atau detail yang lebih presisi.</li>
              <li>4. Rapikan kategori dan sub kategori supaya rekapan lebih enak dibaca saat transaksi makin banyak.</li>
              <li>5. Cek Rekapan untuk lihat history, kalender harian, dan tren beberapa periode.</li>
              <li>6. Data saat ini masih tersimpan di browser ini, jadi ekspor rutin tetap penting kalau nanti mau pindah perangkat.</li>
            </ol>
          </div>
        </div>

        <div>
          <p className="text-xs text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-2.5">
            Preferensi
          </p>
          <div className="flex flex-col gap-2">
            <div className="w-full rounded-xl border border-[var(--sk-border)] bg-[var(--sk-surface)] px-4 py-3.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--sk-surface-2)] flex items-center justify-center flex-shrink-0">
                  <Sun className="w-4 h-4 text-[var(--sk-text-muted)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--sk-text)] leading-tight">Tampilan</p>
                  <p className="text-xs text-[var(--sk-text-dim)] mt-0.5">Pilih mode yang paling nyaman di mata</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  ['system', Monitor, 'System'],
                  ['dark', Moon, 'Dark'],
                  ['light', Sun, 'Light'],
                ] as Array<[ThemeMode, React.ComponentType<{ className?: string }>, string]>).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setThemeMode(mode)}
                    className={cn(
                      'h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors',
                      themeMode === mode
                        ? 'bg-[var(--sk-cyan)] border-[var(--sk-cyan)] text-[#090D16]'
                        : 'bg-[var(--sk-surface-2)] border-[var(--sk-border)] text-[var(--sk-text-muted)]'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <SettingRow
              icon={Moon}
              label="Zen Mode"
              description="Sembunyikan semua angka untuk ketenangan finansial"
              onClick={toggleZen}
              right={
                <div className={cn(
                  'w-10 h-5 rounded-full transition-colors relative flex-shrink-0',
                  zenMode ? 'bg-[var(--sk-cyan)]' : 'bg-[var(--sk-surface-3)]'
                )}>
                  <div className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                    zenMode ? 'left-5' : 'left-0.5'
                  )} />
                </div>
              }
            />
          </div>
        </div>

        {/* ── Data ── */}
        <div>
          <p className="text-xs text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-2.5">
            Data
          </p>
          <div className="flex flex-col gap-2">
            <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-[var(--sk-surface)] border-[var(--sk-border)]">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--sk-surface-2)]">
                <Save className="w-4 h-4 text-[var(--sk-text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight text-[var(--sk-text)]">Auto-save aktif</p>
                <p className="text-xs text-[var(--sk-text-dim)] mt-0.5 leading-relaxed">
                  Transaksi, saku, budget, profil, dan tema tersimpan otomatis di browser ini.
                </p>
              </div>
              <Check className="w-4 h-4 text-[var(--sk-green)] flex-shrink-0" />
            </div>
            <DataPortability />
          </div>
        </div>

        {/* ── Account ── */}
        <div>
          <p className="text-xs text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-2.5">
            Akun
          </p>
          <SettingRow
            icon={LogOut}
            label={confirmLogout ? 'Ketuk sekali lagi untuk konfirmasi' : 'Keluar'}
            description={confirmLogout ? undefined : 'Sesi akan diakhiri di perangkat ini'}
            onClick={handleLogout}
            danger
          />
        </div>

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-[11px] text-[var(--sk-text-dim)]">
            SakuKilat v2.0 — dibuat untuk ketenangan finansialmu
          </p>
        </div>
      </div>
    </div>
  )
}
