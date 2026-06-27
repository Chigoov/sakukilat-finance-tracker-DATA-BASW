'use client'

import { useState } from 'react'
import { ArrowRightLeft, PiggyBank, Plus, X, Wallet, Tag, ChevronDown, ChevronUp, Info, Gauge } from 'lucide-react'
import { useBudgetStore, useCustomizationStore, useWalletStore } from '@/lib/store'
import { CATEGORY_CONFIG } from '@/components/category-badge'
import { cn } from '@/lib/utils'
import type { CustomPayment, CustomCategory } from '@/lib/parser'
import { formatIDRCompact, parseAmountToken } from '@/lib/parser'
import type { WalletType } from '@/lib/mock-data'

// ── Add item form ─────────────────────────────────────────────────────────────
interface AddFormProps {
  placeholder: string
  keywordsLabel: string
  onAdd: (label: string, keywords: string[]) => void
  accent?: string
}

function AddForm({ placeholder, keywordsLabel, onAdd, accent = 'var(--sk-cyan)' }: AddFormProps) {
  const [label, setLabel]     = useState('')
  const [kwRaw, setKwRaw]     = useState('')
  const [expanded, setExpanded] = useState(false)

  const handleAdd = () => {
    const l = label.trim()
    if (!l) return
    const kws = kwRaw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
    onAdd(l, kws)
    setLabel('')
    setKwRaw('')
    setExpanded(false)
  }

  return (
    <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 bg-transparent outline-none text-sm text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] min-w-0"
        />
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          aria-label="Keyword opsional"
          className="text-[var(--sk-text-dim)] hover:text-[var(--sk-text-muted)] transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!label.trim()}
          aria-label="Tambah"
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
            label.trim()
              ? 'bg-[var(--sk-cyan)] text-[#0B0F19] shadow-[0_0_10px_var(--sk-cyan-glow)]'
              : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-dim)]'
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-[var(--sk-border)] pt-2.5 animate-slide-up">
          <label className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest font-medium block mb-1.5">
            {keywordsLabel}
          </label>
          <input
            type="text"
            value={kwRaw}
            onChange={e => setKwRaw(e.target.value)}
            placeholder="gopay, gp, dompet hijau"
            autoComplete="off"
            className="w-full bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] outline-none border border-[var(--sk-border)] focus:border-[var(--sk-cyan)]"
          />
          <p className="text-[10px] text-[var(--sk-text-dim)] mt-1.5">
            Pisahkan dengan koma. Parser akan mengenali kata-kata ini sebagai {placeholder.toLowerCase()}.
          </p>
        </div>
      )}
    </div>
  )
}

// PATCH (audit fix #2): wrapper tipis ke pipeline parser utama.
// Sebelumnya fungsi ini menjadi parser KEDUA yang lebih sederhana — tidak
// mengenal suffix "rbu/rebu/jeti/m/miliar" dan keliru mem-parse "15.500" sebagai
// 15.5 saat input manual saldo. Sekarang seluruh aplikasi pakai satu engine
// parser yang sama (lib/parser.ts) sehingga konsisten.
function parseAmountInput(raw: string): number {
  // Hapus spasi di tengah ("Rp 15 500" → "Rp15500") supaya parseAmountToken
  // memproses sebagai satu token tunggal yang valid.
  const compact = raw.trim().replace(/\s+/g, '')
  if (!compact) return 0
  const parsed = parseAmountToken(compact)
  return parsed && parsed > 0 ? Math.round(parsed) : 0
}

