/**
 * SakuKilat — Smart Natural Language Transaction Parser
 * Parses Indonesian natural language input like:
 *   "makan soto 25k gopay"
 *   "terima gaji 5jt transfer"
 *   "beli kopi 18.500 tunai"
 *   "bayar listrik 200rb"
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
const PAYMENT_KEYWORDS: Record<PaymentMethod, string[]> = {
  gopay:     ['gopay', 'gp'],
  ovo:       ['ovo'],
  dana:      ['dana'],
  shopeepay: ['shopeepay', 'spay', 'shopee'],
  bca:       ['bca', 'm-bca', 'klikbca'],
  bni:       ['bni'],
  bri:       ['bri', 'brimo'],
  mandiri:   ['mandiri', 'livin'],
  tunai:     ['tunai', 'cash', 'kontan'],
  transfer:  ['transfer', 'tf'],
  qris:      ['qris'],
  kartu:     ['kartu', 'debit', 'kredit', 'cc'],
  lainnya:   [],
}

// ── Income keywords ──────────────────────────────────────────────────────────
const INCOME_KEYWORDS = [
  'gaji', 'salary', 'terima', 'dapat', 'pemasukan', 'income',
  'bonus', 'komisi', 'dividen', 'honor', 'fee', 'jual', 'bayar ke',
  'transfer masuk', 'refund', 'cashback', 'hadiah',
]

// ── Category keyword map ─────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  makanan: [
    'makan', 'minum', 'kopi', 'teh', 'nasi', 'soto', 'bakso', 'mie',
    'ayam', 'pizza', 'burger', 'sushi', 'resto', 'warung', 'kantin',
    'cafe', 'kafe', 'snack', 'camilan', 'jajan', 'boba', 'juice',
    'mcdonalds', 'kfc', 'indomaret', 'alfamart', 'grab food', 'gofood',
    'shopee food', 'tokopedia food', 'pecel', 'rawon', 'sate',
    'martabak', 'gorengan', 'mi', 'mie ayam', 'indomie', 'es',
  ],
  transportasi: [
    'bensin', 'bbm', 'parkir', 'tol', 'ojek', 'gojek', 'grab',
    'taxi', 'taksi', 'busway', 'transjakarta', 'kereta', 'commuter',
    'krl', 'mrt', 'lrt', 'bis', 'angkot', 'travel', 'pesawat',
    'tiket', 'uber', 'maxim', 'servis motor', 'servis mobil', 'cuci',
  ],
  belanja: [
    'beli', 'belanja', 'shopee', 'tokopedia', 'lazada', 'tiktok shop',
    'baju', 'celana', 'sepatu', 'tas', 'elektronik', 'hp', 'laptop',
    'charger', 'kabel', 'aksesoris', 'kosmetik', 'skincare', 'parfum',
    'buku', 'alat tulis', 'peralatan', 'furniture', 'supermarket',
  ],
  hiburan: [
    'netflix', 'spotify', 'youtube', 'game', 'bioskop', 'film',
    'konser', 'event', 'tiket nonton', 'steam', 'playstation',
    'xbox', 'disney+', 'prime', 'vidio', 'cinema',
  ],
  kesehatan: [
    'dokter', 'rumah sakit', 'rs', 'klinik', 'apotek', 'obat',
    'vitamin', 'suplemen', 'gym', 'fitness', 'olahraga', 'sport',
    'periksa', 'laboratorium', 'lab', 'radiologi', 'dental', 'gigi',
  ],
  pendidikan: [
    'kursus', 'les', 'bimbel', 'sekolah', 'kampus', 'kuliah',
    'spp', 'ukt', 'buku pelajaran', 'udemy', 'coursera', 'dicoding',
    'ruangguru', 'zenius', 'seminar', 'pelatihan', 'workshop',
  ],
  tagihan: [
    'listrik', 'pln', 'air', 'pdam', 'internet', 'wifi', 'speedy',
    'indihome', 'telkom', 'pulsa', 'paket data', 'tv kabel',
    'iuran', 'pajak', 'bpjs', 'asuransi', 'cicilan', 'angsuran',
    'kpr', 'kredit', 'tagihan', 'bayar',
  ],
  gaji: [
    'gaji', 'salary', 'upah', 'honor', 'thr', 'bonus', 'komisi',
    'insentif', 'fee', 'honorarium',
  ],
  investasi: [
    'investasi', 'saham', 'reksadana', 'reksa dana', 'crypto',
    'bitcoin', 'ethereum', 'emas', 'deposito', 'obligasi', 'tabungan',
    'nabung', 'bibit', 'ajaib',
  ],
  transfer: [
    'transfer', 'kirim', 'tf', 'setor', 'tarik tunai',
  ],
  lainnya: [],
}

// ── Amount parser ────────────────────────────────────────────────────────────
function parseAmount(token: string): number | null {
  // Normalize
  const t = token.toLowerCase().trim()

  // Patterns: 25k, 25rb, 25ribu, 2jt, 2juta, 1.5jt, 18.500, 200000
  const withK  = t.match(/^([\d]+(?:[.,]\d+)?)\s*k$/)
  const withRb = t.match(/^([\d]+(?:[.,]\d+)?)\s*(?:rb|ribu)$/)
  const withJt = t.match(/^([\d]+(?:[.,]\d+)?)\s*(?:jt|juta)$/)
  const withM  = t.match(/^([\d]+(?:[.,]\d+)?)\s*(?:m|miliar|milyar)$/)
  const plain  = t.match(/^[\d.,]+$/)

  const toNum = (s: string) => parseFloat(s.replace(',', '.'))

  if (withK)  return toNum(withK[1])  * 1_000
  if (withRb) return toNum(withRb[1]) * 1_000
  if (withJt) return toNum(withJt[1]) * 1_000_000
  if (withM)  return toNum(withM[1])  * 1_000_000_000

  if (plain) {
    // Handle "18.500" (Indonesian thousands separator) vs "18.5" (decimal)
    const cleaned = t.replace(/\./g, '').replace(',', '.')
    const val = parseFloat(cleaned)
    return isNaN(val) ? null : val
  }

  return null
}

// ── Detect payment method ───────────────────────────────────────────────────
function detectPaymentMethod(tokens: string[]): PaymentMethod {
  for (const token of tokens) {
    for (const [method, keywords] of Object.entries(PAYMENT_KEYWORDS) as [PaymentMethod, string[]][]) {
      if (keywords.some(kw => token.toLowerCase() === kw || token.toLowerCase().includes(kw))) {
        return method
      }
    }
  }
  return 'lainnya'
}

// ── Detect category ─────────────────────────────────────────────────────────
function detectCategory(text: string, type: TransactionType): Category {
  const lower = text.toLowerCase()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    if (category === 'lainnya') continue
    for (const kw of keywords) {
      if (lower.includes(kw)) return category
    }
  }

  if (type === 'income') return 'gaji'
  return 'lainnya'
}

// ── Detect transaction type ─────────────────────────────────────────────────
function detectType(text: string): TransactionType {
  const lower = text.toLowerCase()
  for (const kw of INCOME_KEYWORDS) {
    if (lower.includes(kw)) return 'income'
  }
  return 'expense'
}

// ── Main parser ─────────────────────────────────────────────────────────────
export function parseTransaction(input: string): ParsedTransaction | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const tokens = trimmed.split(/\s+/)

  // Find amount token
  let amountIndex = -1
  let amount = 0

  for (let i = 0; i < tokens.length; i++) {
    const parsed = parseAmount(tokens[i])
    if (parsed !== null && parsed > 0) {
      amount = parsed
      amountIndex = i
      break
    }
  }

  if (amount === 0) return null

  // Build description from non-amount, non-payment tokens
  const paymentMethod = detectPaymentMethod(tokens)
  const paymentKeywords = new Set<string>()
  for (const [, keywords] of Object.entries(PAYMENT_KEYWORDS)) {
    keywords.forEach(kw => paymentKeywords.add(kw.toLowerCase()))
  }

  const descTokens = tokens.filter((t, i) => {
    if (i === amountIndex) return false
    if (paymentKeywords.has(t.toLowerCase())) return false
    return true
  })

  const description = descTokens.join(' ').trim() || 'Transaksi'

  const type = detectType(trimmed)
  const category = detectCategory(trimmed, type)

  // Confidence: high if we found amount + description + payment method
  const hasDescription = descTokens.length > 0
  const hasPayment = paymentMethod !== 'lainnya'
  const confidence = hasDescription && hasPayment ? 0.95 : hasDescription ? 0.75 : 0.5

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
