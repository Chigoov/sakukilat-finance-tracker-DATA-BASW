'use client'

/**
 * SakuKilat — Cloud Sync (Firestore)
 * ----------------------------------
 * Lapisan persistence sebenarnya yang menggantikan `mockSupabaseMutate`.
 * Tugas:
 *   • Memuat snapshot data per-user saat login (transaksi, saku, preferensi).
 *   • Mendorong setiap mutasi (tambah/hapus transaksi, ubah saku, ubah budget,
 *     ubah slang) ke Firestore secara fire-and-forget — kegagalan dilog tanpa
 *     memblok UI optimistis di sisi React.
 *
 * Isolasi data per-user dijamin oleh Firestore Security Rules
 * (lihat firestore.rules pada akar repo):
 *   match /users/{userId}/{document=**} {
 *     allow read, write: if request.auth != null && request.auth.uid == userId;
 *   }
 *
 * Catatan: localStorage tetap dipakai sebagai *offline cache* — bukan lagi
 * "database" satu-satunya. Bila kuota habis atau cache dibersihkan, data
 * lengkap akan dipulihkan dari Firestore pada sesi berikutnya.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
  Timestamp,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { firebaseApp } from './firebase'
import type { Transaction, WalletAccount } from './mock-data'
import type { CustomCategory, CustomPayment } from './parser'

export const db = getFirestore(firebaseApp)

// ── Types ──────────────────────────────────────────────────────────────────
export type CloudThemeMode = 'system' | 'dark' | 'light'

export interface CloudSettings {
  monthlyBudget?: number
  customPayments?: CustomPayment[]
  customCategories?: CustomCategory[]
  zenMode?: boolean
  themeMode?: CloudThemeMode
  profileName?: string | null
}

export interface CloudSnapshot extends CloudSettings {
  transactions: Transaction[]
  wallets: WalletAccount[]
}

// ── Path helpers ───────────────────────────────────────────────────────────
function userTransactions(uid: string) {
  return collection(db, 'users', uid, 'transactions')
}
function userWallets(uid: string) {
  return collection(db, 'users', uid, 'wallets')
}
function userSettings(uid: string) {
  return doc(db, 'users', uid, 'meta', 'settings')
}

// ── Date <-> Timestamp helpers ─────────────────────────────────────────────
function serializeTransaction(txn: Transaction): DocumentData {
  return {
    ...txn,
    date: Timestamp.fromDate(txn.date),
  }
}

function deserializeTransaction(id: string, data: DocumentData): Transaction {
  const rawDate = data.date
  const date =
    rawDate && typeof (rawDate as Timestamp).toDate === 'function'
      ? (rawDate as Timestamp).toDate()
      : new Date(rawDate as string | number)

  return {
    id,
    description: String(data.description ?? ''),
    amount: Number(data.amount ?? 0),
    type: data.type === 'income' ? 'income' : 'expense',
    category: String(data.category ?? 'lainnya'),
    paymentMethod: String(data.paymentMethod ?? 'tunai'),
    kind: data.kind === 'transfer' || data.kind === 'saving' ? data.kind : 'transaction',
    fromWalletId: data.fromWalletId,
    toWalletId: data.toWalletId,
    date,
    isPending: false,
    syncStatus: 'synced',
  }
}

function deserializeWallet(id: string, data: DocumentData): WalletAccount {
  return {
    id,
    label: String(data.label ?? id),
    type: (data.type ?? 'other') as WalletAccount['type'],
    balance: Number(data.balance ?? 0),
    keywords: Array.isArray(data.keywords) ? (data.keywords as string[]) : [id],
    isBuiltIn: Boolean(data.isBuiltIn),
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Memuat seluruh data pengguna dari Firestore. Mengembalikan `null` bila
 * pengguna belum pernah punya data di cloud (akun baru) — pemanggil
 * sebaiknya kemudian melakukan upload state lokal sebagai inisialisasi.
 */
export async function fetchCloudSnapshot(uid: string): Promise<CloudSnapshot | null> {
  try {
    const [txnSnap, walletSnap, settingsSnap] = await Promise.all([
      getDocs(query(userTransactions(uid), orderBy('date', 'desc'))),
      getDocs(userWallets(uid)),
      getDoc(userSettings(uid)),
    ])

    const isEmpty = txnSnap.empty && walletSnap.empty && !settingsSnap.exists()
    if (isEmpty) return null

    const transactions = txnSnap.docs.map(d => deserializeTransaction(d.id, d.data()))
    const wallets = walletSnap.docs.map(d => deserializeWallet(d.id, d.data()))
    const settings = (settingsSnap.exists() ? settingsSnap.data() : {}) as CloudSettings

    return {
      transactions,
      wallets,
      monthlyBudget: typeof settings.monthlyBudget === 'number' ? settings.monthlyBudget : undefined,
      customPayments: Array.isArray(settings.customPayments) ? settings.customPayments : undefined,
      customCategories: Array.isArray(settings.customCategories) ? settings.customCategories : undefined,
      zenMode: typeof settings.zenMode === 'boolean' ? settings.zenMode : undefined,
      themeMode: (settings.themeMode === 'system' || settings.themeMode === 'light' || settings.themeMode === 'dark')
        ? settings.themeMode
        : undefined,
      profileName: typeof settings.profileName === 'string' || settings.profileName === null
        ? settings.profileName
        : undefined,
    }
  } catch (error) {
    console.warn('[cloud-sync] fetchCloudSnapshot failed:', error)
    return null
  }
}