// ── Custom chip ───────────────────────────────────────────────────────────────
function CustomChip({ item, onRemove }: { item: CustomPayment | CustomCategory; onRemove: () => void }) {
  const [showKw, setShowKw] = useState(false)
  return (
    <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="flex-1 text-sm font-medium text-[var(--sk-text)] truncate">{item.label}</span>
        <button
          onClick={() => setShowKw(s => !s)}
          aria-label="Lihat keywords"
          className="text-[var(--sk-text-dim)] hover:text-[var(--sk-text-muted)] transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          aria-label={`Hapus ${item.label}`}
          className="w-6 h-6 rounded-lg bg-[var(--sk-red-dim)] flex items-center justify-center text-[var(--sk-red)] hover:bg-[rgba(248,113,113,0.25)] transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {showKw && (
        <div className="px-3 pb-2.5 pt-0 border-t border-[var(--sk-border)] animate-slide-up">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.keywords.map(kw => (
              <span key={kw} className="px-2 py-0.5 rounded-full bg-[var(--sk-surface-2)] text-[10px] text-[var(--sk-text-muted)] border border-[var(--sk-border)]">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Built-in reference list ───────────────────────────────────────────────────
function BuiltinList({ title, items }: { title: string; items: [string, string][] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-xs font-medium text-[var(--sk-text-muted)]">{title}</span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-[var(--sk-text-dim)]" />
          : <ChevronDown className="w-3.5 h-3.5 text-[var(--sk-text-dim)]" />
        }
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-[var(--sk-border)] animate-slide-up">
          <div className="flex flex-wrap gap-2 mt-2.5">
            {items.map(([id, label]) => (
              <span
                key={id}
                className="px-2.5 py-1 rounded-full bg-[var(--sk-surface-2)] text-[11px] text-[var(--sk-text-muted)] border border-[var(--sk-border)]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BudgetSettings() {
  const { monthlyBudget, setMonthlyBudget } = useBudgetStore()
  const [raw, setRaw] = useState('')

  const handleSave = () => {
    const amount = parseAmountInput(raw)
    if (!amount) return
    setMonthlyBudget(amount)
    setRaw('')
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[var(--sk-amber-dim)] flex items-center justify-center">
          <Gauge className="w-4 h-4 text-[var(--sk-amber)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--sk-text)]">Budget Bulanan</h3>
        <span className="ml-auto text-xs font-medium text-[var(--sk-amber)] bg-[var(--sk-amber-dim)] px-2 py-0.5 rounded-full">
          {formatIDRCompact(monthlyBudget)}
        </span>
      </div>
      <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3">
        <div className="flex items-center gap-2">
          <input
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="cth. 1,5jt"
            inputMode="decimal"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!parseAmountInput(raw)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
              parseAmountInput(raw)
                ? 'bg-[var(--sk-cyan)] text-[#090D16] shadow-[0_0_10px_var(--sk-cyan-glow)]'
                : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-dim)]'
            )}
            aria-label="Simpan budget"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  )
}

function WalletManager() {
  const { wallets, addWallet, removeWallet } = useWalletStore()
  const [label, setLabel] = useState('')
  const [type, setType] = useState<WalletType>('ewallet')
  const [balance, setBalance] = useState('')
  const [keywords, setKeywords] = useState('')

  const handleAdd = () => {
    const name = label.trim()
    if (!name) return
    addWallet(
      name,
      type,
      parseAmountInput(balance),
      keywords.split(',').map(item => item.trim()).filter(Boolean)
    )
    setLabel('')
    setBalance('')
    setKeywords('')
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[var(--sk-cyan-dim)] flex items-center justify-center">
          <Wallet className="w-4 h-4 text-[var(--sk-cyan)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--sk-text)]">Saku Uang</h3>
        <span className="ml-auto text-xs font-medium text-[var(--sk-cyan)] bg-[var(--sk-cyan-dim)] px-2 py-0.5 rounded-full">
          {wallets.length} aktif
        </span>
      </div>

      <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Nama saku"
            className="min-w-0 bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] outline-none border border-[var(--sk-border)]"
          />
          <select
            value={type}
            onChange={e => setType(e.target.value as WalletType)}
            className="bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] outline-none border border-[var(--sk-border)]"
          >
            <option value="ewallet">E-wallet</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="savings">Simpan</option>
            <option value="card">Kartu</option>
            <option value="other">Lainnya</option>
          </select>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            value={balance}
            onChange={e => setBalance(e.target.value)}
            placeholder="Saldo awal, cth. 250rb"
            inputMode="decimal"
            className="min-w-0 bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] outline-none border border-[var(--sk-border)]"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!label.trim()}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
              label.trim() ? 'bg-[var(--sk-cyan)] text-[#090D16]' : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-dim)]'
            )}
            aria-label="Tambah saku"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <input
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          placeholder="Keyword opsional, pisahkan koma"
          className="bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] outline-none border border-[var(--sk-border)]"
        />
      </div>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {wallets.map(wallet => (
          <div key={wallet.id} className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] px-3 py-2.5 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--sk-text)] truncate">{wallet.label}</p>
              <p className="text-xs font-semibold tabular-nums text-[var(--sk-text-muted)]">{formatIDRCompact(wallet.balance)}</p>
            </div>
            {!wallet.isBuiltIn && wallet.balance === 0 && (
              <button onClick={() => removeWallet(wallet.id)} className="w-6 h-6 rounded-lg bg-[var(--sk-red-dim)] text-[var(--sk-red)] flex items-center justify-center" aria-label={`Hapus ${wallet.label}`}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function MoneyMovePanel() {
  const { wallets, transferMoney, saveMoney } = useWalletStore()
  const [fromId, setFromId] = useState(wallets[0]?.id ?? '')
  const [toId, setToId] = useState(wallets[1]?.id ?? '')
  const [amount, setAmount] = useState('')

  const parsedAmount = parseAmountInput(amount)

  const handleTransfer = () => {
    if (transferMoney(fromId, toId, parsedAmount)) setAmount('')
  }

  const handleSave = () => {
    if (saveMoney(fromId, parsedAmount)) setAmount('')
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[var(--sk-green-dim)] flex items-center justify-center">
          <ArrowRightLeft className="w-4 h-4 text-[var(--sk-green)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--sk-text)]">Pindah & Simpan</h3>
      </div>

      <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-3 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <select value={fromId} onChange={e => setFromId(e.target.value)} className="bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] outline-none border border-[var(--sk-border)]">
            {wallets.map(wallet => <option key={wallet.id} value={wallet.id}>Dari {wallet.label}</option>)}
          </select>
          <select value={toId} onChange={e => setToId(e.target.value)} className="bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] outline-none border border-[var(--sk-border)]">
            {wallets.map(wallet => <option key={wallet.id} value={wallet.id}>Ke {wallet.label}</option>)}
          </select>
        </div>
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Nominal, cth. 100k"
          inputMode="decimal"
          className="bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)] outline-none border border-[var(--sk-border)]"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleTransfer}
            disabled={!parsedAmount || fromId === toId}
            className="rounded-lg bg-[var(--sk-cyan)] text-[#090D16] disabled:bg-[var(--sk-surface-2)] disabled:text-[var(--sk-text-dim)] text-xs font-semibold py-2 flex items-center justify-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Pindah
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!parsedAmount || fromId === 'tabungan'}
            className="rounded-lg bg-[var(--sk-green)] text-[#090D16] disabled:bg-[var(--sk-surface-2)] disabled:text-[var(--sk-text-dim)] text-xs font-semibold py-2 flex items-center justify-center gap-1.5"
          >
            <PiggyBank className="w-3.5 h-3.5" />
            Simpan
          </button>
        </div>
      </div>
    </section>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export function TabAturSaku() {
  const {
    customPayments, customCategories,
    addCustomPayment, removeCustomPayment,
    addCustomCategory, removeCustomCategory,
  } = useCustomizationStore()

  const builtinPayments: [string, string][] = [
    ['gopay','GoPay'], ['ovo','OVO'], ['dana','DANA'], ['shopeepay','ShopeePay'],
    ['bca','BCA'], ['bni','BNI'], ['bri','BRI'], ['mandiri','Mandiri'],
    ['jago','Jago'], ['qris','QRIS'], ['kartu','Kartu'], ['transfer','Transfer'], ['tunai','Tunai'],
  ]
  const builtinCategories: [string, string][] = Object.entries(CATEGORY_CONFIG).map(
    ([id, cfg]) => [id, cfg.label]
  )

  return (
    <div className="flex flex-col min-h-full md:ml-[72px]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--sk-bg)] backdrop-blur-xl border-b border-[var(--sk-border)] px-4 md:px-8 py-4">
        <h2 className="text-base font-semibold text-[var(--sk-text)]">Atur Saku</h2>
        <p className="text-xs text-[var(--sk-text-dim)] mt-0.5">
          Ajarkan SakuKilat slang kamu — parser akan langsung mengenalinya.
        </p>
      </div>

      <div className="flex-1 px-4 md:px-8 py-5 flex flex-col gap-6 pb-10">

        <BudgetSettings />

        <WalletManager />

        <MoneyMovePanel />

        <div className="h-px bg-[var(--sk-border)]" />

        {/* ── Custom Payment Methods ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--sk-cyan-dim)] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[var(--sk-cyan)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--sk-text)]">Metode Bayar</h3>
            {customPayments.length > 0 && (
              <span className="ml-auto text-xs font-medium text-[var(--sk-cyan)] bg-[var(--sk-cyan-dim)] px-2 py-0.5 rounded-full">
                {customPayments.length} kustom
              </span>
            )}
          </div>

          <AddForm
            placeholder="Nama metode baru (cth. SeaBank)"
            keywordsLabel="Keywords tambahan (opsional)"
            onAdd={addCustomPayment}
          />

          {customPayments.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {customPayments.map(p => (
                <CustomChip key={p.id} item={p} onRemove={() => removeCustomPayment(p.id)} />
              ))}
            </div>
          )}

          <div className="mt-3">
            <BuiltinList title="Bawaan (tidak bisa dihapus)" items={builtinPayments} />
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-[var(--sk-border)]" />

        {/* ── Custom Categories ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--sk-amber-dim)] flex items-center justify-center">
              <Tag className="w-4 h-4 text-[var(--sk-amber)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--sk-text)]">Kategori</h3>
            {customCategories.length > 0 && (
              <span className="ml-auto text-xs font-medium text-[var(--sk-amber)] bg-[var(--sk-amber-dim)] px-2 py-0.5 rounded-full">
                {customCategories.length} kustom
              </span>
            )}
          </div>

          <AddForm
            placeholder="Nama kategori baru (cth. Peliharaan)"
            keywordsLabel="Keywords pengenal (opsional)"
            onAdd={addCustomCategory}
          />

          {customCategories.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {customCategories.map(c => (
                <CustomChip key={c.id} item={c} onRemove={() => removeCustomCategory(c.id)} />
              ))}
            </div>
          )}

          <div className="mt-3">
            <BuiltinList title="Bawaan (tidak bisa dihapus)" items={builtinCategories} />
          </div>
        </section>

        {/* ── How it works hint ── */}
        <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] p-4">
          <p className="text-xs font-medium text-[var(--sk-text-muted)] mb-2">Cara kerjanya</p>
          <p className="text-xs text-[var(--sk-text-dim)] leading-relaxed">
            Ketik <span className="text-[var(--sk-text)] font-medium">&quot;seafood 45k seabank&quot;</span> — jika kamu sudah menambahkan
            &quot;SeaBank&quot; sebagai metode dengan keyword <span className="text-[var(--sk-cyan)] font-medium">seabank</span>,
            parser langsung mengenalinya tanpa konfigurasi tambahan.
          </p>
        </div>
      </div>
    </div>
  )
}
