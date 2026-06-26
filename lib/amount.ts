export function parseAmountInput(raw: string): number {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/^rp/, '')
  if (!normalized) return 0

  const match = normalized.match(/^(\d+(?:[.,]\d+)?)(k|rb|ribu|jt|juta)?$/)
  if (!match) return 0

  const numeric = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(numeric)) return 0

  const suffix = match[2]
  if (suffix === 'k' || suffix === 'rb' || suffix === 'ribu') return Math.round(numeric * 1_000)
  if (suffix === 'jt' || suffix === 'juta') return Math.round(numeric * 1_000_000)
  return Math.round(numeric)
}
