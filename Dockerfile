# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# 先複製 package*.json 拿到 layer cache
COPY package*.json ./
RUN npm ci --omit=dev

# 複製其他原始碼
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
