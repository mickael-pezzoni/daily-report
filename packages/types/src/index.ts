/**
 * Formes JSON échangées entre l'API et le web. Ce sont les shapes telles
 * qu'elles passent sur le fil — pas les types de lignes en base.
 */

/**
 * Les langues de l'interface, par leur seul code.
 *
 * Ce paquet ne porte d'ordinaire que des formes JSON, mais ces codes en sont
 * une : c'est la valeur que le web écrit sur son compte et que l'API doit
 * pouvoir refuser si elle vaut autre chose. Le libellé et le `locale` Intl,
 * eux, ne regardent que le web — ils restent dans `apps/web/src/i18n`.
 */
export const LANGUAGE_CODES = ['fr', 'en'] as const

export type LanguageCode = (typeof LANGUAGE_CODES)[number]

/** Réponse de `GET /api/auth-state`. Public : appelé avant toute session. */
export interface AuthState {
  /**
   * Vrai dès qu'un compte existe sur cet espace. Le web s'en sert pour choisir
   * entre l'écran de connexion et l'écran de premier lancement ; l'API s'en
   * sert pour refuser toute inscription supplémentaire.
   */
  hasAccount: boolean
}

/** L'utilisateur connecté, tel que le renvoie `GET /api/me`. */
export interface SessionUser {
  id: string
  name: string
  email: string
}

/**
 * Un document de texte riche, décrit structurellement.
 *
 * Volontairement pas le `JSONContent` de TipTap : ce paquet est partagé avec
 * l'API, qui n'a aucune raison de traîner l'éditeur dans ses dépendances. Le
 * web fait le pont à la frontière de l'éditeur.
 */
export interface RichTextDoc {
  type: 'doc'
  content?: unknown[]
}

/** Une note du journal — un jour rédigé. */
export interface DailyNote {
  id: string
  /** Date calendaire au format `YYYY-MM-DD`. */
  date: string
  title: string
  content: RichTextDoc
  /** Début du texte aplati, pour les listes et les cartes. */
  excerpt: string
  updatedAt: string
}

/** Corps de `POST /api/notes`. */
export interface NoteDraft {
  date: string
  title: string
  content: RichTextDoc
}

/** Corps de `PATCH /api/notes/:id` — modification partielle. */
export interface NotePatch {
  title?: string
  content?: RichTextDoc
}

/** Une pièce jointe d'une note. Le contenu se récupère à part. */
export interface Attachment {
  id: string
  noteId: string
  /** Nom d'origine du fichier, tel que déposé. */
  filename: string
  mimeType: string
  /** Taille en octets. */
  size: number
  createdAt: string
}

/**
 * Une note telle que la **collection** la renvoie (`GET /api/notes`).
 *
 * La liste porte ses pièces jointes, là où `GET /api/notes/:id` ne les donne
 * pas : les cartes de l'écran « aucune note ouverte » les affichent, et aller
 * les chercher carte par carte ferait une requête par jour affiché.
 */
export interface NoteListItem extends DailyNote {
  /** Dans l'ordre de dépôt. Tableau vide si le jour n'en porte aucune. */
  attachments: Attachment[]
}

/** Réponse de `GET /api/calendar/:month` — quels jours du mois sont rédigés. */
export interface CalendarMonth {
  /** `YYYY-MM`. */
  month: string
  /** Dates `YYYY-MM-DD` portant une note. */
  daysWithNotes: string[]
}
