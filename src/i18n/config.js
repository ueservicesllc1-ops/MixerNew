import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './locales/es.js'
import en from './locales/en.js'

const STORAGE_KEY = 'zion_locale'

function getInitialLng() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'en' || s === 'es') return s
  } catch { /* ignore */ }
  return 'es'
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: getInitialLng(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng === 'en' ? 'en' : 'es'
  }
})

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language === 'en' ? 'en' : 'es'
}

export default i18n
