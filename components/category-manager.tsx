'use client'

/**
 * SakuKilat — Category Manager
 * ────────────────────────────
 * CRUD UI for custom user categories. Built-in categories are shown
 * read-only so users see the full taxonomy, but only their own additions
 * can be edited or deleted (deleting a built-in would break parser
 * matching for historical transactions).
 *
 * The keywords field is the bridge into the NL parser: any token in any
 * category's keyword list will route a transaction to that category. Users
 * can teach SakuKilat their own slang (e.g. category "Bensin" with
 * keywords "pertamax, pertalite, shell, vivo").
 */

import { useMemo, useState } from 'react'
import { Check, FolderEdit, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { useCustomizationStore } from '@/lib/store'
import { CATEGORY_CONFIG } from '@/components/category-badge'
import { cn } from '@/lib/utils'

interface DraftState {
  /** id of the category being edited, or null when creating a new one */
  editingId: string | null
  label: string
  keywords: string
}

const EMPTY_DRAFT: DraftState = { editingId: null, label: '', keywords: '' }

function parseKeywords(raw: string): string[] {
  // Accept comma OR newline separators. Trim & dedupe.
  return Array.from(new Set(
    raw.split(/[,\n]+/).map(k => k.trim().toLowerCase()).filter(Boolean)
  ))
}

export function CategoryManager() {
  const { customCategories, addCustomCategory, updateCustomCategory, removeCustomCategory } =
    useCustomizationStore()

  const [draft, setDraft]     = useState<DraftState>(EMPTY_DRAFT)
  const [open, setOpen]       = useState(false)

  const isEditing = draft.editingId !== null

  // Built-in categories shown read-only so users see the full taxonomy.
  const builtIns = useMemo(() => Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => ({
    id, label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg,
  })), [])

  const startCreate = () => {
    setDraft(EMPTY_DRAFT)
    setOpen(true)
  }
  const startEdit = (id: string, label: string, keywords: string[]) => {
    setDraft({ editingId: id, label, keywords: keywords.join(', ') })
    setOpen(true)
  }
  const closeForm = () => {
    setDraft(EMPTY_DRAFT)
    setOpen(false)
  }

  const handleSave = () => {
    const label = draft.label.trim()
    if (!label) return
    const kws = parseKeywords(draft.keywords)
    if (isEditing && draft.editingId) {
      updateCustomCategory(draft.editingId, { label, keywords: kws })
    } else {
      addCustomCategory(label, kws)
    }
    closeForm()
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12)
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[var(--sk-amber-dim)] flex items-center justify-center">
          <FolderEdit className="w-4 h-4 text-[var(--sk-amber)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--sk-text)]">Kategori</h3>
        {customCategories.length > 0 && (
          <span className="ml-auto text-[10px] text-[var(--sk-text-dim)]">
            {customCategories.length} custom
          </span>
        )}
      </div>

      {/* Form (collapsible) */}
      {open && (
        <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-cyan)] p-3 mb-3 flex flex-col gap-2.5">
          <input
            autoFocus
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            placeholder="Nama kategori, cth. Bensin"
            className="w-full bg-transparent outline-none text-sm font-medium text-[var(--sk-text)] placeholder:text-[var(--sk-text-dim)]"
          />
          <input
            value={draft.keywords}
            onChange={e => setDraft(d => ({ ...d, keywords: e.target.value }))}
            placeholder="Keyword opsional, pisah pakai koma — cth. pertamax, pertalite, shell"
            className="w-full bg-transparent outline-none text-xs text-[var(--sk-text-muted)] placeholder:text-[var(--sk-text-dim)]"
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-[var(--sk-text-dim)] leading-relaxed flex-1">
              Keyword bantu Smart Input ngarahin transaksi ke kategori ini otomatis.
            </p>
            <button
              type="button"
              onClick={closeForm}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-text)] hover:bg-[var(--sk-surface-2)] transition-colors"
              aria-label="Batal"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!draft.label.trim()}
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                draft.label.trim()
                  ? 'bg-[var(--sk-cyan)] text-[var(--sk-bg)] hover:opacity-90'
                  : 'bg-[var(--sk-surface-2)] text-[var(--sk-text-dim)] cursor-not-allowed'
              )}
              aria-label={isEditing ? 'Simpan perubahan' : 'Tambah kategori'}
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Custom categories (editable) */}
      {customCategories.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {customCategories.map(c => (
            <div
              key={c.id}
              className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] px-3 py-2 flex items-center gap-2"
            >
              <div className="w-7 h-7 rounded-lg bg-[var(--sk-cyan-dim)] flex items-center justify-center flex-shrink-0">
                <Tag className="w-3.5 h-3.5 text-[var(--sk-cyan)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--sk-text)] truncate">{c.label}</p>
                {c.keywords.length > 0 && (
                  <p className="text-[11px] text-[var(--sk-text-dim)] truncate mt-0.5">
                    {c.keywords.join(', ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => startEdit(c.id, c.label, c.keywords)}
                aria-label="Edit"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-cyan)] hover:bg-[var(--sk-cyan-dim)] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeCustomCategory(c.id)}
                aria-label="Hapus"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-red)] hover:bg-[var(--sk-red-dim)] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add button (hidden while form is open) */}
      {!open && (
        <button
          type="button"
          onClick={startCreate}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--sk-surface)] border border-dashed border-[var(--sk-border-2)] text-[var(--sk-text-muted)] hover:text-[var(--sk-text)] hover:bg-[var(--sk-surface-2)] transition-colors text-sm font-medium mb-3"
        >
          <Plus className="w-4 h-4" />
          Tambah kategori sendiri
        </button>
      )}

      {/* Built-in catalogue (read-only) */}
      <div>
        <p className="text-[10px] text-[var(--sk-text-dim)] uppercase tracking-widest font-medium mb-2">
          Bawaan ({builtIns.length})
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {builtIns.map(b => {
            const Icon = b.icon
            return (
              <div
                key={b.id}
                className={cn(
                  'px-2 py-2 rounded-lg flex flex-col items-center gap-1 border border-[var(--sk-border)]',
                  'bg-[var(--sk-surface)]'
                )}
                title={`Kategori bawaan: ${b.label}`}
              >
                <Icon className={cn('w-3.5 h-3.5', b.color)} />
                <span className="text-[10px] font-medium text-[var(--sk-text-muted)] truncate w-full text-center">
                  {b.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