/** Upsert satu transaksi (dipakai untuk add + update status pending → synced). */
export async function pushTransaction(uid: string, txn: Transaction): Promise<boolean> {
  try {
    await setDoc(doc(userTransactions(uid), txn.id), serializeTransaction(txn))
    return true
  } catch (error) {
    console.warn('[cloud-sync] pushTransaction failed:', error)
    return false
  }
}

/** Hapus satu transaksi berdasarkan ID. */
export async function removeTransactionCloud(uid: string, txnId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(userTransactions(uid), txnId))
    return true
  } catch (error) {
    console.warn('[cloud-sync] removeTransactionCloud failed:', error)
    return false
  }
}

/**
 * Sinkronkan SELURUH koleksi wallet ke cloud. Dipakai setelah perubahan
 * saldo (yang menyentuh banyak wallet sekaligus pada transfer/saving) atau
 * setelah CRUD pada wallet. Gunakan writeBatch agar atomik per panggilan.
 */
export async function pushAllWallets(uid: string, wallets: WalletAccount[]): Promise<boolean> {
  try {
    const batch = writeBatch(db)
    for (const wallet of wallets) {
      batch.set(doc(userWallets(uid), wallet.id), {
        label: wallet.label,
        type: wallet.type,
        balance: wallet.balance,
        keywords: wallet.keywords,
        isBuiltIn: wallet.isBuiltIn ?? false,
      })
    }
    await batch.commit()
    return true
  } catch (error) {
    console.warn('[cloud-sync] pushAllWallets failed:', error)
    return false
  }
}

/** Hapus satu wallet dari cloud. */
export async function removeWalletCloud(uid: string, walletId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(userWallets(uid), walletId))
    return true
  } catch (error) {
    console.warn('[cloud-sync] removeWalletCloud failed:', error)
    return false
  }
}

/** Simpan preferensi & slang kustom user (dokumen tunggal). */
export async function pushSettings(uid: string, settings: CloudSettings): Promise<boolean> {
  try {
    // Bersihkan undefined supaya Firestore tidak menolak.
    const payload: CloudSettings = {}
    if (typeof settings.monthlyBudget === 'number') payload.monthlyBudget = settings.monthlyBudget
    if (Array.isArray(settings.customPayments)) payload.customPayments = settings.customPayments
    if (Array.isArray(settings.customCategories)) payload.customCategories = settings.customCategories
    if (typeof settings.zenMode === 'boolean') payload.zenMode = settings.zenMode
    if (settings.themeMode) payload.themeMode = settings.themeMode
    if (settings.profileName !== undefined) payload.profileName = settings.profileName

    await setDoc(userSettings(uid), payload, { merge: true })
    return true
  } catch (error) {
    console.warn('[cloud-sync] pushSettings failed:', error)
    return false
  }
}

/**
 * Inisialisasi: upload SELURUH state lokal ke cloud untuk pengguna baru
 * (yang fetchCloudSnapshot-nya mengembalikan null). Dipanggil hanya sekali
 * per device saat akun cloud masih kosong agar data hasil eksplorasi
 * anonymous tidak hilang.
 */
export async function bootstrapCloudFromLocal(
  uid: string,
  state: CloudSnapshot
): Promise<boolean> {
  try {
    const batch = writeBatch(db)

    for (const txn of state.transactions) {
      batch.set(doc(userTransactions(uid), txn.id), serializeTransaction(txn))
    }
    for (const wallet of state.wallets) {
      batch.set(doc(userWallets(uid), wallet.id), {
        label: wallet.label,
        type: wallet.type,
        balance: wallet.balance,
        keywords: wallet.keywords,
        isBuiltIn: wallet.isBuiltIn ?? false,
      })
    }

    const settings: CloudSettings = {
      monthlyBudget: state.monthlyBudget,
      customPayments: state.customPayments,
      customCategories: state.customCategories,
      zenMode: state.zenMode,
      themeMode: state.themeMode,
      profileName: state.profileName,
    }
    batch.set(userSettings(uid), settings, { merge: true })

    await batch.commit()
    return true
  } catch (error) {
    console.warn('[cloud-sync] bootstrapCloudFromLocal failed:', error)
    return false
  }
}
