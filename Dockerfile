# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: install every dependency once, cached on the lockfile alone.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


# ---------------------------------------------------------------------------
# Stage 2: build the React app. Nothing from this stage but build/ survives.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS web

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY public ./public
COPY src ./src
COPY .eslintrc.json ./

ENV GENERATE_SOURCEMAP=false
RUN npm run build


# ---------------------------------------------------------------------------
# Stage 3: production dependencies only -- no react-scripts, no webpack, no
# test tooling in the shipped image.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS prod-deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


# ---------------------------------------------------------------------------
# Stage 4: runtime. One process serves the API and the built SPA.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3003 \
    STATIC_DIR=/app/build

WORKDIR /app

# Tini reaps zombies and forwards SIGTERM, so the graceful shutdown in
# server/index.js actually runs.
RUN apk add --no-cache tini

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=web /app/build ./build
COPY package.json ./
COPY server ./server

# node:alpine ships an unprivileged "node" user; run as it rather than root.
USER node

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||3003,path:'/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]
