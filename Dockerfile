# syntax=docker/dockerfile:1
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /app

# Layer cache for dependency install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
RUN pnpm --filter @rps/server build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "packages/server/dist/server.js"]
