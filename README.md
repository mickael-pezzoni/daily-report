# Daily-report

Un journal de travail personnel : une note par jour, texte riche, pièces
jointes, recherche plein texte, et un calendrier qui montre les journées déjà
rédigées.

Application mono-compte — pensée pour un usage personnel ou on-premise, pas
pour héberger plusieurs utilisateurs sur la même instance.

## Fonctionnalités

- Une note par jour (titre + texte riche), organisée par un calendrier
  permanent (vue mois sur bureau, semaine sur mobile).
- Pièces jointes par glisser-déposer, collées ou insérées dans le texte.
- Recherche globale (Ctrl+K / ⌘K) : titre, contenu et noms de fichiers,
  filtrable par portée et par date.
- Français / anglais, choix de langue rattaché au compte.
- Stockage des fichiers sur disque ou compatible S3 (S3, R2, MinIO,
  Backblaze, Scaleway…), au choix.

Ce qui n'existe pas encore (voir le détail dans `CLAUDE.md`) : export
PDF/Markdown, recherche dans le contenu des PDF, ramasse-miettes du
stockage, passkey / lien magique.

## Stack

Monorepo pnpm :

- `apps/api` — Hono, better-auth, Kysely sur PostgreSQL 17.
- `apps/web` — React 19, Vite, react-router.
- `packages/types` — types partagés entre les deux (source-only, pas de
  build).

## Démarrer

Prérequis : Node (via Nix, voir plus bas), pnpm, Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # à ajuster si besoin
pnpm dev
```

`pnpm dev` lance Postgres et Adminer via Docker Compose, applique les
migrations, puis démarre l'API (http://localhost:3001) et le web
(http://localhost:5173). Adminer est disponible sur http://localhost:8080.

### NixOS

Sur NixOS, `node` n'est pas dans le PATH système : direnv charge
`shell.nix` en entrant dans le dossier. Si ce n'est pas le cas, préfixer les
commandes :

```bash
nix-shell shell.nix --run 'pnpm dev'
```

### Scripts utiles

```bash
pnpm dev:apps     # web + api seuls, sans toucher à la base
pnpm build        # build de tous les packages
pnpm typecheck    # tsc --noEmit partout
pnpm lint         # oxlint (apps/web)

pnpm db:up        # Postgres + Adminer, attend le healthcheck
pnpm db:down      # arrête les conteneurs, garde le volume
pnpm db:reset     # ⚠️ détruit le volume, recrée la base et rejoue les migrations
pnpm migrate      # applique les migrations en attente
```

Pas de suite de tests dans ce dépôt pour l'instant.

## Configuration

Toute la configuration vit dans `apps/api/.env` — voir
`apps/api/.env.example` pour la liste complète et les réglages S3/R2/MinIO.
Le web n'a besoin d'aucune variable (requêtes relatives à l'API).

## Contribuer avec Claude Code

`CLAUDE.md` porte la documentation d'architecture détaillée (pièges connus,
conventions, ce qui est fait vs à faire) à l'usage de Claude Code. Utile
aussi pour s'orienter rapidement dans le code sans agent.
