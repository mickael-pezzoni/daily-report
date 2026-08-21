# CLAUDE.md

Guide pour Claude Code (claude.ai/code) sur ce dépôt.

## Projet

« Rapport journalier » — un journal de travail : **une note par utilisateur et par
date**, texte riche, pièces jointes, recherche plein texte, et un calendrier qui
montre les jours rédigés.

État actuel : **socle, authentification, notes, calendrier, pièces jointes et
recherche globale (⌘K)**. L'export n'est pas encore écrit — voir « Ce qui
n'existe pas encore » en bas.

## ⚠️ Toolchain — à lire avant toute commande

`node` **n'est pas dans le PATH système** de cette machine (NixOS). Seul `pnpm`
est global, et son shebang pointe directement dans le nix store. Sans shell nix,
tout ce qui passe par un shim `#!/usr/bin/env node` (vite, tsx, tsc) échoue.

direnv charge `shell.nix` automatiquement en entrant dans le dossier. Si ce n'est
pas le cas (`direnv allow` jamais lancé, ou shell non interactif), préfixer :

```bash
nix-shell shell.nix --run 'pnpm dev'
```

## Commandes

Depuis la racine.

```bash
pnpm dev          # docker compose up --wait, puis migrations, puis web + api
pnpm dev:apps     # web (5173) + api (3001) seuls, sans toucher à la base
pnpm build        # build de tous les packages
pnpm typecheck    # tsc --noEmit partout
pnpm lint         # oxlint (apps/web)

pnpm db:up        # Postgres + Adminer, attend le healthcheck
pnpm db:down      # arrête les conteneurs, garde le volume
pnpm db:reset     # ⚠️ DÉTRUIT le volume, recrée la base et rejoue les migrations
pnpm migrate      # applique les migrations en attente
```

