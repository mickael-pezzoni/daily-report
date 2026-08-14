-- Tables de better-auth.
-- Généré par `pnpm dlx @better-auth/cli generate --config src/auth.ts`, pas écrit à la main.
-- Régénérer après tout ajout de plugin better-auth ou de champ `additionalFields`.
--
-- `user.language` vient des `additionalFields` de src/auth.ts. Tant que le schéma
-- n'est pas figé, il entre dans ce script de création plutôt que dans un ALTER :
-- une base déjà créée demande donc un `pnpm db:reset` pour le voir apparaître.
--
-- Colonnes en camelCase entre guillemets : ces tables ne passent jamais par
-- l'instance Kysely (CamelCasePlugin) — voir src/db/index.ts.

create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "language" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");