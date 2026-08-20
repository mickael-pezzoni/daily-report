import type { NoteListItem } from '@daily-report/types'
import { type ReactNode, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { useDateFormat } from '../../hooks/useDateFormat'
import { extensionLabel, isPreviewableImage } from '../../lib/attachments'
import { todayISO } from '../../lib/dates'
import { useConfirm } from '../ui/ConfirmDialog'
import styles from './NoteResultCard.module.css'

interface NoteResultCardProps {
  note: NoteListItem
  /**
   * Le terme cherché : resserre l'extrait autour de lui, le surligne, et fait
   * apparaître les pièces jointes dont le nom répond. Absent — la liste du
   * calendrier mobile — l'extrait s'affiche tel quel.
   */
  query?: string
  /** Ligne courante de la navigation ↑ ↓ de la recherche. */
  selected?: boolean
  onOpen: (date: string) => void
  /** Appelé **après** confirmation : la carte pose la question elle-même. */
  onDelete: (note: NoteListItem) => void
  onMouseEnter?: () => void
  ref?: Ref<HTMLDivElement>
}

/** Ce qu'on garde de part et d'autre du terme trouvé, dans l'extrait. */
const LEAD_CHARS = 40
const TRAIL_CHARS = 90

/** Sans accent et sans casse — l'équivalent client de `f_unaccent` côté serveur. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
}

/**
 * Comme `fold`, mais en retenant de quel caractère d'origine vient chaque
 * caractère replié.
 *
 * Indispensable pour surligner : `'é'.normalize('NFD')` fait **deux**
 * caractères, donc un index trouvé dans la chaîne repliée ne désigne pas le
 * même endroit dans la chaîne d'origine dès qu'un accent le précède. On replie
 * caractère par caractère pour garder la correspondance exacte.
 */
function foldWithMap(value: string): { folded: string; map: number[] } {
  let folded = ''
  const map: number[] = []
  for (let index = 0; index < value.length; index++) {
    for (const char of fold(value[index]!)) {
      folded += char
      map.push(index)
    }
  }
  return { folded, map }
}

/**
 * L'extrait, resserré autour du terme cherché et surligné — le « …la *latence*
 * a chuté après le cache… » de la maquette 2c.
 *
 * Purement esthétique, et travaillant sur l'extrait **déjà tronqué** par le
 * serveur : un terme trouvé par racinisation (« latences » pour « latence ») ou
 * situé plus loin dans la note ne s'y retrouve pas littéralement. L'extrait
 * s'affiche alors tel quel, sans surlignage, plutôt que de deviner.
 */
function excerptAroundMatch(text: string, query: string): ReactNode {
  const term = query.trim()
  if (!term) return text

  const { folded, map } = foldWithMap(text)
  const needle = fold(term)
  const at = folded.indexOf(needle)
  if (at === -1) return text

  const start = map[at]!
  const foldedEnd = at + needle.length
  const end = foldedEnd < map.length ? map[foldedEnd]! : text.length

  const from = Math.max(0, start - LEAD_CHARS)
  const to = Math.min(text.length, end + TRAIL_CHARS)

  return (
    <>
      {from > 0 ? '…' : ''}
      {text.slice(from, start)}
      <mark className={styles.mark}>{text.slice(start, end)}</mark>
      {text.slice(end, to)}
      {to < text.length ? '…' : ''}
    </>
  )
}

/**
 * Une journée en **rangée pleine largeur** : date, étiquettes, extrait.
 *
 * C'est la carte de résultat de l'écran 2c, et celle des « derniers jours » de
 * l'onglet Calendrier mobile (2b) — la maquette leur donne la même forme. À ne
 * pas confondre avec `RecentNoteCard`, le post-it incliné de l'écran 2f, qui
 * reste une forme à part.
 *
 * Toute la carte ouvre la journée : le bouton de la date est étiré en
 * `::after` par-dessus, et « supprimer » repasse au-dessus de lui en
 * `z-index`. Un bouton dans un bouton n'existe pas — c'est ce qui interdit la
 * solution évidente, exactement comme dans `RecentNoteCard`.
 */
export function NoteResultCard({
  note,
  query,
  selected,
  onOpen,
  onDelete,
  onMouseEnter,
  ref,
}: NoteResultCardProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { confirm, dialog } = useConfirm()

  const day = format.dayShort(note.date)
  const fileCount = note.attachments.length
  const term = query?.trim() ?? ''
  const matchingFiles = term
    ? note.attachments.filter((attachment) => fold(attachment.filename).includes(fold(term)))
    : []

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('card.confirmDelete.title', { day }),
      body:
        fileCount > 0
          ? t('card.confirmDelete.bodyWithFiles', {
              files: t('attachments.files', { count: fileCount }),
            })
          : t('card.confirmDelete.body'),
      confirmLabel: t('card.confirmDelete.confirm'),
      tone: 'danger',
    })
    if (confirmed) onDelete(note)
  }

  return (
    <article
      ref={ref}
      className={`card elev-sm ${styles.card} ${selected ? styles.selected : ''}`}
      onMouseEnter={onMouseEnter}
    >
      <div className={styles.head}>
        <h3 className={styles.date}>
          <button type="button" className={styles.open} onClick={() => onOpen(note.date)}>
            {day}
          </button>
        </h3>
        {note.date === todayISO() ? (
          <span className="tag tag-neutral">{t('search.today')}</span>
        ) : null}
        {fileCount > 0 ? (
          <span className="tag tag-accent-2">{t('attachments.files', { count: fileCount })}</span>
        ) : null}
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.remove}
          onClick={() => void handleDelete()}
          aria-label={t('card.deleteDay', { day })}
        >
          {t('search.delete')}
        </button>
      </div>

      {note.excerpt ? (
        <p className={styles.excerpt}>
          {term ? excerptAroundMatch(note.excerpt, term) : note.excerpt}
        </p>
      ) : null}

      {matchingFiles.map((attachment) => (
        <div key={attachment.id} className={styles.fileMatch}>
          {isPreviewableImage(attachment.mimeType) ? (
            <img
              src={api.attachments.contentUrl(attachment.id)}
              alt=""
              className={styles.thumb}
              loading="lazy"
            />
          ) : (
            <span className={styles.thumbFallback}>
              {extensionLabel(attachment.filename) ?? t('attachments.unknownType')}
            </span>
          )}
          <span className={styles.fileName}>{attachment.filename}</span>
        </div>
      ))}

      {dialog}
    </article>
  )
}
