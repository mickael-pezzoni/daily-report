import { useTranslation } from 'react-i18next'
import { localeOf } from '../i18n'
import { dateFormatFor, type DateFormat } from '../lib/date-format'

/**
 * The date formatters for the current language.
 *
 * Goes through `useTranslation()` — rather than reading `i18next.language`
 * directly — so the component re-subscribes to language changes: without
 * that subscription, a view that only displays dates would keep the
 * previous language's labels until the next render triggered by something
 * else.
 */
export function useDateFormat(): DateFormat {
  const { i18n } = useTranslation()
  return dateFormatFor(localeOf(i18n.resolvedLanguage ?? i18n.language))
}
