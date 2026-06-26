/**
 * SakuKilat — Smart Natural Language Transaction Parser
 * Parses Indonesian natural language input like:
 *   "makan soto 25k gopay"
 *   "terima gaji 5jt transfer"
 *   "beli kopi 18.500 tunai"
 *   "ongkir grab stasiun tawang 38k ovo"
 *   "bayar listrik 38,500 bca"
 */

export type PaymentMethod =
  | 'gopay'
  | 'ovo'
  | 'dana'
  | 'shopeepay'
  | 'bca'
  | 'bni'
  | 'bri'
  | 'mandiri'
  | 'jago'
  | 'tunai'
  | 'transfer'
  | 'qris'
  | 'kartu'
  | 'lainnya'

export type TransactionType = 'expense' | 'income'

export type Category =
  | 'makanan'
  | 'transportasi'
  | 'belanja'
  | 'hiburan'
  | 'kesehatan'
  | 'pendidikan'
  | 'tagihan'
  | 'gaji'
  | 'investasi'
  | 'transfer'
  | 'lainnya'

export interface ParsedTransaction {
  kind?: 'transaction'
  description: string
  amount: number
  type: TransactionType
  category: string // built-in Category id OR a custom category id
  paymentMethod: string // built-in PaymentMethod id OR a custom payment id
  rawInput: string
  confidence: number // 0-1
  warning?: string
}

export interface ParsedTransfer {
  kind: 'transfer'
  description: string
  amount: number
  fromWalletId: string
  toWalletId: string
  rawInput: string
  confidence: number
  warning?: string
}

export interface ParsedSaving {
  kind: 'saving'
  description: string
  amount: number
  fromWalletId: string
  toWalletId: string
  rawInput: string
  confidence: number
  warning?: string
}

export type ParsedEntry = ParsedTransaction | ParsedTransfer | ParsedSaving

/**
 * User-defined slang that the parser should also recognize.
 * Lets users teach SakuKilat their own payment apps & categories.
 */
export interface CustomPayment {
  id: string
  label: string
  keywords: string[]
}
export interface CustomCategory {
  id: string
  label: string
  keywords: string[]
}
export interface ParserExtras {
  payments?: CustomPayment[]
  categories?: CustomCategory[]
  lastActiveWalletId?: string
}

// ── Payment method keywords ──────────────────────────────────────────────────
// Each entry: [exactTokens[], substringTokens[]]
// exactTokens  → matched only against a complete whitespace-split token
// substringTokens → also matched if the token *contains* the keyword
// This prevents "bca" from matching inside "abca" etc.
const PAYMENT_MAP: Array<{ method: PaymentMethod; exact: string[]; contains: string[] }> = [
  { method: 'gopay',     exact: ['gopay', 'gp'],                        contains: [] },
  { method: 'ovo',       exact: ['ovo'],                                 contains: [] },
  { method: 'dana',      exact: ['dana'],                                contains: [] },
  { method: 'shopeepay', exact: ['shopeepay', 'spay'],                   contains: ['shopeepay'] },
  { method: 'qris',      exact: ['qris'],                                contains: [] },
  { method: 'jago',      exact: ['jago'],                                contains: [] },
  { method: 'bca',       exact: ['bca', 'klikbca'],                      contains: [] },
  { method: 'bni',       exact: ['bni'],                                 contains: [] },
  { method: 'bri',       exact: ['bri', 'brimo'],                        contains: [] },
  { method: 'mandiri',   exact: ['mandiri', 'livin'],                    contains: [] },
  { method: 'kartu',     exact: ['kartu', 'debit', 'kredit', 'cc'],      contains: [] },
  { method: 'transfer',  exact: ['transfer', 'tf'],                      contains: [] },
  { method: 'tunai',     exact: ['tunai', 'cash', 'kontan'],             contains: [] },
]

const CURRENCY_TOKENS = new Set(['rp', 'idr'])
const AMOUNT_SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  rb: 1_000,
  ribu: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  m: 1_000_000_000,
  miliar: 1_000_000_000,
  milyar: 1_000_000_000,
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
}

