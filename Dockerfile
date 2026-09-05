# syntax=docker/dockerfile:1

# --- deps: install once, reused by both the build and runtime stages so
# migrations (run via tsx at container start) have everything they need
# without re-installing dev dependencies at runtime. ---
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the Next.js production build ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `next build` statically analyzes every route module (including API
# routes), which imports src/env.ts — and env.ts intentionally crashes the
# process on invalid/missing config. These build-time-only placeholders
# satisfy that import-time validation; they are never used at runtime and
# are not copied into the final image — real values come from `docker run
# -e` / the orchestrator, validated for real when the container actually
# boots the server.
ENV DATABASE_URL=file:/tmp/build-placeholder.db
ENV SESSION_SECRET=00000000000000000000000000000000
ENV OIDC_ISSUER_URL=http://build-placeholder.invalid/realms/placeholder
ENV OIDC_CLIENT_ID=build-placeholder
ENV OIDC_CLIENT_SECRET=build-placeholder
ENV OIDC_REDIRECT_URI=http://build-placeholder.invalid/api/auth/callback/keycloak
RUN npm run build

# --- runner: minimal final image ---
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 arrhub

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.sqlite.config.ts /app/drizzle.postgres.config.ts ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json /app/tsconfig.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# /data is the default SQLite location (DATABASE_URL=file:/data/app.db) —
# give the non-root user a writable place for it out of the box.
RUN mkdir -p /data && chown -R arrhub:nodejs /data

USER arrhub

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
