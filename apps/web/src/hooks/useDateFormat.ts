import { useTranslation } from 'react-i18next'
import { localeOf } from '../i18n'
import { dateFormatFor, type DateFormat } from '../lib/date-format'

/**
 * Les formateurs de date de la langue courante.
 *
 * Passe par `useTranslation()` — et pas par `i18next.language` lu directement —
 * pour que le composant se réabonne aux changements de langue : sans cet
 * abonnement, une vue qui n'affiche que des dates garderait les libellés de la
 * langue précédente jusqu'au prochain rendu provoqué par autre chose.
 */
export function useDateFormat(): DateFormat {
  const { i18n } = useTranslation()
  return dateFormatFor(localeOf(i18n.resolvedLanguage ?? i18n.language))
}