Postgres 17 et Adminer viennent de `docker-compose.yml` (base `daily_report`,
Postgres sur 5432, Adminer sur http://localhost:8080).

Pas de suite de tests dans ce dépôt pour l'instant.

> Le nom de projet Docker Compose vient du nom du dossier. Un autre dossier
> nommé `daily-report` partagerait le même volume `daily-report_postgres_data`.

## Commits

**Ne jamais se citer comme auteur ou co-auteur.** Pas de trailer
`Co-Authored-By:`, pas de mention « Generated with… », pas de signature d'aucune
sorte. L'auteur du commit est celui que git a configuré, et lui seul.

Message en français, sur le modèle de l'historique : une ligne de titre au
format **Conventional Commits** — `type:` ou `type(scope):` (`feat`, `fix`,
`refactor`, `chore`, `docs`…), suivi d'une phrase nominale — puis un corps qui
dit **pourquoi** plutôt que quoi — le diff dit déjà quoi.

Commits directement sur `main` : ce dépôt n'utilise pas de branches.

## Architecture

Monorepo pnpm : `apps/api`, `apps/web`, `packages/types`.

`packages/types` (`@daily-report/types`) est **source-only** — pas de build, les
deux apps importent directement le `.ts`. Il porte les formes JSON qui passent
sur le fil, pas les lignes de base.

### `apps/api` — Hono + better-auth + Kysely

- `src/index.ts` câble tout : CORS, `/api/auth/**` délégué à better-auth, routes
  publiques (`/health`, `/api/auth-state`), routes protégées derrière
  `requireAuth`.
- `src/middleware/require-auth.ts` lit la session et pose `userId` dans le
  contexte Hono. **Il n'y a aucune autre couche d'autorisation** : toute requête
  ajoutée derrière ce middleware doit filtrer explicitement sur ce `userId`.
- `src/auth.ts` configure better-auth (e-mail + mot de passe) et porte le verrou
  d'espace mono-compte : un hook `before` sur `/sign-up/email` renvoie
  **403 `SIGNUP_CLOSED`** dès qu'un compte existe. C'est le pendant serveur de
  l'écran de premier lancement. Il porte aussi les `additionalFields` de la table
  `user` — aujourd'hui la seule `language` ; tout ajout ici doit se retrouver
  dans `001_better_auth.sql`, que le CLI better-auth sait régénérer.
- `src/env.ts` lit l'environnement et échoue tout de suite si `DATABASE_URL` ou
  `BETTER_AUTH_SECRET` manque.
- `src/routes/notes.ts` et `src/routes/calendar.ts` sont **du REST classique** :
  la ressource est la note, identifiée par son UUID. La date n'est qu'un attribut
  — `GET /api/notes?date=…` filtre la collection, elle n'identifie jamais une URL.
  Côté web c'est l'inverse : `/notes/2026-08-03` est une **vue**, qui doit
  s'ouvrir avant qu'aucune note (donc aucun identifiant) n'existe.
- Une ressource appartenant à quelqu'un d'autre répond **404, jamais 403** : on ne
  divulgue pas son existence.
- **Les messages d'erreur de l'API sont en anglais**, et ne sont jamais affichés
  tels quels. Ils s'adressent à un journal de serveur, pas à l'utilisateur : le
  web traduit le `code` — ou, à défaut, le statut — via
  `apps/web/src/i18n/api-errors.ts`. Une nouvelle erreur destinée à être montrée
  doit donc porter un `code`, sinon elle retombera sur un message générique.
- `GET /api/notes` renvoie des `NoteListItem` — la note **plus ses pièces
  jointes**, là où `GET /api/notes/:id` n'en donne pas. Les cartes de l'écran 2f
  les affichent ; aller les chercher carte par carte ferait un N+1. Une seule
  requête `WHERE note_id IN (…)` les ramène toutes, groupées en mémoire.
- `POST /api/notes` sur une date déjà prise répond **409**. On laisse la contrainte
  `UNIQUE (user_id, note_date)` trancher plutôt que de faire un `SELECT` préalable,
  qui laisserait une fenêtre de concurrence.
- `content_text` est **toujours recalculé au serveur** (`src/lib/rich-text.ts`),
  jamais accepté du client : il doit rester le reflet exact de `content`, sinon les
  extraits et la recherche mentiraient sur le contenu des notes.
- `GET /api/notes` porte aussi la **recherche globale** (écran 2c) : `q=` le
  terme, `scope=all|text|files` ce qu'on fouille, `from=YYYY-MM-DD` une borne
  basse cumulable avec le reste. `SEARCH_SCOPES` vit dans `@daily-report/types`
  pour la même raison que `LANGUAGE_CODES` : le serveur doit pouvoir refuser
  une autre valeur.
- ⚠️ **Le nom de fichier se cherche en `ILIKE`, pas avec l'opérateur `%`.**
  `%` compare les deux chaînes *entières* : un terme court noyé dans un nom
  long passe sous le seuil de similarité et ne sort jamais (« ecran » contre
  « Capture d'ecran_20260701_203406.png » ne vaut que 0,18). L'index
  `gin_trgm_ops` de la migration 004 accélère les deux — c'est un `ILIKE`
  qu'il sert ici. Le fragment est échappé (`likeFragment`) : un `%` tapé dans
  la recherche est du texte, pas un joker.
- `src/routes/attachments.ts` expose deux routeurs : les routes portées par une
  note (`/api/notes/:noteId/attachments`, dépôt et listing) et celles portées par
  la pièce jointe (`/api/attachments/:id`, métadonnées, contenu, suppression).
  **Le premier est monté avant `/api/notes`**, sinon le `/:id` des notes capterait
  la requête.

#### Le stockage des fichiers

`src/storage/` isole complètement le stockage : aucune route, aucune requête SQL
ne contient de `fs` ni de `S3Client`.

- `driver.ts` — le contrat. L'application ne manipule que des **clés opaques**
  qu'elle fabrique elle-même (`src/lib/attachments.ts`) ; le driver seul sait ce
  qu'elles deviennent.
- `local.ts` — disque, pour l'on-premise. Refuse toute clé qui sortirait du
  répertoire racine.
- `s3.ts` — un seul driver pour S3, R2, MinIO, Backblaze, Scaleway… : ils parlent
  le même protocole, seuls `S3_ENDPOINT` et `S3_FORCE_PATH_STYLE` changent.
- `index.ts` — choisit le driver d'après `STORAGE_DRIVER`. Seul endroit du dépôt
  qui sait quels drivers existent.

`getSignedUrl` est **optionnel** dans l'interface : quand un driver sait signer
(S3), `GET /api/attachments/:id/content` redirige et la bande passante ne traverse
pas l'API ; sinon elle relaie le flux. Le contrôle d'accès a lieu avant, dans les
deux cas.

Deux règles à ne pas inverser :

- **On écrit l'objet avant la ligne, on supprime la ligne avant l'objet.** Un objet
  sans ligne est un déchet silencieux, rattrapable ; une ligne sans objet est un
  lien mort visible de l'utilisateur.
- **`DELETE /api/notes/:id` relève les clés de stockage AVANT de supprimer.** Le
  `ON DELETE CASCADE` emporte les lignes `attachments`, et avec elles la seule
  trace des fichiers. Sans cette précaution, chaque note supprimée laisse des
  orphelins introuvables.

Seuls les types inertes (`image/png|jpeg|gif|webp|avif`, `application/pdf`) sont
servis en `inline` ; tout le reste part en `attachment`, avec `nosniff`. `image/svg+xml`
est volontairement exclu : un SVG déposé par un tiers exécuterait son script dans
l'origine de l'application.
- Migrations : fichiers SQL numérotés dans `src/db/migrations/`, appliqués dans
  l'ordre alphabétique par `src/db/migrate.ts`, chacun dans une transaction et
  tracé dans `_migrations`. **Ne jamais rééditer un fichier déjà appliqué** — en
  ajouter un nouveau.
- `001_better_auth.sql` est **généré**, pas écrit à la main :
  `pnpm dlx @better-auth/cli generate --config src/auth.ts`. Après tout ajout de
  plugin better-auth, régénérer dans un **nouveau** fichier de migration.

#### ⚠️ Trois pièges de la couche base

`src/db/index.ts` expose un `pool` pg **et** une instance Kysely montée dessus
avec le `CamelCasePlugin` (base en snake_case, code en camelCase).

**1. Les tables de better-auth ne passent jamais par Kysely.** `user`, `session`,
`account` et `verification` ont leurs colonnes en **camelCase entre guillemets**
(`"emailVerified"`, `"userId"`). Le plugin les réécrirait en `email_verified` et
casserait la requête. Pour les interroger, utiliser `pool.query()`, comme le fait
`hasAccount()`. L'interface `Database` de `src/db/schema.ts` ne décrit que les
tables applicatives.

**2. Le `CamelCasePlugin` renomme aussi les tables.** Dans `src/db/schema.ts`, la
clé s'écrit `dailyNotes` et vise la table `daily_notes` ; `noteDate` vise
`note_date`. Écrire les clés en snake_case produirait du `daily__notes` en SQL.

**3. `pg` transforme le type `DATE` en objet `Date` JS**, ce qui décale la journée
d'un cran dès que le fuseau n'est pas UTC. `src/db/index.ts` pose donc
`pg.types.setTypeParser(1082, (v) => v)` : une date de note reste la chaîne
`YYYY-MM-DD` du SQL jusqu'à l'URL du navigateur. Ne pas retirer cette ligne.

### `apps/web` — React 19 + Vite + react-router

- `src/api/auth-client.ts` — client better-auth en `basePath: '/api/auth'`. Les
  requêtes sont **relatives** : le proxy Vite les envoie sur :3001 en dev, un
  reverse proxy fera pareil en prod. Rien à configurer, pas de CORS en jeu.
- `src/api/client.ts` — point de passage unique du reste du HTTP, avec un
  `request()` qui met `credentials: 'include'` et lève un `ApiError` typé.
- `src/App.tsx` — deux informations pilotent la navigation : la session
  (better-auth) et `hasAccount` (`GET /api/auth-state`). Tant que l'une des deux
  manque, on affiche un écran d'attente plutôt que de rediriger puis se corriger.
  Routes : `/` = écran vide 2f, `/notes/:date` = écran 2a. Connexion et création
  de compte atterrissent sur la note du jour.
- `src/lib/dates.ts` — **une date de note est une chaîne `YYYY-MM-DD`, jamais un
  `Date`.** Les calculs passent par un `Date` à midi UTC, ce qui met les
  changements d'heure hors de portée ; seul `todayISO()` lit l'heure locale. Ce
  module ne fait plus **que** du calcul : tout ce qui produit du texte lisible
  est passé dans `src/lib/date-format.ts`, qui dépend de la langue.
- `src/hooks/useNote.ts` expose **`ensureNoteId()`**, qui crée la note si le jour
  est vierge — joindre un fichier à une journée blanche est un geste légitime, et
  l'API rattache les pièces jointes à une note. Il partage `creatingRef` avec
  l'enregistrement : un dépôt et une frappe simultanés ne produisent qu'un `POST`.
- `src/api/client.ts` — `request()` **omet `Content-Type` quand le corps est un
  `FormData`**. Le navigateur doit l'écrire lui-même pour y placer la frontière
  multipart ; l'imposer casserait tout envoi de fichier.
- Le glisser-déposer de `NoteView` compte les `dragenter`/`dragleave` au lieu de
  se fier au premier `dragleave` : ces événements se déclenchent pour chaque
  enfant survolé, et le tiroir clignoterait. L'éditeur intercepte à part les
  images (`handleDrop`/`handlePaste` de TipTap) pour les insérer dans le texte, et
  appelle `stopPropagation()` — sinon le fichier partirait deux fois.
- `EditorContextMenu` (écran 7a) remplace le menu natif du clic droit dans
  l'éditeur — `handleDOMEvents.contextmenu` de `NoteEditor` fait le
  `preventDefault()`. Couper/Copier/Coller sont donc réimplémentés
  (`execCommand`/`navigator.clipboard`) plutôt que laissés au navigateur ;
  Ctrl+X/C/V au clavier restent la voie de repli si l'un des trois échoue
  (permission refusée, API absente). « Insérer une image ici » ne liste que les
  pièces jointes **image** de la note ouverte (`isPreviewableImage`) — pas de
  médiathèque globale, une pièce jointe appartient à une note. Le clic droit ne
  déplace le curseur que s'il tombe hors d'une sélection déjà active, sinon
  Couper/Copier casseraient une sélection qu'on vient d'écraser.
- `src/hooks/useNote.ts` — chargement et enregistrement automatique d'une journée.
  L'écriture est en deux temps (`POST` puis `PATCH`), puisque la note n'existe pas
  tant que rien n'a été écrit. Trois garde-fous à ne pas casser : une seule
  création en vol par jour, un `409` traité comme « elle existe déjà » et non
  comme une erreur, et un vidage de la file d'attente au changement de date comme
  au démontage.
- `src/hooks/useAuthState.ts` — prend une `revalidateKey` liée à l'identité de
  session. Sans elle, après la création du premier compte puis une déconnexion,
  on garderait un `hasAccount: false` périmé et on renverrait vers un écran
  d'inscription que le serveur refuse.
- `WeekDigest` (écrans 2f et 2g) : le condensé de semaine de la colonne de
  droite quand aucune note n'est ouverte. Autonome — sa propre ancre de
  semaine (`startOfWeek(todayISO())` au montage) plutôt qu'un état porté par
  `AppShell`, puisque rien d'autre à l'écran n'en dépend. Chaque rangée est un
  `<Link>` pleine largeur (date + extrait + étiquette « N fichiers »),
  **sans bouton supprimer** — contrairement à `NoteResultCard`, la maquette
  n'en met pas ici. Ne liste que les jours **ayant** une note ; les jours
  vierges de la semaine ne comptent que dans l'étiquette « N jours sans
  note ». **2g** est l'état d'une semaine sans aucune note : le message centré
  et le bouton « ＋ Écrire la note du … » remplacent la liste et les
  étiquettes — il ouvre le **premier jour de la semaine affichée**
  (`anchor`, pas `todayISO()`) : naviguer vers une semaine passée vide puis
  cliquer doit écrire ce lundi-là, pas rouvrir la journée du jour.
  Consomme `GET /api/notes?from=…&to=…` — la borne haute incluse qu'`from`
  n'avait pas avant cet écran, symétrique et cumulable avec elle.
  « ↩ Cette semaine » ne s'affiche que si `anchor` s'est éloigné de la semaine
  courante (`anchor !== startOfWeek(todayISO())`) — inutile d'offrir un retour
  vers là où l'on se trouve déjà. Il vit **devant** la flèche ‹, pas après la
  flèche › : apparaître et disparaître à la fin de la rangée décalerait la
  plage de dates et les flèches à chaque franchissement de la semaine
  courante, alors que devant elles seul son propre texte bouge.
- **Deux formes de rangée pour une journée, à ne pas confondre.**
  `NoteResultCard` est la carte élevée (`.card elev-sm`) des résultats de
  recherche (2c) *et* des « derniers jours » de l'onglet Calendrier mobile
  (2b) — la maquette leur donne la même forme, bouton « supprimer » compris.
  Les rangées de `WeekDigest` (2f/2g) sont plus nues — un simple `border-bottom`,
  sans bouton ni surlignage — puisque la maquette ne leur donne aucune
  action de suppression. Le `query` de `NoteResultCard` est **facultatif** —
  sans lui, pas de surlignage ni de pièces jointes listées, ce qui est
  exactement ce que veut la liste mobile.
- La suppression depuis une carte de résultat (`NoteResultCard`, écrans 2b/2c)
  est **optimiste** : `AppShell` retire la note et la pastille du calendrier
  avant la réponse (un `204` n'a rien à apprendre à la vue), recharge la liste
  derrière — une note masquée par la limite peut remonter — et recharge le
  mois si l'appel a échoué. `WeekDigest` n'expose aucune suppression.
- `UserMenu` (écran 6a) vit dans **l'en-tête de droite**, en 2a comme en 2f, pas
  dans la barre latérale : la maquette l'y a déplacé. Il porte le choix de la
  langue et la déconnexion. Les deux en-têtes qui l'accueillent ont un
  `position: relative` — c'est leur bord droit qui ancre le menu.
- `SearchModal` (écran 2c) est monté et démonté par `AppShell`, qui possède
  l'écouteur clavier global Ctrl+K/⌘K (`keydown` sur `document`, seul point
  d'entrée pour l'instant — voir « Ce qui n'existe pas encore ») et lui passe
  `onNavigate`/`onDelete`. Reprend le `<dialog>` + `showModal()` de
  `ConfirmDialog` (`components/ui/`) plutôt qu'un nouveau système de modale.
  Trois points à ne pas défaire :
  - La saisie est **amortie** (`setTimeout` 250 ms) et la requête en vol
    **annulée** (`AbortController`) : c'est le premier appel du projet à le
    faire, les autres hooks se contentent d'ignorer une réponse périmée, ce
    qui ne suffit pas à une frappe qui déclenche une requête par caractère.
  - Le surlignage passe par `foldWithMap`, qui replie **caractère par
    caractère** en retenant la position d'origine de chacun. `'é'.normalize
    ('NFD')` fait deux caractères : un index cherché dans la chaîne repliée ne
    désigne pas le même endroit dans la chaîne d'origine dès qu'un accent le
    précède, et le surlignage se décale. Il reste par ailleurs purement
    esthétique et travaille sur l'extrait **déjà tronqué** par `excerptOf` :
    un terme trouvé par racinisation, ou situé plus loin dans la note, ne s'y
    retrouve pas littéralement — l'extrait s'affiche alors sans surlignage.
- Les remises à zéro du bouton natif des filtres de `SearchModal` passent par
  `:where(.filter)`, de spécificité **nulle**. Une règle de module l'emporte
  sur le design system (les modules sont chargés après lui) : à spécificité
  normale, ces resets effaceraient le fond de `.tag-accent` et la bordure de
  `.tag-outline`. Même piège que l'ordre des imports de `main.tsx`.
- Composants par domaine sous `src/components/<domaine>/`, chacun avec son
  `*.module.css`.

#### Les langues

`src/i18n/` — i18next + react-i18next, **français et anglais**, catalogues dans
le bundle (`locales/*.json`) : pas de chargement réseau, donc rien à attendre au
premier rendu.

La langue **appartient au compte**, colonne `user.language` — se connecter
depuis un autre navigateur la restitue. `localStorage` reste le repli tant qu'on
ne sait pas qui regarde l'écran (écran de connexion, tout premier rendu), et
i18next continue de l'écrire à chaque `changeLanguage`.

- `LANGUAGES` reste la **seule liste** à compléter pour ajouter une langue : le
  code, son `locale` Intl et son libellé. Le sélecteur et `Intl` s'y alimentent.
  Seul le `code` est partagé, dans `LANGUAGE_CODES` de `@daily-report/types` :
  c'est ce que le serveur doit connaître pour refuser une autre valeur. Le
  `satisfies` de `LANGUAGES` fait échouer la compilation si on ajoute une entrée
  sans son code — c'est le garde-fou qui tient les deux listes ensemble.
- Le champ passe par les **`additionalFields`** de better-auth (`src/auth.ts`),
  pas par une route maison : la langue voyage dans la session
  (`useSession().data.user.language`), et `updateUser({ language })` l'écrit. Son
  `type` est la liste littérale des codes — ce qui donne au client le type
  `'fr' | 'en'`, mais **ne valide rien** : better-auth traduit un type en liste
  littérale par un `z.any()`. C'est le hook `before` d'`auth.ts` qui refuse les
  codes inconnus, sur `/sign-up/email` comme sur `/update-user`.
- `useLanguageSync` (branché dans `App.tsx`, **avant le premier `return`**)
  applique la langue du compte dès que la session arrive, et **sème** la langue
  locale sur un compte qui n'en a pas encore. Il retient dans un ref la dernière
  valeur appliquée : sans ça, un effet rejoué sur une session encore périmée
  rebasculerait la langue que l'utilisateur vient de choisir dans le menu.
- On y attache un `locale` et pas seulement un code : `en-GB` et non `en-US`,
  parce que la grille du calendrier commence le lundi (maquette 2a) et qu'`en-US`
  afficherait des initiales de jours contredisant cette grille.
- **Les vues gardent une clé de traduction, jamais un message.** `useNote` et
  `useAttachments` exposent `errorKey`, pas `error` : un texte figé au moment de
  l'échec ne suivrait pas un changement de langue.
- `useDateFormat()` passe par `useTranslation()` plutôt que de lire
  `i18next.language` : c'est cet abonnement qui fait re-rendre une vue n'affichant
  que des dates quand la langue change.
- Le texte fantôme de TipTap est une **fonction** (`() => tRef.current(…)`), pas
  une chaîne : `Placeholder` la lit à chaque calcul des décorations, ce qui lui
  permet de changer de langue sans remonter l'éditeur.
- `<html lang>` suit la langue — césure, guillemets et voix du lecteur d'écran en
  dépendent.

#### Les trois couches CSS

`src/styles/`, importées dans cet ordre par `main.tsx` :

1. **`tokens.css`** — le bloc `:root` du design system Organic (rampes,
   polices, espacements, rayons, ombres). **C'est le seul fichier à éditer pour
   changer le thème.** Un thème alternatif s'ajoute ici en
   `:root[data-theme="…"]`, sans toucher au reste.
2. **`semantic.css`** — les rôles applicatifs `--app-*`, définis **uniquement**
   à partir des tokens de la couche 1. Jamais de valeur en dur.
3. **`organic.css`** — la couche composants d'Organic (`.btn`, `.input`,
   `.card`, `.tag`, `.field`, `.elev-*`…), copiée verbatim du projet Design.
   **Ne pas modifier à la main** : pour retoucher le look, éditer `tokens.css` ;
   pour suivre le design system, réimporter le fichier.

**Règle** : un `*.module.css` ne référence que des variables des couches 1 et 2 —
jamais un hex, jamais un px que le scale porte déjà. Test de non-régression :
réassigner `--color-accent` et `--color-bg` sur `:root` dans le devtools doit
repeindre toute l'interface, sans résidu.

⚠️ **Dans `main.tsx`, ces quatre imports doivent rester avant celui de `App`.**
Le bundler émet le CSS dans l'ordre où il rencontre les modules ; importer `App`
d'abord ferait sortir tous les `*.module.css` avant la couche 3. Comme `.card`,
`.btn` et les classes de modules ont toutes la même spécificité (une classe),
c'est l'ordre qui tranche : le design system écraserait alors les surcharges des
composants au lieu de leur servir de socle. Symptôme typique — un `.card` auquel
un module impose `flex-direction: row` reste en colonne.

## Environnement

`apps/api/.env` — `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`WEB_URL`, `PORT`, plus la configuration du stockage (`STORAGE_DRIVER`,
`STORAGE_LOCAL_DIR` ou les `S3_*`, `MAX_UPLOAD_BYTES`). Voir `.env.example`, qui
donne les réglages de R2 et MinIO. Les variables `S3_*` ne sont exigées que si
`STORAGE_DRIVER=s3` : un déploiement on-premise n'a pas à les renseigner.

Le web n'a besoin d'aucune variable (requêtes relatives).

## Source de la maquette

Projet Claude Design « Maquette rapport journalier »
(`45188f2b-abab-4750-83d1-d460aef1a5a6`), fichier `Rapport journalier.dc.html`,
lisible via l'outil `DesignSync`. Direction retenue : **1b / 2a** — calendrier
permanent à gauche, éditeur à droite. Écrans implémentés : **2d** (connexion),
**2e** (premier lancement), **2a** (journée ouverte), **2f** (aucune note
ouverte, condensé de semaine), **2g** (aucune note ouverte, semaine sans
note), **2c** (recherche globale, en modale) et **6a** (menu utilisateur).

⚠️ **La maquette bouge.** Relire le fichier avant de toucher un écran plutôt que
de se fier à ce document. Révisions déjà encaissées : le menu utilisateur est
passé de la barre latérale à l'en-tête de droite, l'en-tête de 2f a perdu son
bouton « ＋ Note » — il n'y reste que le titre et le menu utilisateur, le geste
restant offert par la barre latérale — et 2f a remplacé sa colonne de post-it
inclinés (`RecentNoteCard`, abandonné) par le condensé de semaine navigable
`WeekDigest`, avec son pendant à vide 2g.

## Ce qui n'existe pas encore

- **Ramasse-miettes du stockage** : un objet peut survivre à sa ligne si la
  suppression échoue après coup (réseau, S3 indisponible). Rien ne les balaie
  aujourd'hui ; une tâche comparant les clés du stockage à la table `attachments`
  reste à écrire.
- **Image insérée orpheline** : supprimer une pièce jointe laisse dans le document
  un `<img>` vers une URL en 404. La confirmation le signale, mais rien ne nettoie
  le texte. Le lien inverse n'existe pas non plus, volontairement : retirer une
  image du texte ne détache pas le fichier de la journée.
- **Directions non retenues de la maquette** : la galerie horizontale (3a), la
  liste compacte (3b), la grille (3c) et le panneau latéral rétractable (4a/4b)
  sont des explorations. C'est le tiroir de pied 2a-open qui est implémenté.
- **Export** PDF/.md : le bouton `⌕` et « Exporter ▾ » de l'en-tête 2a ne sont
  volontairement pas rendus, pour ne pas livrer de commande morte. Les deux
  barres de recherche de la maquette (« Rechercher dans toutes mes notes… »
  de 2f, « chercher dans mes notes… » de l'onglet Calendrier mobile 2b), elles,
  le sont : chacune ouvre la même `SearchModal` via un `onOpenSearch` (2f) ou
  un clic direct (`.calendar_search`, 2b) remonté jusqu'à `setSearchOpen`
  d'`AppShell`, seul propriétaire de l'état d'ouverture. La barre de 2f est
  masquée sous 900 px comme `.desktop_week` : elle affiche le raccourci
  Ctrl+K/⌘K, qui n'a de sens que là où le clavier est la norme — la version
  mobile n'en montre pas.
- **Contenu des PDF** : la maquette 2c annonce que les pièces jointes sont
  fouillées « nom de fichier **et contenu PDF** ». Seul le nom l'est ; rien
  n'extrait le texte d'un PDF aujourd'hui. La mention rendue par
  `SearchModal` ne parle donc que du nom de fichier — écart assumé avec la
  maquette, plutôt que de promettre ce que la recherche ne fait pas.
- **Étiquette « brouillon »** : la maquette 2f la pose sur une des rangées de
  son condensé de semaine. Rien dans le modèle ne distingue un brouillon d'une
  note finie — il n'y a ni colonne d'état ni geste de publication. L'étiquette
  attend qu'on décide ce qu'elle veut dire ; `WeekDigest` ne rend que
  l'étiquette qui a un référent réel, « N fichiers ».
- **Écran mobile 2b** : barre d'onglets Aujourd'hui/Calendrier/Exporter, calendrier
  plein écran. Il n'y a pour l'instant qu'un repli responsive sous 900 px, où la
  barre latérale passe au-dessus du contenu.
- **Passkey** et **lien magique** : présents dans la maquette 2d/2e, pas rendus —
  ils demandent les plugins better-auth correspondants, et le lien magique un
  fournisseur SMTP. « Mot de passe oublié ? » est retiré pour la même raison.
- **Le schéma n'est pas figé** : `user.language` a été ajouté *dans*
  `001_better_auth.sql` plutôt qu'en migration `004_`. Tant que ce choix tient,
  toucher au schéma demande un `pnpm db:reset` — et donc de recréer le compte.
  Le jour où la base porte des données à garder, revenir aux migrations
  additives et ne plus rééditer un fichier appliqué.