function wordMatch(str: string, kw: string): boolean {
  const normalized = kw.trim().toLowerCase()
  if (!normalized) return false
  return new RegExp(`(^|[^a-z0-9_])${escapeRegex(normalized)}(?=$|[^a-z0-9_])`, 'i').test(str)
}

// ── Income keywords ──────────────────────────────────────────────────────────
const INCOME_KEYWORDS = [
  'gaji', 'salary', 'terima', 'dapat', 'masuk', 'pemasukan', 'pendapatan', 'income',
  'bonus', 'komisi', 'dividen', 'honor', 'fee', 'bayaran', 'dibayar', 'jual',
  'refund', 'cashback', 'hadiah', 'thr', 'freelance',
]

// ── Category keyword map ─────────────────────────────────────────────────────
// Keywords are matched as whole words against the lowercased description
// (using a word-boundary aware check), preventing partial false-matches.
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  makanan: [
    'makan', 'minum', 'kopi', 'teh', 'nasi', 'soto', 'bakso',
    'ayam', 'pizza', 'burger', 'sushi', 'resto', 'warung', 'kantin',
    'cafe', 'kafe', 'snack', 'camilan', 'jajan', 'boba', 'juice',
    'mcdonalds', 'kfc', 'gofood', 'shopeefood', 'pecel', 'rawon', 'sate',
    'martabak', 'gorengan', 'indomie', 'nasgor', 'esteh', 'mie', 'mi',
    'es', 'minuman', 'sarapan', 'makan siang', 'makan malam',
  ],
  transportasi: [
    'ongkir', 'bensin', 'bbm', 'parkir', 'tol', 'ojek', 'gojek', 'grab',
    'taxi', 'taksi', 'busway', 'transjakarta', 'kereta', 'commuter',
    'krl', 'mrt', 'lrt', 'bis', 'angkot', 'pesawat',
    'tiket', 'uber', 'maxim', 'servis motor', 'servis mobil',
  ],
  belanja: [
    'beli', 'belanja', 'shopee', 'tokopedia', 'lazada', 'tiktokshop',
    'baju', 'celana', 'sepatu', 'tas', 'elektronik', 'hp', 'laptop',
    'charger', 'kabel', 'aksesoris', 'kosmetik', 'skincare', 'parfum',
    'buku', 'peralatan', 'furniture', 'supermarket',
  ],
  hiburan: [
    'netflix', 'spotify', 'youtube', 'game', 'bioskop', 'film',
    'konser', 'event', 'steam', 'playstation', 'xbox', 'disney',
    'prime', 'vidio', 'cinema',
  ],
  kesehatan: [
    'dokter', 'rumah sakit', 'klinik', 'apotek', 'obat',
    'vitamin', 'suplemen', 'gym', 'fitness', 'olahraga',
    'periksa', 'laboratorium', 'dental', 'gigi',
  ],
  pendidikan: [
    'kursus', 'les', 'bimbel', 'sekolah', 'kampus', 'kuliah',
    'spp', 'ukt', 'udemy', 'coursera', 'dicoding',
    'ruangguru', 'zenius', 'seminar', 'pelatihan', 'workshop',
  ],
  tagihan: [
    'listrik', 'pln', 'air', 'pdam', 'internet', 'wifi',
    'indihome', 'telkom', 'pulsa', 'paket data',
    'iuran', 'pajak', 'bpjs', 'asuransi', 'cicilan', 'angsuran',
    'kpr', 'tagihan', 'bayar', 'langganan',
  ],
  gaji: [
    'gaji', 'salary', 'upah', 'honor', 'thr', 'bonus', 'komisi',
    'insentif', 'honorarium', 'freelance',
  ],
  investasi: [
    'investasi', 'saham', 'reksadana', 'crypto',
    'bitcoin', 'ethereum', 'emas', 'deposito', 'obligasi',
    'nabung', 'bibit', 'ajaib',
  ],
  transfer: [
    'transfer', 'kirim', 'setor', 'tarik tunai',
  ],
  lainnya: [],
}

