'use client'

import { useRef, useState } from 'react'
import { Check, Download, FileJson, Upload } from 'lucide-react'
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  useBudgetStore,
  useCustomizationStore,
  useFeedbackStore,
  useTransactionData,
  useWalletStore,
} from '@/lib/store'
import type { Transaction } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

type RawRecord = Record<string, unknown>

const FIELD_ALIASES = {
  description: ['description', 'deskripsi', 'keterangan', 'catatan', 'nama', 'name'],
  amount: ['amount', 'nominal', 'jumlah', 'nilai', 'total', 'value'],
  income: ['income', 'masuk', 'pemasukan', 'credit', 'kredit'],
  expense: ['expense', 'keluar', 'pengeluaran', 'debit'],
  type: ['type', 'tipe', 'jenis'],
  category: ['category', 'kategori'],
  subcategory: ['subcategory', 'subkategori', 'sub_category', 'subkategoriopsional', 'rincian'],
  paymentMethod: ['paymentmethod', 'payment', 'metode', 'metodebayar', 'dompet', 'saku', 'wallet', 'account'],
  date: ['date', 'tanggal', 'waktu', 'time'],
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().trim().replace(/[\s_-]+/g, '')
}

function pick(record: RawRecord, field: keyof typeof FIELD_ALIASES): unknown {
  for (const alias of FIELD_ALIASES[field]) {
    if (record[alias] !== undefined) return record[alias]
    const entry = Object.entries(record).find(([key]) => normalizeHeader(key) === alias)
    if (entry) return entry[1]
  }
  return undefined
}

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value))
  const raw = String(value ?? '').toLowerCase().trim()
  if (!raw) return 0

  const suffix = raw.match(/\b(k|rb|ribu|jt|juta)\b/)?.[1]
  const numberPart = raw.replace(/[^0-9,.-]/g, '')
  if (!numberPart) return 0

  const decimalSuffix = Boolean(suffix) && /^\d+[,.]\d+$/.test(numberPart)
  const normalized = decimalSuffix
    ? numberPart.replace(',', '.')
    : numberPart.replace(/[.,]/g, '')
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return 0

  if (suffix === 'k' || suffix === 'rb' || suffix === 'ribu') return Math.round(numeric * 1_000)
  if (suffix === 'jt' || suffix === 'juta') return Math.round(numeric * 1_000_000)
  return Math.max(0, Math.round(numeric))
}

function normalizeTransaction(raw: unknown, index: number): Transaction | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as RawRecord
  const incomeAmount = parseMoney(pick(record, 'income'))
  const expenseAmount = parseMoney(pick(record, 'expense'))
  const amount = parseMoney(pick(record, 'amount')) || incomeAmount || expenseAmount
  if (amount <= 0) return null

  const typeText = String(pick(record, 'type') ?? '').toLowerCase()
  const type: Transaction['type'] =
    incomeAmount > 0 || ['income', 'masuk', 'pemasukan', 'credit', 'kredit'].some(token => typeText.includes(token))
      ? 'income'
      : 'expense'
  const date = new Date(String(pick(record, 'date') ?? new Date().toISOString()))
  const kindText = String(record.kind ?? '').toLowerCase()

  return {
    id: String(record.id ?? `txn-import-${Date.now()}-${index}`),
    kind: kindText === 'transfer' || kindText === 'saving' ? kindText as Transaction['kind'] : 'transaction',
    description: String(pick(record, 'description') ?? 'Impor transaksi').trim(),
    amount,
    type,
    category: String(pick(record, 'category') ?? (type === 'income' ? 'gaji' : 'lainnya')).trim().toLowerCase(),
    subcategory: String(pick(record, 'subcategory') ?? '').trim() || undefined,
    paymentMethod: String(pick(record, 'paymentMethod') ?? 'tunai').trim().toLowerCase(),
    fromWalletId: typeof record.fromWalletId === 'string' ? record.fromWalletId : undefined,
    toWalletId: typeof record.toWalletId === 'string' ? record.toWalletId : undefined,
    date: Number.isFinite(date.getTime()) ? date : new Date(),
  }
}

function detectDelimiter(firstLine: string): string {
  return [',', ';', '\t'].reduce((best, delimiter) =>
    firstLine.split(delimiter).length > firstLine.split(best).length ? delimiter : best
  )
}

function parseDelimited(text: string): string[][] {
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  row.push(cell)
  rows.push(row)
  return rows.filter(items => items.some(item => item.trim()))
}

function csvToTransactions(text: string): Transaction[] {
  const rows = parseDelimited(text)
  const headers = rows[0]?.map(normalizeHeader) ?? []
  return rows.slice(1)
    .map((cells, index) => {
      const record = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']))
      return normalizeTransaction(record, index)
    })
    .filter((item): item is Transaction => Boolean(item))
}

