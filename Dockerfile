# YuqueDL Web Console — production image
# Multi-stage: build download core + Nuxt, run Nitro server.

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# --- deps ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY web/package.json web/pnpm-lock.yaml ./web/
RUN pnpm install --frozen-lockfile
RUN pnpm --dir web install --frozen-lockfile

# --- build ---
FROM deps AS build
COPY . .
RUN pnpm run build:core
RUN pnpm --dir web build

# --- runtime ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=8787
# data volume mount point
ENV YUQUE_DL_DATA=/data
# core entry (download engine)
ENV YUQUE_DL_CORE=/app/dist/es/index.js
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# zip CLI improves Chinese path export when available
RUN apt-get update \
  && apt-get install -y --no-install-recommends zip ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

# Install production deps for download core (axios / rand-user-agent / ...)
# Runtime dynamically imports dist/es/index.js which needs these packages.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod \
  && pnpm store prune || true

# app bits
COPY --from=build /app/dist /app/dist
COPY --from=build /app/server-lib /app/server-lib
COPY --from=build /app/web/.output /app/web/.output
COPY --from=build /app/web/package.json /app/web/package.json

# default data dir
RUN mkdir -p /data/downloads && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8787

# Nitro output server
CMD ["node", "web/.output/server/index.mjs"]
