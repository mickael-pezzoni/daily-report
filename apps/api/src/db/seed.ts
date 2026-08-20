import type { RichTextDoc } from '@daily-report/types'
import { faker } from '@faker-js/faker'
import { flattenRichText } from '../lib/rich-text.js'
import { db, pool } from './index.js'

/**
 * Remplit le journal de fausses notes, pour travailler sur des écrans qui ont
 * quelque chose à montrer — cartes de 2f, pastilles du calendrier, navigation
 * entre plusieurs mois.
 *
 * Deux sources, mises bout à bout dans `ALL_NOTES` : `NOTES`, écrites à la
 * main, qui racontent la construction de ce projet depuis son premier jour ;
 * et `generateFillerNotes()`, qui pioche au hasard dans une banque de phrases
 * pour couvrir les semaines plus anciennes sans les rédiger une à une.
 *
 * Rejouable : les jours déjà rédigés sont laissés intacts (`ON CONFLICT DO
 * NOTHING` sur la contrainte `UNIQUE (user_id, note_date)`), donc une vraie
 * note ne sera jamais écrasée.
 *
 * `content_text` passe par `flattenRichText`, comme les routes : c'est la même
 * règle ici que là-bas — le texte aplati est toujours calculé, jamais écrit à
 * la main, sinon les extraits mentiraient sur le contenu.
 */

// ── Petits constructeurs de nœuds TipTap, pour que les notes ci-dessous se
//    lisent comme du texte et non comme du JSON. ─────────────────────────────

type Node = Record<string, unknown>

const h = (level: number, text: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
})

const p = (text: string): Node => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

const bullets = (...items: string[]): Node => ({
  type: 'bulletList',
  content: items.map((text) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })),
})

/** Cases à cocher — `checked` dit lesquelles sont faites. */
const tasks = (...items: [string, boolean][]): Node => ({
  type: 'taskList',
  content: items.map(([text, checked]) => ({
    type: 'taskItem',
    attrs: { checked },
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })),
})

