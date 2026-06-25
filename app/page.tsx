'use client'

import { useState, useMemo, useCallback } from 'react'
import { BalanceHeader } from '@/components/balance-header'
import { TransactionList } from '@/components/transaction-list'
import { SmartInput } from '@/components/smart-input'
import { FilterTabs, type FilterTab } from '@/components/filter-tabs'
import { parseTransaction } from '@/lib/parser'
import { MOCK_TRANSACTIONS, generateId, mockSupabaseMutate, type Transaction } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { Zap } from 'lucide-react'

export default function SakuKilatPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newTransactionId, setNewTransactionId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('semua')
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // ── Derived stats ─────────────────────────────────────────────────────────
  const { totalIncome, totalExpense, totalBalance, filteredTransactions } = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonth = transactions.filter(t => t.date >= monthStart)

    const income  = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const filtered =
      activeFilter === 'semua'       ? transactions
      : activeFilter === 'pengeluaran' ? transactions.filter(t => t.type === 'expense')
      : transactions.filter(t => t.type === 'income')

    return { totalIncome: income, totalExpense: expense, totalBalance: income - expense, filteredTransactions: filtered }
  }, [transactions, activeFilter])

  const filterCounts = useMemo(() => ({
    semua:       transactions.length,
    pengeluaran: transactions.filter(t => t.type === 'expense').length,
    pemasukan:   transactions.filter(t => t.type === 'income').length,
  }), [transactions])

  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  // ── Optimistic add ────────────────────────────────────────────────────────
  const handleAddTransaction = useCallback(async (input: string) => {
    const parsed = parseTransaction(input)
    if (!parsed || parsed.amount === 0) {
      showToast('Gagal mengurai. Coba: "makan 25k gopay"', 'error')
      return
    }

    setIsSubmitting(true)

    const optimisticId = generateId()
    const optimisticTransaction: Transaction = {
      id: optimisticId,
      description: parsed.description,
      amount: parsed.amount,
      type: parsed.type,
      category: parsed.category,
      paymentMethod: parsed.paymentMethod,
      date: new Date(),
      isPending: true,
      syncStatus: 'syncing',
    }

    // Step 1 — Instant optimistic update
    setTransactions(prev => [optimisticTransaction, ...prev])
    setNewTransactionId(optimisticId)
    setIsSubmitting(false)
    setTimeout(() => setNewTransactionId(null), 800)

    // Step 2 — Background Supabase mutation (mocked)
    const result = await mockSupabaseMutate(optimisticTransaction)

    if (result.success) {
      setTransactions(prev =>
        prev.map(t => t.id === optimisticId ? { ...t, isPending: false, syncStatus: 'synced' } : t)
      )
      showToast('Transaksi berhasil dicatat!', 'success')
    } else {
      setTransactions(prev =>
        prev.map(t => t.id === optimisticId ? { ...t, isPending: false, syncStatus: 'error' } : t)
      )
      showToast('Sinkronisasi gagal. Akan dicoba ulang.', 'error')
    }
  }, [showToast])

  const handleDeleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
    showToast('Transaksi dihapus', 'success')
  }, [showToast])

  const periodLabel = useMemo(() =>
    new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date()),
  [])

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col">

      {/* ════════════════════════════════════════
          DESKTOP LAYOUT (md+)
          Input pinned at top, content scrolls below
      ════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col min-h-screen max-w-2xl mx-auto w-full">

        {/* Sticky top bar with brand + input */}
        <div className="sticky top-0 z-30 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-[var(--sk-border)] px-8 py-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--sk-cyan)] shadow-[0_0_12px_var(--sk-cyan-glow)]">
              <Zap className="w-4 h-4 text-[#0B0F19] fill-current" strokeWidth={0} />
            </div>
            <span className="text-sm font-semibold text-[var(--sk-text)] tracking-tight">SakuKilat</span>
          </div>
          <SmartInput onSubmit={handleAddTransaction} isSubmitting={isSubmitting} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <BalanceHeader
            totalBalance={totalBalance}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            period={periodLabel}
          />

          <div className="px-8 pb-4">
            <FilterTabs active={activeFilter} onChange={setActiveFilter} counts={filterCounts} />
          </div>

          <div className="pb-10">
            <TransactionList
              transactions={filteredTransactions}
              onDelete={handleDeleteTransaction}
              newTransactionId={newTransactionId}
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          MOBILE LAYOUT (< md)
          Content scrolls, input docked at bottom
      ════════════════════════════════════════ */}
      <div className="flex flex-col min-h-screen md:hidden">

        {/* Scrollable body — padded above docked bar */}
        <div className="flex-1 overflow-y-auto pb-[88px]">
          <BalanceHeader
            totalBalance={totalBalance}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            period={periodLabel}
          />

          {/* Sticky filter strip */}
          <div className="sticky top-0 z-20 bg-[#0B0F19]/90 backdrop-blur-xl px-4 py-3 border-b border-[var(--sk-border)]">
            <FilterTabs active={activeFilter} onChange={setActiveFilter} counts={filterCounts} />
          </div>

          <div className="pt-3 pb-4">
            <TransactionList
              transactions={filteredTransactions}
              onDelete={handleDeleteTransaction}
              newTransactionId={newTransactionId}
            />
          </div>
        </div>

        {/* Docked input bar — chat app style */}
        <div className="fixed bottom-0 left-0 right-0 z-40 sk-glass border-t border-[var(--sk-border-2)] safe-bottom">
          <div className="px-4 py-3">
            <SmartInput onSubmit={handleAddTransaction} isSubmitting={isSubmitting} />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          TOAST NOTIFICATION
      ════════════════════════════════════════ */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-50 animate-slide-up bottom-[96px] left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-auto"
        >
          <div
            className={cn(
              'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border backdrop-blur-xl',
              toastMessage.type === 'success'
                ? 'bg-[var(--sk-green-dim)] border-[rgba(52,211,153,0.3)] text-[var(--sk-green)]'
                : 'bg-[var(--sk-red-dim)] border-[rgba(248,113,113,0.3)] text-[var(--sk-red)]'
            )}
          >
            <span className={cn(
              'inline-block w-2 h-2 rounded-full flex-shrink-0',
              toastMessage.type === 'success' ? 'bg-[var(--sk-green)]' : 'bg-[var(--sk-red)]'
            )} />
            {toastMessage.text}
          </div>
        </div>
      )}
    </div>
  )
}
