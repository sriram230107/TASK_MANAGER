# ---- build stage ----------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
# Windows checkouts can turn shell scripts into CRLF, which breaks them on Linux.
RUN sed -i 's/\r$//' docker/entrypoint.sh
# prisma.config.ts reads DATABASE_URL even for `generate`; this placeholder is never used to connect.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
    && npm run build

# ---- runtime stage ----------------------------------------------------------
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*
# Dev dependencies are kept on purpose: the Prisma CLI (migrations) and tsx (bootstrap script) are needed at runtime.
COPY --from=build /app /app
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["sh", "docker/entrypoint.sh"]
