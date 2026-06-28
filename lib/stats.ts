import type { Transaction } from './mock-data'

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isMoneyMove(t: Transaction): boolean {
  return t.kind === 'transfer' || t.kind === 'saving'
}

function monthBounds(ref: Date): { start: Date; end: Date } {
  return {
    start: new Date(ref.getFullYear(), ref.getMonth(), 1),
    end: new Date(ref.getFullYear(), ref.getMonth() + 1, 1),
  }
}

// ── Monthly totals (current calendar month) ───────────────────────────────────
export function monthlyTotals(transactions: Transaction[], ref = new Date()) {
  const { start, end } = monthBounds(ref)
  const inMonth = transactions.filter(t => t.date >= start && t.date < end && !isMoneyMove(t))
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
export function categoryBreakdown(
  transactions: Transaction[],
  ref = new Date(),
  type: 'expense' | 'income' = 'expense'
): CategorySlice[] {
  const { start, end } = monthBounds(ref)
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (isMoneyMove(t) || t.type !== type || t.date < start || t.date >= end) continue
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
    if (!isMoneyMove(t)) {
      if (t.type === 'expense') cur.expense += t.amount
      else cur.income += t.amount
    }
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

const MS_DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function trendSeriesForPeriod(transactions: Transaction[], start: Date, end: Date): TrendPoint[] {
  const from = startOfDay(start)
  const until = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
  if (until <= from) return []

  const days = Math.ceil((until.getTime() - from.getTime()) / MS_DAY)
  const groupMonthly = days > 62
  const formatter = groupMonthly
    ? new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' })
    : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
  const keyedPoints: Array<TrendPoint & { key: string }> = []

  if (groupMonthly) {
    for (
      let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      cursor < until;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    ) {
      keyedPoints.push({ key: monthKey(cursor), label: formatter.format(cursor), expense: 0, income: 0 })
    }
  } else {
    for (let i = 0; i < days; i++) {
      const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
      keyedPoints.push({ key: dayKey(cursor), label: formatter.format(cursor), expense: 0, income: 0 })
    }
  }

  const pointByKey = new Map(keyedPoints.map(point => [point.key, point]))
  for (const t of transactions) {
    if (isMoneyMove(t) || t.date < from || t.date >= until) continue
    const point = pointByKey.get(groupMonthly ? monthKey(t.date) : dayKey(t.date))
    if (!point) continue
    if (t.type === 'expense') point.expense += t.amount
    else point.income += t.amount
  }

  return keyedPoints.map(({ key, ...point }) => point)
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
        if (!isMoneyMove(t) && t.date >= d && t.date < next) {
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
      if (!isMoneyMove(t) && dayKey(t.date) === key) {
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
      if (isMoneyMove(t) || t.type !== 'expense') continue
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

export interface BudgetStatus {
  budget: number
  spent: number
  remaining: number
  daysInMonth: number
  dayOfMonth: number
  remainingDays: number
  weekOfMonth: number
  totalWeeks: number
  weekStartDay: number
  weekEndDay: number
  remainingWeekDays: number
  baseDailyBudget: number
  baseWeeklyBudget: number
  dynamicDailyBudget: number
  weeklySpent: number
  weeklyRemaining: number
  todayExpense: number
  todayOverBase: boolean
  weekOverBase: boolean
  pctUsed: number
  pctWeekUsed: number
  roast: string | null
}

const BUDGET_ROASTS = [
  'Budget bulan ini sudah wafat. Dompetmu minta cuti dulu.',
  'Keuanganmu barusan melakukan parkour tanpa helm.',
  'Sisa bulan masih panjang, tapi budget sudah pulang duluan.',
  'Ini bukan bocor halus lagi, ini keran finansial kebuka penuh.',
]

export function monthlyBudgetStatus(
  transactions: Transaction[],
  budget: number,
  ref = new Date()
): BudgetStatus {
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
  const dayOfMonth = ref.getDate()
  const remainingDays = Math.max(1, daysInMonth - dayOfMonth + 1)
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const tomorrow = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1)
  const todayKey = dayKey(ref)
  const totalWeeks = 4
  const weekOfMonth = Math.min(totalWeeks, Math.floor((dayOfMonth - 1) / 7) + 1)
  const weekStartDay = (weekOfMonth - 1) * 7 + 1
  const weekEndDay = weekOfMonth === totalWeeks ? daysInMonth : Math.min(daysInMonth, weekStartDay + 6)
  const weekStart = new Date(ref.getFullYear(), ref.getMonth(), weekStartDay)
  const weekEndExclusive = new Date(ref.getFullYear(), ref.getMonth(), weekEndDay + 1)
  const remainingWeekDays = Math.max(1, weekEndDay - dayOfMonth + 1)

  let spent = 0
  let weeklySpent = 0
  let todayExpense = 0

  for (const t of transactions) {
    if (isMoneyMove(t) || t.type !== 'expense' || t.date < start || t.date >= tomorrow) continue
    spent += t.amount
    if (t.date >= weekStart && t.date < weekEndExclusive) weeklySpent += t.amount
    if (dayKey(t.date) === todayKey) todayExpense += t.amount
  }

  const safeBudget = Math.max(0, budget)
  const remaining = safeBudget - spent
  const baseDailyBudget = safeBudget / daysInMonth
  const baseWeeklyBudget = safeBudget / totalWeeks
  const weeklyRemaining = baseWeeklyBudget - weeklySpent
  const dynamicDailyBudget = Math.max(0, weeklyRemaining / remainingWeekDays)
  const overBudget = spent > safeBudget && safeBudget > 0
  const roastIndex = safeBudget > 0 ? Math.min(BUDGET_ROASTS.length - 1, Math.floor((spent / safeBudget - 1) * 4)) : 0

  return {
    budget: safeBudget,
    spent,
    remaining,
    daysInMonth,
    dayOfMonth,
    remainingDays,
    weekOfMonth,
    totalWeeks,
    weekStartDay,
    weekEndDay,
    remainingWeekDays,
    baseDailyBudget,
    baseWeeklyBudget,
    dynamicDailyBudget,
    weeklySpent,
    weeklyRemaining,
    todayExpense,
    todayOverBase: todayExpense > baseDailyBudget && safeBudget > 0,
    weekOverBase: weeklySpent > baseWeeklyBudget && safeBudget > 0,
    pctUsed: safeBudget > 0 ? spent / safeBudget : 0,
    pctWeekUsed: baseWeeklyBudget > 0 ? weeklySpent / baseWeeklyBudget : 0,
    roast: overBudget ? BUDGET_ROASTS[roastIndex] : null,
  }
}