const quote = (text: string): Node => ({
  type: 'blockquote',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

const doc = (...content: Node[]): RichTextDoc => ({ type: 'doc', content })

// ── Les journées ────────────────────────────────────────────────────────────

interface SeedNote {
  date: string
  title: string
  content: RichTextDoc
}

const NOTES: SeedNote[] = [
  {
    date: '2026-06-08',
    title: 'Amorçage du monorepo',
    content: doc(
      p('Premier jour sur le projet. Mise en place du monorepo pnpm : apps/api, apps/web, packages/types.'),
      h(3, 'Décisions'),
      bullets(
        'pnpm workspaces plutôt que des dépôts séparés — packages/types reste source-only, pas de build à synchroniser',
        'TypeScript strict partout, noUncheckedIndexedAccess activé dès le départ',
      ),
      p("Rien d'utilisateur encore, juste la charpente."),
    ),
  },
  {
    date: '2026-06-09',
    title: 'Authentification : le choix de better-auth',
    content: doc(
      p('Comparé Lucia, Auth.js et better-auth pour l\'authentification. Retenu better-auth : adaptateur Kysely direct sur le pool pg, pas de couche supplémentaire à maintenir.'),
      quote("On reste sur e-mail + mot de passe pour la V1. Pas d'OAuth tant qu'il n'y a qu'un seul compte sur l'espace."),
      p('Le schéma des tables better-auth (user, session, account, verification) est généré par leur CLI, pas écrit à la main — à ne jamais rééditer une fois appliqué.'),
    ),
  },
  {
    date: '2026-06-11',
    title: 'Verrou mono-compte',
    content: doc(
      p('Implémenté le hook before de better-auth qui bloque /sign-up/email dès qu\'un compte existe (403 SIGNUP_CLOSED).'),
      bullets(
        'hasAccount() fait une requête brute sur "user" — cette table ne passe jamais par Kysely, ses colonnes sont en camelCase entre guillemets',
        'le web s\'appuiera là-dessus pour choisir entre écran de connexion et écran de premier lancement',
      ),
      p("Simple, mais c'est le genre de règle qu'il vaut mieux avoir des deux côtés — client et serveur."),
    ),
  },
  {
    date: '2026-06-12',
    title: 'Schéma des notes',
    content: doc(
      p('Table daily_notes : une note par utilisateur et par date, UNIQUE (user_id, note_date).'),
      quote("La contrainte d'unicité EST la règle métier. Elle vit dans le schéma, pas dans du code applicatif qu'on pourrait contourner."),
      p('content en JSONB pour le document TipTap, plus une colonne content_text qui préparera la recherche plein texte plus tard.'),
    ),
  },
  {
    date: '2026-06-15',
    title: 'API REST des notes',
    content: doc(
      p("Routes CRUD sur /api/notes. La date est un attribut de la ressource, jamais une clé d'URL — GET /api/notes?date=… filtre, il n'identifie pas."),
      bullets(
        'POST sur une date déjà prise renvoie 409 — on laisse la contrainte trancher plutôt que de faire un SELECT préalable qui laisserait une fenêtre de concurrence',
        "une note d'un autre compte répond 404, jamais 403",
      ),
    ),
  },
  {
    date: '2026-06-16',
    title: 'content_text toujours recalculé au serveur',
    content: doc(
      p('Ajouté flattenRichText : aplatit le document TipTap en texte brut à chaque écriture.'),
      quote('Ne jamais accepter content_text du client. Sinon les extraits — et demain la recherche — pourraient mentir sur ce que contient vraiment la note.'),
      p('Fonction pure, facile à tester, mais pas encore de suite de tests dans ce dépôt.'),
    ),
  },
  {
    date: '2026-06-18',
    title: 'Le calendrier comme vue à part entière',
    content: doc(
      p('GET /api/calendar/:month renvoie les jours qui portent une note. Modèle de lecture séparé des notes elles-mêmes.'),
      bullets('borne haute exclusive sur note_date pour que l\'index (user_id, note_date) reste utilisable'),
      p('C\'est ce qui allumera les pastilles sous le calendrier côté web.'),
    ),
  },
  {
    date: '2026-06-19',
    title: 'Premier jet de l\'éditeur TipTap',
    content: doc(
      p('Intégré TipTap avec le StarterKit, plus les extensions listes de tâches. Le document est stocké tel que l\'éditeur le sérialise, sans transformation côté serveur.'),
      tasks(
        ['Titre contrôlé séparément du contenu', true],
        ['Placeholder qui suit la langue', false],
      ),
      p("Reste à brancher l'enregistrement automatique — pour l'instant tout se perd au rechargement."),
    ),
  },
  {
    date: '2026-06-22',
    title: 'Écran 2a : calendrier permanent + éditeur',
    content: doc(
      p('Premier assemblage de la vue principale — calendrier à gauche, éditeur à droite, d\'après la maquette.'),
      bullets("la note n'existe pas tant que rien n'a été écrit — /notes/2026-08-03 doit pouvoir s'ouvrir sur un jour vierge"),
      p('Encore statique, aucune donnée réelle ne circule.'),
    ),
  },
  {
    date: '2026-06-23',
    title: 'Enregistrement automatique',
    content: doc(
      p('useNote : POST à la première frappe, PATCH ensuite. Passé une bonne heure sur les cas limites.'),
      bullets(
        'une seule création en vol par jour (creatingRef)',
        'un 409 traité comme « existe déjà », pas comme une erreur',
        'la file d\'attente se vide au changement de date et au démontage',
      ),
      quote('Sans le troisième point, changer de jour pendant que ça enregistre écrirait sur la mauvaise note.'),
    ),
  },
  {
    date: '2026-06-24',
    title: 'Écran de premier lancement',
    content: doc(
      p("Écran 2e : création du tout premier compte. Après ça, l'écran disparaît côté web comme côté serveur (SIGNUP_CLOSED)."),
      p('useAuthState pilote le choix entre connexion et premier lancement — revalidé à chaque bascule de session.'),
    ),
  },
  {
    date: '2026-06-26',
    title: 'Revue de code avec Sophie',
    content: doc(
      p('Sophie a relu useNote. Bonnes remarques sur la gestion des erreurs réseau.'),
      bullets('errorKey plutôt qu\'un message figé — pour suivre un changement de langue plus tard'),
      p('Rien de bloquant, quelques renommages pour la semaine prochaine.'),
    ),
  },
  {
    date: '2026-06-29',
    title: 'Stockage générique des fichiers',
    content: doc(
      p("Défini l'interface StorageDriver : put/get/delete, plus un getSignedUrl optionnel."),
      quote('Aucune route, aucune requête SQL ne doit contenir de fs ni de S3Client. L\'application ne manipule que des clés opaques.'),
      p("C'est ce qui permettra de passer du disque local à S3/R2/MinIO en changeant une seule variable d'environnement."),
    ),
  },
  {
    date: '2026-06-30',
    title: 'Driver local vs S3',
    content: doc(
      p('Écrit LocalStorage (disque, on-premise) et commencé S3Storage.'),
      bullets(
        'LocalStorage refuse toute clé qui sortirait de son répertoire racine — même si les clés sont fabriquées par l\'appli, donc sûres par construction',
        'un seul driver S3 couvre S3, R2, MinIO, Backblaze — seuls endpoint et forcePathStyle changent',
      ),
    ),
  },
  {
    date: '2026-07-02',
    title: 'Route d\'upload multipart',
    content: doc(
      p("POST /api/notes/:noteId/attachments, champ file répétable pour un envoi groupé."),
      bullets('le fichier part au stockage avant la ligne en base — un objet sans ligne est un déchet rattrapable, l\'inverse serait un lien mort'),
      p("Testé avec un envoi de 5 fichiers d'un coup, rien n'a débordé."),
    ),
  },
  {
    date: '2026-07-03',
    title: 'Sécurité des pièces jointes',
    content: doc(
      p('Décidé quels types sont servis inline vs en téléchargement forcé.'),
      quote("image/svg+xml est volontairement exclu des types inertes — un SVG déposé par un tiers exécuterait son script dans l'origine de l'application."),
      bullets('X-Content-Type-Options: nosniff sur toute réponse de contenu'),
    ),
  },
  {
    date: '2026-07-06',
    title: 'Tiroir de pièces jointes',
    content: doc(
      p('Écran 2a-open : le tiroir vit en pied de page, pas en panneau latéral — la maquette a tranché.'),
      p('Compte et libellé au pied, replié par défaut.'),
    ),
  },
  {
    date: '2026-07-07',
    title: 'Glisser-déposer',
    content: doc(
      p('Le survol d\'un fichier ouvre le tiroir automatiquement. Passé du temps sur un bug de clignotement.'),
      quote('dragenter et dragleave se déclenchent pour chaque enfant survolé. Il faut compter les entrées, pas se fier au premier dragleave.'),
    ),
  },
  {
    date: '2026-07-09',
    title: "Images collées dans l'éditeur",
    content: doc(
      p('handleDrop et handlePaste de TipTap interceptent les images à part, pour les insérer directement dans le texte.'),
      bullets('stopPropagation() sur ces deux gestes — sinon le fichier partait deux fois, une fois dans le texte et une fois dans le tiroir'),
    ),
  },
  {
    date: '2026-07-10',
    title: 'Nettoyage avant congés',
    content: doc(
      p('Dernier jour avant deux semaines de congés. Fermé les tickets en cours, laissé des notes de passation à Sophie.'),
      tasks(
        ['Rien de cassé en l\'état, build et typecheck passent', true],
        ['Reste la revue de sécurité à programmer au retour', false],
      ),
      p('Bureau vidé, à dans deux semaines.'),
    ),
  },
  {
    date: '2026-07-27',
    title: 'Reprise après congés',
    content: doc(
      p("Première journée de reprise. La matinée est passée à vider la boîte mail et à relire ce qui a bougé pendant deux semaines."),
      h(3, 'À rattraper'),
      tasks(
        ['Relire les comptes rendus des deux dernières réunions produit', true],
        ['Reprendre la revue laissée en attente sur le module de facturation', true],
        ["Répondre au client Lambert sur le calendrier de recette", false],
      ),
      p("Rien de bloquant, mais la migration de base a pris du retard pendant l'été."),
    ),
  },
  {
    date: '2026-07-28',
    title: 'Revue de la migration Postgres 17',
    content: doc(
      p("Journée dense sur la migration. On a repris le script de bascule ligne à ligne avec Sophie."),
      h(3, 'Ce qui coince'),
      bullets(
        "Les index partiels ne sont pas repris par l'outil de génération",
        'Le fuseau des colonnes DATE se décale encore côté application',
        'La fenêtre de bascule de 20 minutes semble optimiste',
      ),
      quote("Décision : on reporte la bascule d'une semaine plutôt que de la faire à moitié."),
      p("À refaire demain : chiffrer le temps de réindexation sur une copie de la production."),
    ),
  },
  {
    date: '2026-07-29',
    title: 'Suite de la migration',
    content: doc(
      p("Deuxième journée sur la bascule Postgres 17. Le script de réindexation tourne, plus lentement que prévu sur la copie de prod."),
      p('Rien à décider aujourd\'hui, on regarde juste les chiffres tourner.'),
    ),
  },
  {
    date: '2026-07-30',
    title: 'Atelier accessibilité',
    content: doc(
      p("Atelier de trois heures avec l'équipe design sur l'accessibilité des formulaires."),
      h(3, 'Ce qui en sort'),
      bullets(
        'Tous les champs auront un libellé visible, plus de placeholder seul',
        'Les messages d\'erreur passent en aria-live',
        'Le contraste du gris de texte secondaire est trop faible, à remonter',
      ),
      p("Bonne séance. Il faudra une deuxième passe sur les modales, qui n'ont pas été abordées."),
    ),
  },
  {
    date: '2026-07-31',
    title: '',
    content: doc(
      p("Journée courte, fin de mois. Réunion d'équipe puis rangement des tickets."),
      p('Rien de notable.'),
    ),
  },
  {
    date: '2026-08-03',
    title: 'Refonte de l\'écran de note',
    content: doc(
      p("Démarrage de la refonte de l'écran principal. On part sur la direction calendrier permanent à gauche, éditeur à droite."),
      h(3, 'Décisions'),
      bullets(
        "La date est une vue, pas une ressource — l'URL /notes/2026-08-03 doit s'ouvrir sur un jour vierge",
        "L'enregistrement est automatique, pas de bouton « Enregistrer »",
        'Le tiroir de pièces jointes vit en pied de page, pas en panneau latéral',
      ),
      h(3, 'Reste à trancher'),
      tasks(
        ["Faut-il un état « brouillon » distinct ?", false],
        ['Comportement du glisser-déposer sur une journée vierge', true],
      ),
    ),
  },
  {
    date: '2026-08-04',
    title: 'Correctifs et revue',
    content: doc(
      p("Matinée sur les retours de recette, après-midi en revue de code."),
      h(3, 'Corrigé'),
      bullets(
        "Le calendrier n'affichait pas les pastilles au changement de mois",
        "Un double envoi de fichier quand on lâchait l'image dans l'éditeur",
        "Le titre de la note perdait le focus après l'enregistrement",
      ),
      p("Le double envoi venait de la propagation de l'événement : l'éditeur et la vue traitaient tous les deux le dépôt."),
    ),
  },
  {
    date: '2026-08-05',
    title: 'Point client Lambert',
    content: doc(
      p("Visio d'une heure avec le client sur le périmètre de la V2."),
      quote("Ils veulent l'export PDF avant la recherche. À arbitrer en interne."),
      h(3, 'Suites'),
      tasks(
        ['Envoyer le compte rendu', true],
        ["Chiffrer l'export PDF", false],
        ['Reprogrammer un point mi-septembre', false],
      ),
    ),
  },
  {
    date: '2026-08-06',
    title: 'Internationalisation',
    content: doc(
      p("Mise en place de i18next sur le front. Français et anglais, catalogues embarqués dans le bundle — pas de chargement réseau au premier rendu."),
      h(3, 'Points d\'attention'),
      bullets(
        "La langue doit appartenir au compte, pas au navigateur",
        "Les vues gardent une clé de traduction, jamais un message figé",
        "Le texte fantôme de l'éditeur doit être une fonction, sinon il ne suit pas la langue",
      ),
      p("Le repli reste localStorage tant qu'on ne sait pas qui regarde l'écran."),
    ),
  },
  {
    date: '2026-08-10',
    title: 'Astreinte',
    content: doc(
      p("Semaine d'astreinte. Une alerte cette nuit à 3h12 sur la saturation disque du serveur de fichiers."),
      h(3, 'Ce qui s\'est passé'),
      bullets(
        'Les objets orphelins du stockage ne sont jamais ramassés',
        'Environ 4 Go de fichiers sans ligne en base',
        'Nettoyé à la main pour ce coup-ci',
      ),
      quote("Il faut écrire la tâche de ramasse-miettes, ça se reproduira."),
    ),
  },
  {
    date: '2026-08-11',
    title: 'Menu contextuel de l\'éditeur',
    content: doc(
      p("Remplacement du menu du clic droit dans l'éditeur, pour pouvoir insérer une image de la journée à l'endroit du curseur."),
      p("Conséquence : Couper/Copier/Coller sont à réimplémenter, le navigateur ne les rend plus. Ctrl+X/C/V restent la voie de repli si le presse-papiers refuse."),
      h(3, 'Détail qui a coûté une heure'),
      p("Le clic droit ne doit déplacer le curseur que s'il tombe hors d'une sélection déjà active — sinon on écrase la sélection qu'on voulait couper."),
    ),
  },
  {
    date: '2026-08-12',
    title: 'Revue de sécurité',
    content: doc(
      p("Passage en revue des routes de pièces jointes avec Karim."),
      h(3, 'Retenu'),
      bullets(
        'Une ressource qui ne vous appartient pas répond 404, jamais 403',
        "Seuls les types inertes sont servis en inline — le SVG est exclu, il exécuterait son script dans l'origine de l'application",
        'On écrit l\'objet avant la ligne, on supprime la ligne avant l\'objet',
      ),
      p("Rien de critique trouvé. Le point faible reste le ramasse-miettes absent."),
    ),
  },
  {
    date: '2026-08-13',
    title: 'Modale de confirmation',
    content: doc(
      p("Remplacement des window.confirm par la modale de la maquette."),
      p("L'élément dialog natif fait le travail : couche supérieure, piège à focus, Échap, arrière-plan inerte. Le bouton nomme l'action au lieu d'un OK générique, et « Annuler » reçoit le focus à l'ouverture."),
      tasks(
        ['Convertir la suppression de pièce jointe', true],
        ['Convertir la suppression de note', true],
        ["Reste le window.prompt du lien, pas de maquette pour l'instant", false],
      ),
    ),
  },
  {
    date: '2026-08-14',
    title: 'Avant le week-end',
    content: doc(
      p('Petite journée. Fusion de deux PR en attente, rien de notable côté note du jour.'),
      p('Le week-end du 15 pourrait bien être calme aussi.'),
    ),
  },
]

// ── Remplissage procédural des semaines plus anciennes ──────────────────────
//
// Le récit écrit à la main ci-dessus commence le 8 juin (arrivée sur le
// projet) : avant cette date, il n'y a rien de particulier à raconter — mais
// un calendrier de test gagne à couvrir plusieurs mois, avec de vrais trous
// plutôt qu'un damier parfait. `@faker-js/faker` ne sert qu'à tirer au sort
// (quelle date, quelle phrase, quel jour sauter) : le texte lui-même vient
// d'une banque écrite à la main, sinon `lorem.sentence()` produirait du faux
// latin qui jurerait avec le reste du journal.

const FILLER_START = '2026-03-02'
const FILLER_END = '2026-06-05'

/** Un jour ouvré sur trois n'est simplement pas rédigé — un vrai journal a des trous. */
const SKIP_PROBABILITY = 0.3

const FILLER_SENTENCES = [
  "Réunion d'équipe hebdomadaire, rien de notable à en tirer.",
  "Debug d'un test qui échouait de façon intermittente sur la CI.",
  'Pairing avec Karim sur un point de la couche de stockage.',
  'Mis à jour les dépendances, aucune régression détectée.',
  'Petits correctifs de style sur les écrans de connexion.',
  "Répondu à une série de questions de Sophie sur l'architecture.",
  'Relu deux pull requests, rien à redire.',
  'Journée surtout administrative — tickets, priorisation, planning.',
  'Creusé un ralentissement signalé sur le chargement du calendrier.',
  'Documentation interne mise à jour après les derniers changements.',
  "Reprise d'un vieux ticket laissé de côté depuis des semaines.",
  'Échange avec le client sur le calendrier des prochaines livraisons.',
  'Nettoyage de code mort dans les anciennes routes.',
  'Vérifié les journaux de production, rien d\'anormal.',
  'Un peu de veille technique en fin de journée.',
  'Vidé la boîte mail, classé ce qui pouvait attendre.',
  'Repris un vieux brouillon de spécification, sans le finir.',
  'Séance de debug à deux avec Sophie, cause trouvée après coup.',
]

/** Une entrée sur trois n'a pas de titre — comme certaines des notes réelles. */
const FILLER_TITLES = ['Journée de routine', 'Petits correctifs', 'Suivi de projet', 'Maintenance', '']

/** Vraies dates calendaires `YYYY-MM-DD`, jours ouvrés, entre deux bornes incluses. */
function weekdaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const cursor = new Date(`${start}T12:00:00Z`)
  const last = new Date(`${end}T12:00:00Z`)

  while (cursor <= last) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

/** Graine fixe : le script reste reproductible d'un lancement à l'autre. */
function generateFillerNotes(): SeedNote[] {
  faker.seed(20260302)

  return weekdaysBetween(FILLER_START, FILLER_END)
    .filter(() => faker.number.float() >= SKIP_PROBABILITY)
    .map((date) => ({
      date,
      title: faker.helpers.arrayElement(FILLER_TITLES),
      content: doc(...faker.helpers.arrayElements(FILLER_SENTENCES, { min: 1, max: 2 }).map(p)),
    }))
}

const ALL_NOTES: SeedNote[] = [...generateFillerNotes(), ...NOTES]

// ── Insertion ───────────────────────────────────────────────────────────────

async function seed() {
  // Espace mono-compte : on rattache tout au seul utilisateur existant. Requête
  // brute, la table `user` appartient à better-auth et ne passe pas par Kysely.
  const { rows } = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM "user" ORDER BY "createdAt" LIMIT 1',
  )
  const user = rows[0]

  if (!user) {
    throw new Error(
      "Aucun compte dans la base : créez-en un via l'écran de premier lancement avant de semer des notes.",
    )
  }

  const inserted = await db
    .insertInto('dailyNotes')
    .values(
      ALL_NOTES.map((note) => ({
        userId: user.id,
        noteDate: note.date,
        title: note.title,
        content: note.content,
        contentText: flattenRichText(note.content),
        // Une note écrite en fin de journée, plutôt que toutes à l'instant du
        // seed : les dates affichées restent plausibles.
        createdAt: new Date(`${note.date}T17:30:00Z`),
        updatedAt: new Date(`${note.date}T17:30:00Z`),
      })),
    )
    // Un jour déjà rédigé est laissé tel quel — on ne veut pas écraser une
    // vraie note en rejouant le script.
    .onConflict((oc) => oc.columns(['userId', 'noteDate']).doNothing())
    .returning('noteDate')
    .execute()

  const skipped = ALL_NOTES.length - inserted.length
  console.log(`✓ ${inserted.length} note(s) semée(s) pour ${user.name}`)
  if (skipped > 0) {
    console.log(`  ${skipped} jour(s) déjà rédigé(s), laissé(s) intact(s)`)
  }
}

try {
  await seed()
} finally {
  await pool.end()
}