// ── Amount normalizer ────────────────────────────────────────────────────────
/**
 * Converts a raw number string (possibly with Indonesian-style separators)
 * into a plain float. Rules:
 *   - Dot as thousands separator: "38.500" → 38500
 *     Heuristic: if there's exactly one dot AND the substring after it is
 *     exactly 3 digits, treat dot as thousands sep (no fractional part).
 *   - Comma as thousands separator: "38,500" → 38500
 *     Same heuristic applies for a single comma + 3 trailing digits.
 *   - Mixed "1.500.000" → 1500000 (multiple dots → all are thousands seps)
 *   - Standard decimal "18.5" / "1,5" → kept as-is
 */
function normalizeNumberString(raw: string, mode: 'plain' | 'suffix' = 'suffix'): number | null {
  const s = raw.trim().replace(/\s+/g, '')
  if (!/^\d+(?:[.,]\d+)*$/.test(s)) return null

  if (mode === 'plain') {
    const separatorCount = (s.match(/[.,]/g) || []).length
    if (separatorCount === 0) {
      const value = Number(s)
      return Number.isFinite(value) ? value : null
    }

    const compact = s.replace(/[.,]/g, '')
    if (!/^\d+$/.test(compact)) return null

    const compactValue = Number(compact)
    if (!Number.isFinite(compactValue)) return null

    return compactValue < 1_000 ? compactValue * 100 : compactValue
  }

  {
    const dotCount = (s.match(/\./g) || []).length
    const commaCount = (s.match(/,/g) || []).length

    if (dotCount > 0 && commaCount > 0) {
      const decimalSep = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
      const thousandSep = decimalSep === '.' ? ',' : '.'
      const pieces = s.split(decimalSep)
      if (pieces.length > 2) return null

      const [integerPart, fractionPart] = pieces
      if (!integerPart) return null

      const groups = integerPart.split(thousandSep)
      if (groups.length > 1 && groups.slice(1).some(group => group.length !== 3)) return null
      if (fractionPart !== undefined && !/^\d{1,2}$/.test(fractionPart)) return null

      const normalized = `${groups.join('')}${fractionPart ? `.${fractionPart}` : ''}`
      const value = Number(normalized)
      return Number.isFinite(value) ? value : null
    }

    const separator = dotCount > 0 ? '.' : commaCount > 0 ? ',' : null
    if (!separator) {
      const value = Number(s)
      return Number.isFinite(value) ? value : null
    }

    const parts = s.split(separator)
    if (parts.some(part => part.length === 0)) return null

    if (parts.length > 2) {
      if (parts.slice(1).some(part => part.length !== 3)) return null
      const value = Number(parts.join(''))
      return Number.isFinite(value) ? value : null
    }

    const [left, right] = parts
    const normalized =
      right.length === 3
        ? `${left}${right}`
        : right.length <= 2
          ? `${left}.${right}`
          : null

    if (!normalized) return null
    const value = Number(normalized)
    return Number.isFinite(value) ? value : null
  }

  // Multiple dots → all are thousands separators (e.g. "1.500.000")

  // Multiple commas → extremely rare, treat first as thousands sep

  // Single dot
    // "38.500" — right side is exactly 3 digits → thousands separator
    // "18.5" or "1.50" → genuine decimal

  // Single comma
    // "38,500" → thousands separator
    // "1,5" → decimal (European style)

  // Plain integer string "38500"
}

// ── Amount token parser ──────────────────────────────────────────────────────
/**
 * Attempts to parse a single whitespace-split token as a currency amount.
 * Returns null if the token is not an amount token.
 */
