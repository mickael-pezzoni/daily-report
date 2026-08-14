import type { LanguageCode } from '@daily-report/types'
import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'

export type { LanguageCode }

/**
 * Les langues offertes, dans l'ordre du sélecteur.
 *
 * `locale` est ce qu'on passe à `Intl` — jamais le code de langue nu. `en-GB`
 * plutôt que `en-US` parce que la grille du calendrier commence le lundi
 * (maquette 2a) : `en-US` afficherait des jours de semaine dont l'ordre
 * contredirait la grille.
 *
 * C'est toujours la seule liste à compléter pour ajouter une langue — mais le
 * `code` est désormais typé par `LANGUAGE_CODES` de `@daily-report/types`, que
 * l'API partage. Ajouter une entrée sans son code là-bas ne compile pas : c'est
 * voulu, le serveur refuserait la valeur.
 */
export const LANGUAGES = [
  { code: 'fr', locale: 'fr-FR', label: 'Français' },
  { code: 'en', locale: 'en-GB', label: 'English' },
] as const satisfies readonly { code: LanguageCode; locale: string; label: string }[]

/** Le code appartient-il aux langues offertes ? */
export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value)
}

export const DEFAULT_LANGUAGE: LanguageCode = 'fr'

/** Le `locale` Intl d'une langue, avec repli sur le français. */
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
    // `fr-BE`, `en-CA`… retombent sur `fr` et `en` : on ne tient qu'un
    // catalogue par langue, pas un par région.
    nonExplicitSupportedLngs: true,
    detection: {
      // Le choix explicite de l'utilisateur prime sur la langue du navigateur.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'daily-report.language',
      caches: ['localStorage'],
    },
    interpolation: {
      // React échappe déjà tout ce qu'il rend ; échapper une seconde fois
      // transformerait « Camille & Cie » en « Camille &amp; Cie ».
      escapeValue: false,
    },
  })

/**
 * `<html lang>` suit la langue choisie.
 *
 * Ce n'est pas cosmétique : c'est ce qui décide de la césure, des guillemets et
 * de la voix qu'emploie un lecteur d'écran.
 */
function syncDocumentLanguage(code: string) {
  document.documentElement.lang = code
}

syncDocumentLanguage(i18next.resolvedLanguage ?? DEFAULT_LANGUAGE)
i18next.on('languageChanged', syncDocumentLanguage)

export default i18next
