import type { Transaction } from './mock-data'

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Monthly totals (current calendar month) ───────────────────────────────────
export function monthlyTotals(transactions: Transaction[], ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const inMonth = transactions.filter(t => t.date >= start)
  const income = inMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = inMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  return { income, expense, balance: income - expense }
}

// ── Category breakdown for the donut (expenses only, current month) ────────────
export interface CategorySlice {
  category: string
  total: number
  pct: number
}
export function categoryBreakdown(transactions: Transaction[], ref = new Date()): CategorySlice[] {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense' || t.date < start) continue
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  const total = Array.from(map.values()).reduce((s, v) => s + v, 0)
  return Array.from(map.entries())
    .map(([category, val]) => ({ category, total: val, pct: total ? val / total : 0 }))
    .sort((a, b) => b.total - a.total)
}

// ── Per-day aggregates for the calendar heatmap ────────────────────────────────
export interface DayAgg {
  expense: number
  income: number
  count: number
}
export function dailyAggregates(transactions: Transaction[]): Map<string, DayAgg> {
  const map = new Map<string, DayAgg>()
  for (const t of transactions) {
    const key = dayKey(t.date)
    const cur = map.get(key) ?? { expense: 0, income: 0, count: 0 }
    if (t.type === 'expense') cur.expense += t.amount
    else cur.income += t.amount
    cur.count += 1
    map.set(key, cur)
  }
  return map
}

export function transactionsForDay(transactions: Transaction[], key: string): Transaction[] {
  return transactions
    .filter(t => dayKey(t.date) === key)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

// ── Trend series for charts ────────────────────────────────────────────────────
export type TrendRange = '7d' | '30d' | '1y'

export interface TrendPoint {
  label: string
  expense: number
  income: number
}

export function trendSeries(transactions: Transaction[], range: TrendRange): TrendPoint[] {
  const now = new Date()

  if (range === '1y') {
    // 12 months
    const points: TrendPoint[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const label = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(d)
      let expense = 0, income = 0
      for (const t of transactions) {
        if (t.date >= d && t.date < next) {
          if (t.type === 'expense') expense += t.amount
          else income += t.amount
        }
      }
      points.push({ label, expense, income })
    }
    return points
  }

  const days = range === '7d' ? 7 : 30
  const points: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = dayKey(d)
    const label =
      range === '7d'
        ? new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d)
        : new Intl.DateTimeFormat('id-ID', { day: 'numeric' }).format(d)
    let expense = 0, income = 0
    for (const t of transactions) {
      if (dayKey(t.date) === key) {
        if (t.type === 'expense') expense += t.amount
        else income += t.amount
      }
    }
    points.push({ label, expense, income })
  }
  return points
}

// ── Supportive insight: which category improved most week-over-week ────────────
export function topSavedCategory(transactions: Transaction[]): string | null {
  const now = new Date()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  const prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)

  const sumByCat = (from: Date, to: Date) => {
    const m = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      if (t.date >= from && t.date < to) m.set(t.category, (m.get(t.category) ?? 0) + t.amount)
    }
    return m
  }

  const thisWeek = sumByCat(weekStart, new Date(now.getTime() + 86_400_000))
  const prevWeek = sumByCat(prevStart, weekStart)

  let best: string | null = null
  let bestDrop = 0
  for (const [cat, prev] of prevWeek.entries()) {
    const cur = thisWeek.get(cat) ?? 0
    const drop = prev - cur
    if (drop > bestDrop) {
      bestDrop = drop
      best = cat
    }
  }
  return best
}
