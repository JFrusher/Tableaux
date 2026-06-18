# Multi-stage build: compile the client, then run the Express server that
# serves both the API and the built static client (single artifact).

# ── build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci
COPY . .
# Vite inlines VITE_* vars at build time, so they must be present here (pass via
# `docker build --build-arg` or the host's build-args). Without these the client
# ships with no Supabase config and can't run in production SaaS mode.
# NB: the Supabase *anon* key is public by design (it's served in the browser
# bundle and gated by Row-Level Security) — safe as a build arg. The
# service-role key is NEVER built in; it stays a runtime-only env var.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PUBLIC_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_PUBLIC_URL=$VITE_PUBLIC_URL
RUN npm run build

# ── runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/client/dist ./client/dist
COPY server ./server
COPY supabase ./supabase

# Persistent data dir for legacy (no-auth) mode, owned by the unprivileged
# runtime user so a mounted volume stays writable. Ignored in Supabase mode.
ENV TABLEAUX_DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["node", "server/index.js"]
