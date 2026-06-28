import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, FolderEdit, Pencil, Plus, RotateCcw, Tag, Trash2, X } from 'lucide-react'
import { useCustomizationStore } from '@/lib/store'
import { CATEGORY_CONFIG } from '@/components/category-badge'
import { cn } from '@/lib/utils'

const NEW_CATEGORY_ID = '__new-category__'

interface EditorState {
  id: string | null
  label: string
  keywords: string
  subcategory: string
}

const EMPTY_EDITOR: EditorState = {
  id: null,
  label: '',
  keywords: '',
  subcategory: '',
}

function parseKeywords(raw: string): string[] {
  return Array.from(new Set(
    raw.split(/[,\n]+/).map(item => item.trim().toLowerCase()).filter(Boolean)
  ))
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `c-${Date.now()}`
}

export function CategoryManager() {
  const {
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    removeCustomCategory,
  } = useCustomizationStore()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR)
  const [editorSubcategories, setEditorSubcategories] = useState<string[]>([])

  const customById = useMemo(
    () => new Map(customCategories.map(item => [item.id, item])),
    [customCategories]
  )

  const userCategories = useMemo(
    () => customCategories.filter(item => !CATEGORY_CONFIG[item.id as keyof typeof CATEGORY_CONFIG]),
    [customCategories]
  )

  const categories = useMemo(() => {
    const builtins = Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => {
      const override = customById.get(id)
      return {
        id,
        label: override?.label ?? cfg.label,
        keywords: override?.keywords ?? [],
        subcategories: override?.subcategories ?? [],
        icon: cfg.icon,
        color: cfg.color,
        bg: cfg.bg,
        isBuiltin: true,
        isOverridden: Boolean(override),
      }
    })

    const customs = userCategories.map(item => ({
      id: item.id,
      label: item.label,
      keywords: item.keywords,
      subcategories: item.subcategories ?? [],
      icon: Tag,
      color: 'text-[var(--sk-cyan)]',
      bg: 'bg-[var(--sk-cyan-dim)]',
      isBuiltin: false,
      isOverridden: true,
    }))

    return [...builtins, ...customs]
  }, [customById, userCategories])

  const openEditor = (id: string, label: string, keywords: string[], subcategories: string[]) => {
    setExpandedId(id)
    setEditor({
      id,
      label,
      keywords: keywords.join(', '),
      subcategory: '',
    })
    setEditorSubcategories(subcategories)
  }

  const closeEditor = () => {
    setExpandedId(null)
    setEditor(EMPTY_EDITOR)
    setEditorSubcategories([])
  }

  const startCreate = () => {
    setExpandedId(NEW_CATEGORY_ID)
    setEditor({
      id: NEW_CATEGORY_ID,
      label: '',
      keywords: '',
      subcategory: '',
    })
    setEditorSubcategories([])
  }

  const saveCategory = () => {
    const label = editor.label.trim()
    if (!label) return

    const keywords = parseKeywords(editor.keywords)
    const subcategories = Array.from(new Set(editorSubcategories.map(item => item.trim()).filter(Boolean)))

    if (editor.id === NEW_CATEGORY_ID) {
      addCustomCategory(label, keywords, subcategories)
      closeEditor()
      return
    }

    if (!editor.id) return
    updateCustomCategory(editor.id, { label, keywords, subcategories })
    closeEditor()
  }

  const addSubcategory = () => {
    const trimmed = editor.subcategory.trim()
    if (!trimmed) return
    setEditorSubcategories(prev => prev.includes(trimmed) ? prev : [...prev, trimmed])
    setEditor(prev => ({ ...prev, subcategory: '' }))
  }

  const removeSubcategory = (subcategory: string) => {
    setEditorSubcategories(prev => prev.filter(item => item !== subcategory))
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[var(--sk-amber-dim)] flex items-center justify-center">
          <FolderEdit className="w-4 h-4 text-[var(--sk-amber)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--sk-text)]">Kategori</h3>
        <span className="ml-auto text-[10px] text-[var(--sk-text-dim)]">
          {userCategories.length} custom
        </span>
      </div>

      <button
        type="button"
        onClick={startCreate}
        className="mb-3 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--sk-surface)] border border-dashed border-[var(--sk-border-2)] text-[var(--sk-text-muted)] hover:text-[var(--sk-text)] hover:bg-[var(--sk-surface-2)] transition-colors text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Tambah kategori
      </button>

      <div className="flex flex-col gap-2">
        {expandedId === NEW_CATEGORY_ID && (
          <div className="rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-cyan)] px-3 py-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--sk-cyan-dim)] flex items-center justify-center">
                <Plus className="w-4 h-4 text-[var(--sk-cyan)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--sk-text)]">Kategori baru</p>
            </div>
            <div className="space-y-2">
              <input
                autoFocus
                value={editor.label}
                onChange={event => setEditor(prev => ({ ...prev, label: event.target.value }))}
                placeholder="Nama kategori"
                className="w-full rounded-xl border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-3 py-2 text-sm text-[var(--sk-text)] outline-none placeholder:text-[var(--sk-text-dim)]"
              />
              <input
                value={editor.keywords}
                onChange={event => setEditor(prev => ({ ...prev, keywords: event.target.value }))}
                placeholder="Keyword opsional"
                className="w-full rounded-xl border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-3 py-2 text-xs text-[var(--sk-text-muted)] outline-none placeholder:text-[var(--sk-text-dim)]"
              />
              <div className="rounded-xl border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <input
                    value={editor.subcategory}
                    onChange={event => setEditor(prev => ({ ...prev, subcategory: event.target.value }))}
                    onKeyDown={event => event.key === 'Enter' && addSubcategory()}
                    placeholder="Tambah sub kategori opsional"
                    className="flex-1 min-w-0 bg-transparent text-xs text-[var(--sk-text-muted)] outline-none placeholder:text-[var(--sk-text-dim)]"
                  />
                  <button
                    type="button"
                    onClick={addSubcategory}
                    disabled={!editor.subcategory.trim()}
                    className={cn(
                      'h-8 px-3 rounded-lg text-[11px] font-semibold transition-colors',
                      editor.subcategory.trim()
                        ? 'bg-[var(--sk-cyan)] text-[var(--sk-bg)]'
                        : 'bg-[var(--sk-surface)] text-[var(--sk-text-dim)] cursor-not-allowed'
                    )}
                  >
                    Tambah
                  </button>
                </div>
                {editorSubcategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {editorSubcategories.map(subcategory => (
                      <button
                        key={subcategory}
                        type="button"
                        onClick={() => removeSubcategory(subcategory)}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--sk-cyan-dim)] border border-[rgba(56,189,248,0.22)] px-2 py-1 text-[10px] font-medium text-[var(--sk-cyan)]"
                      >
                        {subcategory}
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveCategory}
                  disabled={!editor.label.trim()}
                  className={cn(
                    'flex-1 rounded-xl py-2 text-xs font-semibold',
                    editor.label.trim()
                      ? 'bg-[var(--sk-cyan)] text-[var(--sk-bg)]'
                      : 'bg-[var(--sk-surface)] text-[var(--sk-text-dim)] cursor-not-allowed'
                  )}
                >
                  Simpan kategori
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="w-10 h-10 rounded-xl bg-[var(--sk-surface-2)] text-[var(--sk-text-dim)] flex items-center justify-center"
                  aria-label="Batal tambah kategori"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {categories.map(item => {
          const Icon = item.icon
          const expanded = expandedId === item.id

          return (
            <div
              key={item.id}
              className={cn(
                'rounded-xl border bg-[var(--sk-surface)] transition-colors',
                expanded ? 'border-[var(--sk-cyan)]' : 'border-[var(--sk-border)]'
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', item.bg)}>
                  <Icon className={cn('w-4 h-4', item.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--sk-text)] truncate">{item.label}</p>
                  <p className="text-[11px] text-[var(--sk-text-dim)] truncate">
                    {item.subcategories.length > 0
                      ? `${item.subcategories.length} sub kategori`
                      : item.keywords.length > 0
                        ? `${item.keywords.length} keyword`
                        : 'Belum ada detail tambahan'}
                  </p>
                </div>
                {item.isBuiltin && item.isOverridden && (
                  <button
                    type="button"
                    onClick={() => removeCustomCategory(item.id)}
                    aria-label={`Reset ${item.label}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-amber)] hover:bg-[var(--sk-amber-dim)] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                {!item.isBuiltin && (
                  <button
                    type="button"
                    onClick={() => removeCustomCategory(item.id)}
                    aria-label={`Hapus ${item.label}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-red)] hover:bg-[var(--sk-red-dim)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => expanded
                    ? closeEditor()
                    : openEditor(item.id, item.label, item.keywords, item.subcategories)
                  }
                  aria-label={expanded ? `Tutup ${item.label}` : `Edit ${item.label}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--sk-text-dim)] hover:text-[var(--sk-cyan)] hover:bg-[var(--sk-cyan-dim)] transition-colors"
                >
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-3.5 h-3.5" />}
                </button>
              </div>

              {expanded && (
                <div className="border-t border-[var(--sk-border)] px-3 pb-3 pt-2.5 animate-slide-up">
                  <div className="space-y-2">
                    <input
                      value={editor.label}
                      onChange={event => setEditor(prev => ({ ...prev, label: event.target.value }))}
                      placeholder="Nama kategori"
                      className="w-full rounded-xl border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-3 py-2 text-sm text-[var(--sk-text)] outline-none placeholder:text-[var(--sk-text-dim)]"
                    />
                    <input
                      value={editor.keywords}
                      onChange={event => setEditor(prev => ({ ...prev, keywords: event.target.value }))}
                      placeholder="Keyword opsional"
                      className="w-full rounded-xl border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-3 py-2 text-xs text-[var(--sk-text-muted)] outline-none placeholder:text-[var(--sk-text-dim)]"
                    />
                    <div className="rounded-xl border border-[var(--sk-border)] bg-[var(--sk-surface-2)] px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          value={editor.subcategory}
                          onChange={event => setEditor(prev => ({ ...prev, subcategory: event.target.value }))}
                          onKeyDown={event => event.key === 'Enter' && addSubcategory()}
                          placeholder="Tambah sub kategori opsional"
                          className="flex-1 min-w-0 bg-transparent text-xs text-[var(--sk-text-muted)] outline-none placeholder:text-[var(--sk-text-dim)]"
                        />
                        <button
                          type="button"
                          onClick={addSubcategory}
                          disabled={!editor.subcategory.trim()}
                          className={cn(
                            'h-8 px-3 rounded-lg text-[11px] font-semibold transition-colors',
                            editor.subcategory.trim()
                              ? 'bg-[var(--sk-cyan)] text-[var(--sk-bg)]'
                              : 'bg-[var(--sk-surface)] text-[var(--sk-text-dim)] cursor-not-allowed'
                          )}
                        >
                          Tambah
                        </button>
                      </div>
                      {editorSubcategories.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {editorSubcategories.map(subcategory => (
                            <button
                              key={subcategory}
                              type="button"
                              onClick={() => removeSubcategory(subcategory)}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--sk-cyan-dim)] border border-[rgba(56,189,248,0.22)] px-2 py-1 text-[10px] font-medium text-[var(--sk-cyan)]"
                            >
                              {subcategory}
                              <X className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveCategory}
                        disabled={!editor.label.trim()}
                        className={cn(
                          'flex-1 rounded-xl py-2 text-xs font-semibold',
                          editor.label.trim()
                            ? 'bg-[var(--sk-cyan)] text-[var(--sk-bg)]'
                            : 'bg-[var(--sk-surface)] text-[var(--sk-text-dim)] cursor-not-allowed'
                        )}
                      >
                        Simpan perubahan
                      </button>
                      <button
                        type="button"
                        onClick={closeEditor}
                        className="w-10 h-10 rounded-xl bg-[var(--sk-surface-2)] text-[var(--sk-text-dim)] flex items-center justify-center"
                        aria-label={`Tutup edit ${item.label}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
