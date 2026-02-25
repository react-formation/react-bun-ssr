# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.9 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run docs:build

FROM oven/bun:1.3.9 AS runtime
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Runtime needs framework/app/docs sources in addition to dist artifacts.
COPY --from=builder /app/dist ./dist
COPY framework ./framework
COPY app ./app
COPY docs ./docs
COPY bin ./bin
COPY rbssr.config.ts ./rbssr.config.ts

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "docs:preview"]