function extractRows(input: unknown): unknown[] {
  if (Array.isArray(input)) return input
  if (!input || typeof input !== 'object') return []
  const record = input as RawRecord
  for (const key of ['transactions', 'data', 'records', 'items']) {
    if (Array.isArray(record[key])) return record[key]
  }
  return []
}

function transactionSignature(transaction: Transaction): string {
  return [
    transaction.description.toLowerCase(),
    transaction.amount,
    transaction.type,
    transaction.category,
    transaction.subcategory ?? '',
    transaction.paymentMethod,
    transaction.date.toISOString(),
  ].join('|')
}

function serializeTransaction(transaction: Transaction) {
  return {
    ...transaction,
    date: transaction.date.toISOString(),
  }
}

function downloadFile(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function DataPortability() {
  const { transactions } = useTransactionData()
  const { wallets } = useWalletStore()
  const { monthlyBudget } = useBudgetStore()
  const { customPayments, customCategories } = useCustomizationStore()
  const { showToast } = useFeedbackStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [done, setDone] = useState(false)

  const backup = () => ({
    app: 'SakuKilat',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    transactions: transactions.map(serializeTransaction),
    wallets,
    monthlyBudget,
    customPayments,
    customCategories,
  })

  const exportJson = () => {
    downloadFile(
      `sakukilat-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup(), null, 2),
      'application/json'
    )
    setDone(true)
    setTimeout(() => setDone(false), 2200)
  }

  const exportCsv = () => {
    const rows = [
      ['tanggal', 'tipe', 'deskripsi', 'nominal', 'kategori', 'subkategori', 'dompet'],
      ...transactions.map(t => [
        t.date.toISOString(),
        t.type === 'income' ? 'masuk' : 'keluar',
        t.description,
        t.amount,
        t.category,
        t.subcategory ?? '',
        t.paymentMethod,
      ]),
    ]
    downloadFile(
      `sakukilat-transaksi-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(row => row.map(csvEscape).join(',')).join('\n'),
      'text/csv'
    )
  }

  const importFile = async (file: File) => {
    const text = await file.text()
    const trimmed = text.trim()
    const isJson = file.name.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')
    const parsed = isJson ? JSON.parse(trimmed) as unknown : null
    const imported = isJson
      ? extractRows(parsed).map(normalizeTransaction).filter((item): item is Transaction => Boolean(item))
      : csvToTransactions(text)

    if (imported.length === 0) {
      showToast('File tidak berisi transaksi yang bisa dibaca.', 'error')
      return
    }

    const currentRaw = window.localStorage.getItem(STORAGE_KEY)
    const current = currentRaw ? JSON.parse(currentRaw) as RawRecord : {}
    const backupRecord = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as RawRecord : null
    const isSakuKilatBackup = backupRecord?.app === 'SakuKilat' || backupRecord?.schemaVersion === CURRENT_SCHEMA_VERSION
    const existingSignatures = new Set(transactions.map(transactionSignature))
    const merged = isSakuKilatBackup
      ? imported
      : [...imported.filter(t => !existingSignatures.has(transactionSignature(t))), ...transactions]

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...current,
      ...(isSakuKilatBackup ? backupRecord : {}),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      transactions: merged.map(serializeTransaction),
      wallets: Array.isArray(backupRecord?.wallets) ? backupRecord.wallets : wallets,
      monthlyBudget: typeof backupRecord?.monthlyBudget === 'number' ? backupRecord.monthlyBudget : monthlyBudget,
      customPayments: Array.isArray(backupRecord?.customPayments) ? backupRecord.customPayments : customPayments,
      customCategories: Array.isArray(backupRecord?.customCategories) ? backupRecord.customCategories : customCategories,
    }))
    showToast(`${imported.length} transaksi diimpor. Memuat ulang...`, 'success')
    setTimeout(() => window.location.reload(), 700)
  }

  return (
    <div className="flex flex-col gap-2" data-tour="data-portability">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={exportJson}
          className="min-h-11 rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] text-[var(--sk-text)] text-xs font-semibold flex items-center justify-center gap-2"
        >
          {done ? <Check className="w-4 h-4 text-[var(--sk-green)]" /> : <FileJson className="w-4 h-4 text-[var(--sk-cyan)]" />}
          Backup JSON
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="min-h-11 rounded-xl bg-[var(--sk-surface)] border border-[var(--sk-border)] text-[var(--sk-text)] text-xs font-semibold flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4 text-[var(--sk-green)]" />
          Ekspor CSV
        </button>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'min-h-11 rounded-xl bg-[var(--sk-surface)] border border-dashed border-[var(--sk-border-2)]',
          'text-[var(--sk-text-muted)] hover:text-[var(--sk-text)] text-xs font-semibold flex items-center justify-center gap-2'
        )}
      >
        <Upload className="w-4 h-4" />
        Impor JSON / CSV
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv,.txt,application/json,text/csv,text/plain"
        className="hidden"
        onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          void importFile(file).catch(() => showToast('Impor gagal. Cek format file.', 'error'))
        }}
      />
    </div>
  )
}
