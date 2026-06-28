'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
} from 'firebase/auth'
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const firebaseDb = getFirestore(firebaseApp)

function createFirebaseAuth() {
  if (typeof window === 'undefined') return getAuth(firebaseApp)

  try {
    return initializeAuth(firebaseApp, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    return getAuth(firebaseApp)
  }
}

export const firebaseAuth = createFirebaseAuth()

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
  prompt: 'select_account',
})

const CLOUD_COLLECTION = 'sakukilatUsers'

function userCloudRef(uid: string) {
  return doc(firebaseDb, CLOUD_COLLECTION, uid)
}

export async function loadUserCloudSlice<T>(uid: string, key: string): Promise<T | null> {
  if (!uid) return null
  const snapshot = await getDoc(userCloudRef(uid))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return (data?.[key] as T | undefined) ?? null
}

export async function saveUserCloudSlice(uid: string, key: string, value: unknown): Promise<void> {
  if (!uid) return
  await setDoc(
    userCloudRef(uid),
    { [key]: value, updatedAt: serverTimestamp() },
    { merge: true }
  )
}

export async function initFirebaseAnalytics() {
  if (typeof window === 'undefined') return null

  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    const supported = await isSupported()
    return supported ? getAnalytics(firebaseApp) : null
  } catch (error) {
    console.warn('Firebase analytics is not available:', error)
    return null
  }
}