function parseAmountToken(token: string): number | null {
  const t = normalizeToken(token).replace(/^(rp|idr)(?=\d)/, '')

  // suffix-based patterns — capture numeric part then multiply
  // supports: 25k, 25K, 25rb, 25ribu, 2jt, 2juta, 1.5jt, 1,5jt, 3m, 3miliar
  const suffixPattern = /^(\d+(?:[.,]\d+)*)(k|rb|ribu|jt|juta|m|miliar|milyar)$/
  const suffixMatch = t.match(suffixPattern)

  if (suffixMatch) {
    const numPart = normalizeNumberString(suffixMatch[1], 'suffix')
    const suffix  = suffixMatch[2]
    if (numPart === null) return null
    return numPart * AMOUNT_SUFFIX_MULTIPLIERS[suffix]
  }

  // plain numeric token (digits, dots, commas only)
  if (/^[\d.,]+$/.test(t)) {
    const val = normalizeNumberString(t, 'plain')
    return val === null ? null : val
  }

  return null
}

function parseSplitSuffixAmount(tokens: string[], suffixIndex: number): { amount: number; indexes: Set<number> } | null {
  const suffix = normalizeToken(tokens[suffixIndex])
  const multiplier = AMOUNT_SUFFIX_MULTIPLIERS[suffix]
  if (!multiplier || suffixIndex === 0) return null

  const numeric = normalizeNumberString(normalizeToken(tokens[suffixIndex - 1]), 'suffix')
  if (numeric === null) return null

  return { amount: numeric * multiplier, indexes: new Set([suffixIndex - 1, suffixIndex]) }
}

function parseAmountEndingAt(tokens: string[], index: number): { amount: number; indexes: Set<number> } | null {
  const direct = parseAmountToken(tokens[index])
  if (direct !== null) return { amount: direct, indexes: new Set([index]) }
  return parseSplitSuffixAmount(tokens, index)
}

function amountWarning(tokens: string[], indexes: Set<number>, amount: number): string | undefined {
  if (amount >= 1_000 || indexes.size !== 1) return undefined
  const [index] = Array.from(indexes)
  const token = normalizeToken(tokens[index]).replace(/^(rp|idr)(?=\d)/, '')
  return /^\d+$/.test(token) ? 'Nominal di bawah Rp1.000?' : undefined
}

// ── Detect payment method ────────────────────────────────────────────────────
/**
 * Scans tokens left-to-right and returns the first payment method found.
 * Uses exact matching by default; the `contains` list allows substring
 * matching for compound keywords like "shopeepay".
 * Defaults to 'tunai' (cash) when no method is detected.
 */
function detectPaymentMethod(tokens: string[], extras?: ParserExtras): string {
  for (const token of tokens) {
    const tl = normalizeToken(token)
    // Custom user-defined payments take priority (their personal slang)
    if (extras?.payments) {
      for (const p of extras.payments) {
        if (p.keywords.some(kw => tl === normalizeToken(kw))) return p.id
      }
    }
    for (const entry of PAYMENT_MAP) {
      if (entry.exact.includes(tl)) return entry.method
      if (entry.contains.some(kw => tl.includes(kw))) return entry.method
    }
  }
  // Default: cash / tunai
  return 'tunai'
}

function detectExplicitPaymentMethod(tokens: string[], extras?: ParserExtras): string | null {
  for (const token of tokens) {
    if (isPaymentToken(token, extras)) return detectPaymentMethod([token], extras)
  }
  return null
}

// ── Token is a payment keyword? ──────────────────────────────────────────────
function isPaymentToken(token: string, extras?: ParserExtras): boolean {
  const tl = normalizeToken(token)
  if (extras?.payments) {
    for (const p of extras.payments) {
      if (p.keywords.some(kw => tl === normalizeToken(kw))) return true
    }
  }
  for (const entry of PAYMENT_MAP) {
    if (entry.exact.includes(tl)) return true
    if (entry.contains.some(kw => tl.includes(kw))) return true
  }
  return false
}

function isCurrencyToken(token: string): boolean {
  return CURRENCY_TOKENS.has(normalizeToken(token))
}

function findTrailingAmount(tokens: string[], extras?: ParserExtras): { amount: number; indexes: Set<number> } | null {
  let amountEndIndex = tokens.length - 1

  while (amountEndIndex >= 0 && isPaymentToken(tokens[amountEndIndex], extras)) {
    amountEndIndex -= 1
  }

  if (amountEndIndex < 0) return null
  const parsed = parseAmountEndingAt(tokens, amountEndIndex)
  if (!parsed || !Number.isFinite(parsed.amount) || parsed.amount <= 0) return null

  return {
    amount: Math.round(parsed.amount),
    indexes: parsed.indexes,
  }
}

