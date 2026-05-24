# syntax=docker/dockerfile:1
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 複製 workspace 設定 & package.json (layer cache)
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile

# 複製原始碼
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["pnpm", "--filter", "@rps/server", "start"]
