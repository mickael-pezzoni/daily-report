# CLAUDE.md

Guide pour Claude Code (claude.ai/code) sur ce dépôt.

## Projet

« Rapport journalier » — un journal de travail : **une note par utilisateur et par
date**, texte riche, pièces jointes, recherche plein texte, et un calendrier qui
montre les jours rédigés.

État actuel : **socle + authentification uniquement**. Les notes, le calendrier,
la recherche et les pièces jointes ne sont pas encore écrits — voir « Ce qui
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
- Migrations : fichiers SQL numérotés dans `src/db/migrations/`, appliqués dans
  l'ordre alphabétique par `src/db/migrate.ts`, chacun dans une transaction et
  tracé dans `_migrations`. **Ne jamais rééditer un fichier déjà appliqué** — en
  ajouter un nouveau.
- `001_better_auth.sql` est **généré**, pas écrit à la main :
  `pnpm dlx @better-auth/cli generate --config src/auth.ts`. Après tout ajout de
  plugin better-auth, régénérer dans un **nouveau** fichier de migration.

#### ⚠️ Le piège Kysely / better-auth

`src/db/index.ts` expose un `pool` pg **et** une instance Kysely montée dessus
avec le `CamelCasePlugin` (base en snake_case, code en camelCase).

Les tables de better-auth (`user`, `session`, `account`, `verification`) ont
leurs colonnes en **camelCase entre guillemets** (`"emailVerified"`, `"userId"`).
Le plugin les réécrirait en `email_verified` et casserait la requête. Ces tables
ne passent donc **jamais** par Kysely — utiliser `pool.query()`, comme le fait
`hasAccount()`. L'interface `Database` de `src/db/schema.ts` ne décrit que les
futures tables applicatives, en snake_case.

### `apps/web` — React 19 + Vite + react-router

- `src/api/auth-client.ts` — client better-auth en `basePath: '/api/auth'`. Les
  requêtes sont **relatives** : le proxy Vite les envoie sur :3001 en dev, un
  reverse proxy fera pareil en prod. Rien à configurer, pas de CORS en jeu.
- `src/api/client.ts` — point de passage unique du reste du HTTP, avec un
  `request()` qui met `credentials: 'include'` et lève un `ApiError` typé.
- `src/App.tsx` — deux informations pilotent la navigation : la session
  (better-auth) et `hasAccount` (`GET /api/auth-state`). Tant que l'une des deux
  manque, on affiche un écran d'attente plutôt que de rediriger puis se corriger.
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

## Environnement

`apps/api/.env` — `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`WEB_URL`, `PORT`. Voir `.env.example`. Le web n'a besoin d'aucune variable
(requêtes relatives).

## Source de la maquette

Projet Claude Design « Maquette rapport journalier »
(`45188f2b-abab-4750-83d1-d460aef1a5a6`), fichier `Rapport journalier.dc.html`,
lisible via l'outil `DesignSync`. Direction retenue : **1b / 2a** — calendrier
permanent à gauche, éditeur à droite. Les écrans implémentés sont **2d**
(connexion) et **2e** (premier lancement).

## Ce qui n'existe pas encore

- Écran principal 2a (calendrier + éditeur), 2f (aucune note ouverte), 2c
  (recherche globale ⌘K) — `components/layout/AppShell.tsx` n'est qu'un
  emplacement.
- Notes, pièces jointes, calendrier, recherche : ni tables, ni routes, ni types.
- **Passkey** et **lien magique** : présents dans la maquette 2d/2e, pas rendus —
  ils demandent les plugins better-auth correspondants, et le lien magique un
  fournisseur SMTP. « Mot de passe oublié ? » est retiré pour la même raison.
- `SignOutButton` est un **ajout hors maquette** : celle-ci ne prévoit aucune
  sortie de session. Il est autonome pour pouvoir migrer tel quel dans l'en-tête
  de 2a le moment venu.
