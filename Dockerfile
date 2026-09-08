# Single image: the API also serves the built web app (apps/web/dist).
# Requires Node 24 at runtime — packages/types is source-only
# (package.json "main": "./src/index.ts") and is never compiled; the JS
# emitted by tsc for apps/api leaves `import ... from '@daily-report/types'`
# as-is, resolved at runtime by Node 24's native TypeScript support on the
# .ts file the workspace symlink points to. Do not downgrade below this
# version.

FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY apps/web apps/web
COPY packages/types packages/types
RUN pnpm --filter @daily-report/web build && pnpm --filter @daily-report/api build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV WEB_DIST_DIR=apps/web/dist
COPY --from=build /app /app
EXPOSE 3001
ENTRYPOINT ["apps/api/docker-entrypoint.sh"]
