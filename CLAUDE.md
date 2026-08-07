# CLAUDE.md

Guide pour Claude Code (claude.ai/code) sur ce dépôt.

## Projet

« Rapport journalier » — un journal de travail : **une note par utilisateur et par
date**, texte riche, pièces jointes, recherche plein texte, et un calendrier qui
montre les jours rédigés.

État actuel : **socle, authentification, notes et calendrier**. La recherche, les
pièces jointes et l'export ne sont pas encore écrits — voir « Ce qui n'existe pas
encore » en bas.

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
  l'écran de premier lancement.
- `src/env.ts` lit l'environnement et échoue tout de suite si `DATABASE_URL` ou
  `BETTER_AUTH_SECRET` manque.
- `src/routes/notes.ts` et `src/routes/calendar.ts` sont **du REST classique** :
  la ressource est la note, identifiée par son UUID. La date n'est qu'un attribut
  — `GET /api/notes?date=…` filtre la collection, elle n'identifie jamais une URL.
  Côté web c'est l'inverse : `/notes/2026-08-03` est une **vue**, qui doit
  s'ouvrir avant qu'aucune note (donc aucun identifiant) n'existe.
- Une ressource appartenant à quelqu'un d'autre répond **404, jamais 403** : on ne
  divulgue pas son existence.
- `POST /api/notes` sur une date déjà prise répond **409**. On laisse la contrainte
  `UNIQUE (user_id, note_date)` trancher plutôt que de faire un `SELECT` préalable,
  qui laisserait une fenêtre de concurrence.
- `content_text` est **toujours recalculé au serveur** (`src/lib/rich-text.ts`),
  jamais accepté du client : il doit rester le reflet exact de `content`, sinon les
  extraits — et demain la recherche — mentiraient sur le contenu des notes.
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
  changements d'heure hors de portée ; seul `todayISO()` lit l'heure locale. Les
  libellés français viennent d'`Intl`, sans dépendance de date.
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
- Composants par domaine sous `src/components/<domaine>/`, chacun avec son
  `*.module.css`.

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
**2e** (premier lancement), **2a** (journée ouverte) et **2f** (aucune note
ouverte).

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
- **Recherche globale ⌘K** (2c) et **export** PDF/.md : les boutons `⌕` et
  « Exporter ▾ » de l'en-tête 2a ne sont volontairement pas rendus, pour ne pas
  livrer de commande morte. La colonne `content_text` prépare déjà le terrain de
  la recherche plein texte française.
- **Écran mobile 2b** : barre d'onglets Aujourd'hui/Calendrier/Exporter, calendrier
  plein écran. Il n'y a pour l'instant qu'un repli responsive sous 900 px, où la
  barre latérale passe au-dessus du contenu.
- **Passkey** et **lien magique** : présents dans la maquette 2d/2e, pas rendus —
  ils demandent les plugins better-auth correspondants, et le lien magique un
  fournisseur SMTP. « Mot de passe oublié ? » est retiré pour la même raison.
- `SignOutButton` est un **ajout hors maquette** : celle-ci ne prévoit aucune
  sortie de session. Il vit dans l'en-tête de 2a et de 2f.
