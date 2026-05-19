# syntax=docker/dockerfile:1.7

# =========================
# Stage 1: build everything
# =========================
FROM node:20-bookworm-slim AS build

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo

# Copy package manifests first so dependency installation can be cached
# independently of source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/2grils-ppt/package.json artifacts/2grils-ppt/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY lib/db/package.json lib/db/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-zod/package.json lib/api-zod/
COPY scripts/package.json scripts/

# preinstall guard checks user-agent; pnpm itself sets it correctly.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source
COPY . .

# Vite reads PORT + BASE_PATH at build time from env (see vite.config.ts).
# These are build-only — runtime PORT comes from compose env.
ENV PORT=5173
ENV BASE_PATH=/
ENV NODE_ENV=production

# Root build: typecheck (libs first via tsc -b) then per-workspace build.
RUN pnpm run build


# =========================
# Stage 2: runtime image
# =========================
FROM node:20-bookworm-slim AS runtime

# LibreOffice is required for PPTX -> PDF/PNG rendering (see template-archive.ts).
# fonts-noto-cjk covers Vietnamese + most CJK so slide previews don't show tofu.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-impress \
      libreoffice-core \
      fonts-noto \
      fonts-noto-cjk \
      fonts-liberation \
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests + lockfile so pnpm can prune to prod deps.
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/pnpm-lock.yaml ./
COPY --from=build /repo/artifacts/api-server/package.json artifacts/api-server/
COPY --from=build /repo/lib/db/package.json lib/db/

# Bring built outputs.
COPY --from=build /repo/artifacts/api-server/dist artifacts/api-server/dist
COPY --from=build /repo/artifacts/2grils-ppt/dist artifacts/2grils-ppt/dist
COPY --from=build /repo/lib/db/dist lib/db/dist
COPY --from=build /repo/lib/db/src lib/db/src

# Production-only install (esbuild externalizes node-stream-zip / node-unrar-js /
# pdf-to-png-converter / pdfjs-dist — they must be installed at runtime).
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod \
      --filter @workspace/api-server \
      --filter @workspace/db

# Volume target — mounted from host so files survive container rebuilds.
RUN mkdir -p /app/artifacts/api-server/uploads
VOLUME ["/app/artifacts/api-server/uploads"]

ENV NODE_ENV=production
ENV API_PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/api/healthz || exit 1

# api-server's `start` script reads --env-file=../../.env; in container we
# inject env via docker-compose so we bypass --env-file.
CMD ["node", "--enable-source-maps", "/app/artifacts/api-server/dist/index.mjs"]
