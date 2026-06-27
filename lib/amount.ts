/**
 * @deprecated — DEPRECATED sejak audit fix #2.
 * File ini sebelumnya menyimpan parser nominal kedua yang LEBIH TERBATAS
 * daripada engine utama di lib/parser.ts (tidak mengenal "rbu", "rebu",
 * "jeti", "m", "miliar", dan keliru menafsirkan "15.500" sebagai desimal).
 *
 * Sekarang seluruh aplikasi menggunakan parser tunggal `parseAmountToken`
 * dari lib/parser.ts. Modul ini dipertahankan hanya sebagai shim untuk
 * importer eksternal lama; akan dihapus di rilis berikutnya.
 */
import { parseAmountToken } from './parser'

/**
 * @deprecated Pakai `parseAmountToken` dari `@/lib/parser`.
 */
export function parseAmountInput(raw: string): number {
  const compact = raw.trim().replace(/\s+/g, '')
  if (!compact) return 0
  const parsed = parseAmountToken(compact)
  return parsed && parsed > 0 ? Math.round(parsed) : 0
}