function findAnyAmount(tokens: string[]): { amount: number; startIndex: number; endIndex: number; indexes: Set<number> } | null {
  for (let i = 0; i < tokens.length; i++) {
    const parsed = parseAmountEndingAt(tokens, i)
    if (!parsed || !Number.isFinite(parsed.amount) || parsed.amount <= 0) continue
    const indexes = Array.from(parsed.indexes)
    return {
      amount: Math.round(parsed.amount),
      startIndex: Math.min(...indexes),
      endIndex: Math.max(...indexes),
      indexes: parsed.indexes,
    }
  }
  return null
}

function hasKeyword(tokens: string[], keywords: string[]): boolean {
  return tokens.some(token => keywords.includes(normalizeToken(token)))
}

function parseTransferCommand(input: string, extras?: ParserExtras): ParsedTransfer | null {
  const trimmed = input.trim()
  const tokens = trimmed.split(/\s+/)
  const normalized = tokens.map(normalizeToken)

  if (!hasKeyword(tokens, ['pindah', 'transfer', 'kirim', 'topup'])) return null

  const amount = findAnyAmount(tokens)
  if (!amount) return null

  const keIndex = normalized.findIndex((token, index) => token === 'ke' && index !== 0)
  if (keIndex === -1) return null

  const tokensBetweenAmountAndTarget =
    keIndex > amount.endIndex
      ? tokens.slice(amount.endIndex + 1, keIndex)
      : []
  const tokensBeforeAmount = tokens
    .slice(0, amount.startIndex)
    .filter(token => !['pindah', 'transfer', 'kirim', 'topup', 'tf'].includes(normalizeToken(token)))
  const sourceTokens = tokensBetweenAmountAndTarget.length > 0 ? tokensBetweenAmountAndTarget : tokensBeforeAmount
  const destinationTokens = tokens.slice(keIndex + 1)

  const fromWalletId = detectExplicitPaymentMethod(sourceTokens, extras) ?? extras?.lastActiveWalletId ?? 'tunai'
  const toWalletId = detectExplicitPaymentMethod(destinationTokens, extras)

  if (!fromWalletId || !toWalletId || fromWalletId === toWalletId) return null

  return {
    kind: 'transfer',
    description: 'Pindah uang',
    amount: amount.amount,
    fromWalletId,
    toWalletId,
    rawInput: trimmed,
    confidence: 0.95,
    warning: amountWarning(tokens, amount.indexes, amount.amount),
  }
}

function parseSavingCommand(input: string, extras?: ParserExtras): ParsedSaving | null {
  const trimmed = input.trim()
  const tokens = trimmed.split(/\s+/)
  const normalized = tokens.map(normalizeToken)

  if (!hasKeyword(tokens, ['simpan', 'tabung', 'nabung', 'menabung'])) return null

  const amount = findAnyAmount(tokens)
  if (!amount) return null

  const dariIndex = normalized.findIndex(token => token === 'dari')
  const keIndex = normalized.findIndex(token => token === 'ke')
  const sourceTokens =
    dariIndex !== -1
      ? tokens.slice(dariIndex + 1, keIndex > dariIndex ? keIndex : tokens.length)
      : tokens.slice(amount.endIndex + 1, keIndex > amount.endIndex ? keIndex : tokens.length)
  const destinationTokens = keIndex !== -1 ? tokens.slice(keIndex + 1) : ['tabungan']

  const fromWalletId = detectExplicitPaymentMethod(sourceTokens, extras) ?? 'tunai'
  const toWalletId = detectExplicitPaymentMethod(destinationTokens, extras) ?? 'tabungan'

  if (fromWalletId === toWalletId) return null

  return {
    kind: 'saving',
    description: 'Simpan uang',
    amount: amount.amount,
    fromWalletId,
    toWalletId,
    rawInput: trimmed,
    confidence: 0.9,
    warning: amountWarning(tokens, amount.indexes, amount.amount),
  }
}

