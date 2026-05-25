# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Layer cache for dependency install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
RUN pnpm install --frozen-lockfile

# Build server artifact
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
RUN pnpm --filter @rps/server build

FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install production-only server dependencies
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
RUN pnpm install --prod --frozen-lockfile --filter @rps/server...

# Copy built output only
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/server/dist ./packages/server/dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "packages/server/dist/server.js"]
