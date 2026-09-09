import type { LanguageCode } from '@daily-report/types'
import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'

export type { LanguageCode }

/**
 * The offered languages, in the order shown by the picker.
 *
 * `locale` is what gets passed to `Intl` — never the bare language code.
 * `en-GB` rather than `en-US` because the calendar grid starts on Monday
 * (mockup 2a): `en-US` would display weekday initials whose order would
 * contradict the grid.
 *
 * This is still the only list to fill in to add a language — but the `code`
 * is now typed by `LANGUAGE_CODES` from `@daily-report/types`, which the API
 * shares. Adding an entry without its code there fails to compile: that's
 * intentional, the server would refuse the value.
 */
export const LANGUAGES = [
  { code: 'fr', locale: 'fr-FR', label: 'Français' },
  { code: 'en', locale: 'en-GB', label: 'English' },
] as const satisfies readonly { code: LanguageCode; locale: string; label: string }[]

/** Does the code belong to the offered languages? */
export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value)
}

export const DEFAULT_LANGUAGE: LanguageCode = 'fr'

/** A language's Intl `locale`, falling back to French. */
export function localeOf(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.locale ?? LANGUAGES[0].locale
}

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES.map((language) => language.code),
    // `fr-BE`, `en-CA`… fall back to `fr` and `en`: we only keep one catalog
    // per language, not one per region.
    nonExplicitSupportedLngs: true,
    detection: {
      // The user's explicit choice takes priority over the browser's language.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'daily-report.language',
      caches: ['localStorage'],
    },
    interpolation: {
      // React already escapes everything it renders; escaping a second time
      // would turn "Camille & Cie" into "Camille &amp; Cie".
      escapeValue: false,
    },
  })

/**
 * `<html lang>` follows the chosen language.
 *
 * This isn't cosmetic: it's what decides hyphenation, quotation marks, and
 * the voice a screen reader uses.
 */
function syncDocumentLanguage(code: string) {
  document.documentElement.lang = code
}

syncDocumentLanguage(i18next.resolvedLanguage ?? DEFAULT_LANGUAGE)
i18next.on('languageChanged', syncDocumentLanguage)

export default i18next