// ── Detect category ──────────────────────────────────────────────────────────
/**
 * Matches description text against category keyword lists.
 * Uses word-boundary detection: keyword must appear as a standalone word
 * (surrounded by non-word chars or string edges) to prevent false positives
 * like "bca" matching inside "abcana".
 */
function detectCategory(text: string, type: TransactionType, extras?: ParserExtras): string {
  const lower = text.toLowerCase()

  // Custom user-defined categories take priority (their personal slang)
  if (extras?.categories) {
    for (const c of extras.categories) {
      for (const kw of c.keywords) {
        if (kw && wordMatch(lower, kw)) return c.id
      }
    }
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    if (category === 'lainnya') continue
    for (const kw of keywords) {
      if (wordMatch(lower, kw)) return category
    }
  }

  if (type === 'income') return 'gaji'
  return 'lainnya'
}

// ── Detect transaction type ──────────────────────────────────────────────────
function detectType(text: string): TransactionType {
  const lower = text.toLowerCase()
  for (const kw of INCOME_KEYWORDS) {
    if (wordMatch(lower, kw)) return 'income'
  }
  return 'expense'
}

// ── Main parser ──────────────────────────────────────────────────────────────
export function parseTransaction(input: string, extras?: ParserExtras): ParsedTransaction | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const tokens = trimmed.split(/\s+/)

  // ── Step 1: Find the LAST amount token ──────────────────────────────────
  // Scanning from the end is more robust: in "ongkir grab 38k ovo",
  // the amount always comes just before the payment method.
  const trailingAmount = findTrailingAmount(tokens, extras)
  if (!trailingAmount) return null

  const { amount, indexes: amountIndexes } = trailingAmount
  const paymentTokens = tokens.filter(token => isPaymentToken(token, extras))

  // ── Step 2: Detect payment method ───────────────────────────────────────
  let paymentMethod = paymentTokens.length > 0 ? detectPaymentMethod(tokens, extras) : 'tunai'

  // ── Step 3: Build description ────────────────────────────────────────────
  // Include only tokens that are:
  //   - NOT the amount token (by index)
  //   - NOT a payment method token (by value)
  // This ensures "ongkir grab stasiun tawang 38k ovo" →
  // description = "ongkir grab stasiun tawang"
  const descTokens = tokens.filter((t, i) => {
    if (amountIndexes.has(i)) return false
    if (isCurrencyToken(t)) return false
    if (isPaymentToken(t, extras)) return false
    return true
  })

  const description = descTokens.join(' ').trim() || 'Transaksi'

  // ── Step 4: Classify ─────────────────────────────────────────────────────
  const type     = detectType(trimmed)
  if (type === 'income' && paymentMethod === 'transfer') {
    paymentMethod = extras?.lastActiveWalletId ?? 'bca'
  }
  const category = detectCategory(description, type, extras)

  // ── Step 5: Confidence score ─────────────────────────────────────────────
  // Deduct for missing signals; add for explicit payment method detection
  const hasDescription    = descTokens.length > 0
  const hasExplicitMethod = paymentTokens.length > 0
  const confidence =
    !hasDescription       ? 0.4
    : hasExplicitMethod   ? 0.95
    :                       0.75

  return {
    kind: 'transaction',
    description,
    amount,
    type,
    category,
    paymentMethod,
    rawInput: trimmed,
    confidence,
    warning: amountWarning(tokens, amountIndexes, amount),
  }
}

export function parseEntry(input: string, extras?: ParserExtras): ParsedEntry | null {
  return (
    parseTransferCommand(input, extras) ??
    parseSavingCommand(input, extras) ??
    parseTransaction(input, extras)
  )
}

// ── Format currency (IDR) ────────────────────────────────────────────────────
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatIDRCompact(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)}jt`
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)}rb`
  }
  return `Rp ${amount.toLocaleString('id-ID')}`
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatRelativeDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)

  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Kemarin'
  if (diff < 7) return `${diff} hari lalu`
  return formatDate(date)
}
