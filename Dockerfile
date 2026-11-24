# syntax=docker/dockerfile:1

FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY server.ts ./
COPY shared ./shared
COPY packages ./packages
COPY backend ./backend
COPY web-app ./web-app
COPY prompts ./prompts
COPY dataset ./dataset
COPY firebase-applet-config.json ./

ARG VITE_TURNSTILE_SITE_KEY=""
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}

RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server.ts ./
COPY shared ./shared
COPY packages ./packages
COPY backend ./backend
COPY prompts ./prompts
COPY dataset ./dataset
COPY firebase-applet-config.json ./

RUN chown -R node:node /app
USER node

EXPOSE 8080
CMD ["node", "server.ts"]
