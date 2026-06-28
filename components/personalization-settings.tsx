'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Info, Pencil, Plus, Tag, Wallet, X } from 'lucide-react'
import { CATEGORY_CONFIG } from '@/components/category-badge'
import { useCustomizationStore } from '@/lib/store'
import type { CustomCategory, CustomPayment } from '@/lib/parser'
import { cn } from '@/lib/utils'

interface AddFormProps {
  placeholder: string
  keywordsLabel: string
  onAdd: (label: string, keywords: string[]) => void
}

function AddForm({ placeholder, keywordsLabel, onAdd }: AddFormProps) {
  const [label, setLabel] = useState('')
  const [kwRaw, setKwRaw] = useState('')
  const [expanded, setExpanded] = useState(false)

  const handleAdd = () => {
    const trimmedLabel = label.trim()
    if (!trimmedLabel) return

    const keywords = kwRaw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
    onAdd(trimmedLabel, keywords)
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
        </div>
      )}
    </div>
  )
}

function CustomChip({
  item,
  onRemove,
  onUpdate,
}: {
  item: CustomPayment | CustomCategory
  onRemove: () => void
  onUpdate?: (label: string, keywords: string[]) => void
}) {
  const [showKeywords, setShowKeywords] = useState(false)
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [keywords, setKeywords] = useState(item.keywords.join(', '))

  const saveEdit = () => {
    if (!label.trim()) return
    onUpdate?.(label.trim(), keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-cyan)] p-3 flex flex-col gap-2">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] outline-none border border-[var(--sk-border)]"
          placeholder="Nama metode"
        />
        <input
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          className="bg-[var(--sk-surface-2)] rounded-lg px-3 py-2 text-xs text-[var(--sk-text)] outline-none border border-[var(--sk-border)]"
          placeholder="Keyword, pisahkan koma"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={saveEdit}
            className="rounded-lg bg-[var(--sk-cyan)] text-[#090D16] text-xs font-semibold py-2 flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Simpan
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg bg-[var(--sk-surface-2)] text-[var(--sk-text-muted)] text-xs font-semibold py-2 flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Batal
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="flex-1 text-sm font-medium text-[var(--sk-text)] truncate">{item.label}</span>
        <button
          onClick={() => setShowKeywords(s => !s)}
          aria-label="Lihat keywords"
          className="text-[var(--sk-text-dim)] hover:text-[var(--sk-text-muted)] transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        {onUpdate && (
          <button
            onClick={() => setEditing(true)}
            aria-label={`Edit ${item.label}`}
            className="w-6 h-6 rounded-lg bg-[var(--sk-surface-2)] flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-cyan)] transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={onRemove}
          aria-label={`Hapus ${item.label}`}
          className="w-6 h-6 rounded-lg bg-[var(--sk-red-dim)] flex items-center justify-center text-[var(--sk-red)] hover:bg-[rgba(248,113,113,0.25)] transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {showKeywords && (
        <div className="px-3 pb-2.5 pt-0 border-t border-[var(--sk-border)] animate-slide-up">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.keywords.map(keyword => (
              <span key={keyword} className="px-2 py-0.5 rounded-full bg-[var(--sk-surface-2)] text-[10px] text-[var(--sk-text-muted)] border border-[var(--sk-border)]">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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

export function PersonalizationSettings({ showCategories = true }: { showCategories?: boolean }) {
  const {
    customPayments,
    customCategories,
    hiddenPaymentIds,
    addCustomPayment,
    updateCustomPayment,
    removeCustomPayment,
    restoreHiddenPayment,
    addCustomCategory,
    removeCustomCategory,
  } = useCustomizationStore()

  const builtinPayments: [string, string][] = [
    ['gopay', 'GoPay'], ['ovo', 'OVO'], ['dana', 'DANA'], ['shopeepay', 'ShopeePay'],
    ['bca', 'BCA'], ['bni', 'BNI'], ['bri', 'BRI'], ['mandiri', 'Mandiri'],
    ['jago', 'Jago'], ['qris', 'QRIS'], ['kartu', 'Kartu'], ['transfer', 'Transfer'], ['tunai', 'Tunai'],
  ]
  const builtinCategories: [string, string][] = Object.entries(CATEGORY_CONFIG).map(
    ([id, cfg]) => [id, cfg.label]
  )
  const customPaymentMap = useMemo(
    () => new Map(customPayments.map(item => [item.id, item])),
    [customPayments]
  )
  const visibleBuiltinPayments = builtinPayments.filter(([id]) => !hiddenPaymentIds.includes(id))
  const mergedPayments = [
    ...visibleBuiltinPayments.map(([id, label]) => customPaymentMap.get(id) ?? { id, label, keywords: [id] }),
    ...customPayments.filter(item => !builtinPayments.some(([builtinId]) => builtinId === item.id)),
  ]
  const hiddenBuiltins = builtinPayments.filter(([id]) => hiddenPaymentIds.includes(id))

  return (
    <div>
      <p className="text-xs text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-2.5">
        Personalisasi
      </p>

      <div className="flex flex-col gap-5">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--sk-cyan-dim)] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[var(--sk-cyan)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--sk-text)]">Metode Bayar</h3>
            {mergedPayments.length > 0 && (
              <span className="ml-auto text-xs font-medium text-[var(--sk-cyan)] bg-[var(--sk-cyan-dim)] px-2 py-0.5 rounded-full">
                {mergedPayments.length} aktif
              </span>
            )}
          </div>

          <AddForm
            placeholder="Nama metode baru"
            keywordsLabel="Keywords tambahan"
            onAdd={addCustomPayment}
          />

          {mergedPayments.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {mergedPayments.map(payment => (
                <CustomChip
                  key={payment.id}
                  item={payment}
                  onRemove={() => removeCustomPayment(payment.id)}
                  onUpdate={(label, keywords) => updateCustomPayment(payment.id, { label, keywords })}
                />
              ))}
            </div>
          )}

          {hiddenBuiltins.length > 0 && (
            <div className="mt-3 rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] px-3 py-3">
              <p className="text-[11px] font-medium text-[var(--sk-text-dim)]">Disembunyikan</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {hiddenBuiltins.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => restoreHiddenPayment(id)}
                    className="rounded-full bg-[var(--sk-surface-2)] border border-[var(--sk-border)] px-2.5 py-1 text-[11px] text-[var(--sk-text-muted)]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {showCategories && (
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
            placeholder="Nama kategori baru"
            keywordsLabel="Keywords pengenal"
            onAdd={addCustomCategory}
          />

          {customCategories.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {customCategories.map(category => (
                <CustomChip key={category.id} item={category} onRemove={() => removeCustomCategory(category.id)} />
              ))}
            </div>
          )}

          <div className="mt-3">
            <BuiltinList title="Bawaan" items={builtinCategories} />
          </div>
        </section>
        )}
      </div>
    </div>
  )
}
