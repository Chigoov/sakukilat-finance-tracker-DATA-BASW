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
  description: string
  amount: number
  type: TransactionType
  category: Category
  paymentMethod: PaymentMethod
  rawInput: string
  confidence: number // 0-1
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

// Flat set of all payment token strings (for description stripping)
function buildPaymentTokenSet(): Set<string> {
  const s = new Set<string>()
  for (const entry of PAYMENT_MAP) {
    entry.exact.forEach(kw => s.add(kw))
    entry.contains.forEach(kw => s.add(kw))
  }
  return s
}
const ALL_PAYMENT_TOKENS = buildPaymentTokenSet()

// ── Income keywords ──────────────────────────────────────────────────────────
const INCOME_KEYWORDS = [
  'gaji', 'salary', 'terima', 'dapat', 'pemasukan', 'income',
  'bonus', 'komisi', 'dividen', 'honor', 'fee', 'jual',
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
function normalizeNumberString(raw: string): number {
  const s = raw.trim()

  // Multiple dots → all are thousands separators (e.g. "1.500.000")
  const dotCount = (s.match(/\./g) || []).length
  if (dotCount > 1) {
    return parseFloat(s.replace(/\./g, ''))
  }

  // Multiple commas → extremely rare, treat first as thousands sep
  const commaCount = (s.match(/,/g) || []).length
  if (commaCount > 1) {
    return parseFloat(s.replace(/,/g, ''))
  }

  // Single dot
  if (dotCount === 1) {
    const parts = s.split('.')
    // "38.500" — right side is exactly 3 digits → thousands separator
    if (parts[1].length === 3) {
      return parseFloat(s.replace('.', ''))
    }
    // "18.5" or "1.50" → genuine decimal
    return parseFloat(s)
  }

  // Single comma
  if (commaCount === 1) {
    const parts = s.split(',')
    // "38,500" → thousands separator
    if (parts[1].length === 3) {
      return parseFloat(s.replace(',', ''))
    }
    // "1,5" → decimal (European style)
    return parseFloat(s.replace(',', '.'))
  }

  // Plain integer string "38500"
  return parseFloat(s)
}

// ── Amount token parser ──────────────────────────────────────────────────────
/**
 * Attempts to parse a single whitespace-split token as a currency amount.
 * Returns null if the token is not an amount token.
 */
function parseAmountToken(token: string): number | null {
  const t = token.toLowerCase().trim()

  // suffix-based patterns — capture numeric part then multiply
  // supports: 25k, 25K, 25rb, 25ribu, 2jt, 2juta, 1.5jt, 1,5jt, 3m, 3miliar
  const suffixPattern = /^([\d]+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m|miliar|milyar)$/
  const suffixMatch = t.match(suffixPattern)

  if (suffixMatch) {
    const numPart = normalizeNumberString(suffixMatch[1])
    const suffix  = suffixMatch[2]
    if (suffix === 'k' || suffix === 'rb' || suffix === 'ribu') return numPart * 1_000
    if (suffix === 'jt' || suffix === 'juta')                   return numPart * 1_000_000
    if (suffix === 'm' || suffix === 'miliar' || suffix === 'milyar') return numPart * 1_000_000_000
  }

  // plain numeric token (digits, dots, commas only)
  if (/^[\d.,]+$/.test(t)) {
    const val = normalizeNumberString(t)
    return isNaN(val) ? null : val
  }

  return null
}

// ── Detect payment method ────────────────────────────────────────────────────
/**
 * Scans tokens left-to-right and returns the first payment method found.
 * Uses exact matching by default; the `contains` list allows substring
 * matching for compound keywords like "shopeepay".
 * Defaults to 'tunai' (cash) when no method is detected.
 */
function detectPaymentMethod(tokens: string[]): PaymentMethod {
  for (const token of tokens) {
    const tl = token.toLowerCase()
    for (const entry of PAYMENT_MAP) {
      if (entry.exact.includes(tl)) return entry.method
      if (entry.contains.some(kw => tl.includes(kw))) return entry.method
    }
  }
  // Default: cash / tunai
  return 'tunai'
}

// ── Token is a payment keyword? ──────────────────────────────────────────────
function isPaymentToken(token: string): boolean {
  const tl = token.toLowerCase()
  for (const entry of PAYMENT_MAP) {
    if (entry.exact.includes(tl)) return true
    if (entry.contains.some(kw => tl.includes(kw))) return true
  }
  return false
}

// ── Detect category ──────────────────────────────────────────────────────────
/**
 * Matches description text against category keyword lists.
 * Uses word-boundary detection: keyword must appear as a standalone word
 * (surrounded by non-word chars or string edges) to prevent false positives
 * like "bca" matching inside "abcana".
 */
function detectCategory(text: string, type: TransactionType): Category {
  const lower = text.toLowerCase()

  // Helper: test if `kw` appears as a whole-word match in `str`
  const wordMatch = (str: string, kw: string): boolean => {
    // Use a simple regex word-boundary approach
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i').test(str)
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
    if (lower.includes(kw)) return 'income'
  }
  return 'expense'
}

// ── Main parser ──────────────────────────────────────────────────────────────
export function parseTransaction(input: string): ParsedTransaction | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const tokens = trimmed.split(/\s+/)

  // ── Step 1: Find the LAST amount token ──────────────────────────────────
  // Scanning from the end is more robust: in "ongkir grab 38k ovo",
  // the amount always comes just before the payment method.
  let amountIndex = -1
  let amount = 0

  for (let i = tokens.length - 1; i >= 0; i--) {
    const parsed = parseAmountToken(tokens[i])
    if (parsed !== null && parsed > 0) {
      amount = parsed
      amountIndex = i
      break
    }
  }

  if (amount === 0 || amountIndex === -1) return null

  // ── Step 2: Detect payment method ───────────────────────────────────────
  const paymentMethod = detectPaymentMethod(tokens)

  // ── Step 3: Build description ────────────────────────────────────────────
  // Include only tokens that are:
  //   - NOT the amount token (by index)
  //   - NOT a payment method token (by value)
  // This ensures "ongkir grab stasiun tawang 38k ovo" →
  // description = "ongkir grab stasiun tawang"
  const descTokens = tokens.filter((t, i) => {
    if (i === amountIndex) return false
    if (isPaymentToken(t)) return false
    return true
  })

  const description = descTokens.join(' ').trim() || 'Transaksi'

  // ── Step 4: Classify ─────────────────────────────────────────────────────
  const type     = detectType(trimmed)
  const category = detectCategory(description, type)

  // ── Step 5: Confidence score ─────────────────────────────────────────────
  // Deduct for missing signals; add for explicit payment method detection
  const hasDescription    = descTokens.length > 0
  const hasExplicitMethod = paymentMethod !== 'tunai' // tunai = default fallback
  const confidence =
    !hasDescription       ? 0.4
    : hasExplicitMethod   ? 0.95
    :                       0.75

  return {
    description,
    amount,
    type,
    category,
    paymentMethod,
    rawInput: trimmed,
    confidence,
  }
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
