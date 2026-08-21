import type { DailyNote, NoteListItem } from '@daily-report/types'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'
import { api } from '../../api/client'
import { useDateFormat } from '../../hooks/useDateFormat'
import { isValidISODate, monthOf, startOfWeek, todayISO } from '../../lib/dates'
import { WeekStrip } from '../calendar/WeekStrip'
import { EmptyState } from '../notes/EmptyState'
import { NoteView } from '../notes/NoteView'
import { NoteResultCard } from '../notes/NoteResultCard'
import { SearchModal } from '../search/SearchModal'
import { MobileTabBar, type MobileTab } from './MobileTabBar'
import { Sidebar } from './Sidebar'
import styles from './AppShell.module.css'

const RECENT_LIMIT = 10

/**
 * La coquille de l'écran principal : barre latérale permanente à gauche,
 * journée ouverte ou état vide à droite.
 *
 * C'est ici que vivent les données partagées par les deux colonnes — le
 * calendrier du mois affiché et les derniers jours — pour qu'un enregistrement
 * dans l'éditeur allume la pastille du calendrier sans rechargement.
 */
export function AppShell() {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { date } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => monthOf(date ?? todayISO()))
  const [daysWithNotes, setDaysWithNotes] = useState<string[]>([])
  const [recent, setRecent] = useState<NoteListItem[]>([])
  // Écran mobile 2b : lequel des deux onglets est affiché. Pas de troisième
  // onglet « Exporter » — il n'a rien derrière lui côté API.
  const [mobileTab, setMobileTab] = useState<MobileTab>('today')
  // La semaine affichée dans l'onglet Calendrier — l'équivalent mobile de
  // `month`, en plus court : la maquette montre un mois entier, ça ne tient
  // pas sur un écran de téléphone sans faire défiler.
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(date ?? todayISO()))
  // Écran 2c — recherche globale. Ctrl+K/⌘K depuis n'importe où dans l'app,
  // pas seulement depuis un bouton ; c'est tout l'intérêt du raccourci.
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Le mois affiché (desktop) et la semaine affichée (mobile) suivent tous
  // les deux la journée ouverte.
  useEffect(() => {
    if (date) {
      setMonth(monthOf(date))
      setWeekAnchor(startOfWeek(date))
    }
  }, [date])

  /**
   * Naviguer la bande de semaine peut faire passer son lundi dans un autre
   * mois que celui déjà chargé — sans quoi les pastilles de la nouvelle
   * semaine resteraient à plat, `daysWithNotes` ne portant que le mois
   * affiché par ailleurs.
   */
  function handleWeekChange(nextAnchor: string) {
    setWeekAnchor(nextAnchor)
    const nextMonth = monthOf(nextAnchor)
    if (nextMonth !== month) setMonth(nextMonth)
  }

  /** Un jour choisi dans la bande de semaine ouvre sa note et revient sur l'onglet Aujourd'hui. */
  function handleWeekSelect(day: string) {
    setMobileTab('today')
    void navigate(`/notes/${day}`)
  }

  const loadMonth = useCallback((target: string) => {
    api.calendar
      .month(target)
      .then((calendar) => setDaysWithNotes(calendar.daysWithNotes))
      .catch(() => setDaysWithNotes([]))
  }, [])

  const loadRecent = useCallback(() => {
    api.notes
      .recent(RECENT_LIMIT)
      .then(setRecent)
      .catch(() => setRecent([]))
  }, [])

  useEffect(() => loadMonth(month), [month, loadMonth])
  useEffect(() => loadRecent(), [loadRecent])

  /** Un enregistrement peut créer un jour rédigé : les deux vues se rafraîchissent. */
  const handleNoteSaved = useCallback(
    (note: DailyNote) => {
      setDaysWithNotes((days) => (days.includes(note.date) ? days : [...days, note.date]))
      loadRecent()
    },
    [loadRecent],
  )

  /**
   * Suppression depuis une carte de recherche (2c) ou de l'onglet Calendrier
   * mobile (2b) — le condensé de semaine de 2f/2g n'en propose pas.
   *
   * On retire la note et la pastille du calendrier tout de suite — la réponse
   * est un 204 sans corps, il n'y a rien à attendre pour savoir quoi peindre —
   * puis on recharge la liste : d'autres notes étaient masquées par la limite,
   * une nouvelle peut maintenant remonter.
   */
  const handleNoteDeleted = useCallback(
    (note: NoteListItem) => {
      setRecent((notes) => notes.filter((item) => item.id !== note.id))
      setDaysWithNotes((days) => days.filter((day) => day !== note.date))

      api.notes
        .remove(note.id)
        .catch(() => {
          // La suppression a échoué : on remet la vue en accord avec le serveur
          // plutôt que de laisser une note disparue de l'écran mais bien vivante.
          loadMonth(month)
        })
        .finally(loadRecent)
    },
    [loadMonth, loadRecent, month],
  )

  // Une date bricolée dans l'URL ramène à aujourd'hui plutôt qu'à un écran cassé.
  if (date !== undefined && !isValidISODate(date)) {
    return <Navigate to={`/notes/${todayISO()}`} replace />
  }

  return (
    <div className={styles.shell}>
      <Sidebar
        month={month}
        onMonthChange={setMonth}
        selected={date ?? null}
        daysWithNotes={daysWithNotes}
        recent={recent}
      />

      {/* Onglet Aujourd'hui — toujours monté : c'est la vue desktop, et sur
          mobile `.note_pane` la masque en CSS quand l'autre onglet est actif,
          plutôt que de démonter useNote/useAttachments à chaque bascule. */}
      <div className={`${styles.note_pane} ${mobileTab === 'today' ? '' : styles.pane_inactive}`}>
        {date ? (
          <NoteView key={date} date={date} onNoteSaved={handleNoteSaved} />
        ) : (
          <EmptyState onOpenSearch={() => setSearchOpen(true)} />
        )}
      </div>

      {/* Onglet Calendrier — n'existe que sur mobile, voir AppShell.module.css.
          La maquette 2b y met la bande de semaine ET les derniers jours : sur
          desktop les deux vivent dans `Sidebar` faute d'onglets, ici ils
          partagent le même panneau.

          Les journées y prennent la forme en rangée de la maquette 2b — la
          même que les résultats de recherche (2c) — plutôt que celle du
          condensé de semaine de `WeekDigest` (2f/2g) : à cette largeur, une
          rangée sans navigation de semaine reste plus simple à faire défiler. */}
      <div className={`${styles.calendar_pane} ${mobileTab === 'calendar' ? '' : styles.pane_inactive}`}>
        {/* La barre « chercher dans mes notes… » de la maquette 2b : la même
            modale que Ctrl+K/⌘K et que la barre de 2f, pas un second système
            de recherche. Un raccourci clavier n'a pas de sens ici — pas de
            hint « ⌘K » comme sur desktop. */}
        <button
          type="button"
          className={`input ${styles.calendar_search}`}
          onClick={() => setSearchOpen(true)}
        >
          {t('search.placeholder')}
        </button>

        <WeekStrip
          anchor={weekAnchor}
          onAnchorChange={handleWeekChange}
          selected={date ?? null}
          onSelect={handleWeekSelect}
          daysWithNotes={daysWithNotes}
        />

        <section className={styles.calendar_recent}>
          <h2 className={styles.calendar_recent_title}>{t('sidebar.recentTitle')}</h2>
          {recent.length === 0 ? (
            <p className={styles.calendar_recent_empty}>{t('sidebar.recentEmpty')}</p>
          ) : (
            <div className={styles.calendar_recent_cards}>
              {recent.map((note) => (
                <NoteResultCard
                  key={note.id}
                  note={note}
                  onOpen={handleWeekSelect}
                  onDelete={handleNoteDeleted}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <MobileTabBar
        active={mobileTab}
        onChange={setMobileTab}
        todayLabel={format.dayShort(date ?? todayISO())}
      />

      {searchOpen ? (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onNavigate={(day) => {
            setSearchOpen(false)
            setMobileTab('today')
            void navigate(`/notes/${day}`)
          }}
          onDelete={handleNoteDeleted}
        />
      ) : null}
    </div>
  )
}
