'use client'

import * as React from 'react'
import { translations, NAV_ID_TO_KEY, NAV_GROUP_TO_KEY, type Lang } from './translations'

const STORAGE_KEY = 'accounterp_lang'

type Dir = 'ltr' | 'rtl'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  dir: Dir
  /** Translate a key — returns the key itself if missing (fallback) */
  t: (key: string) => string
}

const LanguageContext = React.createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  dir: 'ltr',
  t: (k: string) => k,
})

function applyDirToDocument(lang: Lang) {
  if (typeof document === 'undefined') return
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lang
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>('en')

  // Hydrate from localStorage on first client mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
      if (stored === 'en' || stored === 'ar') {
        setLangState(stored)
        applyDirToDocument(stored)
      } else {
        applyDirToDocument('en')
      }
    } catch {
      applyDirToDocument('en')
    }
  }, [])

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage errors (e.g. privacy mode)
    }
    applyDirToDocument(next)
  }, [])

  const toggleLang = React.useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'en' ? 'ar' : 'en'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore
      }
      applyDirToDocument(next)
      return next
    })
  }, [])

  const t = React.useCallback(
    (key: string): string => {
      const dict = translations[lang]
      if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
        return dict[key]
      }
      // Fallback: English, then key itself
      const enDict = translations.en
      if (enDict && Object.prototype.hasOwnProperty.call(enDict, key)) {
        return enDict[key]
      }
      return key
    },
    [lang],
  )

  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'

  const value = React.useMemo<LanguageContextValue>(
    () => ({ lang, setLang, toggleLang, dir, t }),
    [lang, setLang, toggleLang, dir, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return React.useContext(LanguageContext)
}

/**
 * Translate a sidebar nav item id (e.g. 'dashboard', 'sales_invoices',
 * 'invoices', 'credit-notes') into the localized label.
 * Falls back to the id itself if no mapping exists.
 */
export function useNavLabel(itemId: string): string {
  const { t } = useLanguage()
  const key = NAV_ID_TO_KEY[itemId]
  return key ? t(key) : itemId
}

/**
 * Translate a sidebar group label (e.g. 'Overview', 'Sales') into the
 * localized label. Falls back to the original label.
 */
export function useNavGroupLabel(groupLabel: string): string {
  const { t } = useLanguage()
  const key = NAV_GROUP_TO_KEY[groupLabel]
  return key ? t(key) : groupLabel
}
