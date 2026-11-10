# syntax=docker/dockerfile:1.7

# ---------- base ----------
FROM node:22-bookworm-slim AS base
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- deps (todas as dependências, inclusive dev) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------- migrator: cria/atualiza as tabelas e o cadastro inicial ----------
FROM deps AS migrator
COPY . .
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts"]

# ---------- build da aplicação ----------
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# AUTH_SECRET/DATABASE_URL não são necessários no build (páginas são dinâmicas)
RUN npm run build

# ---------- runtime enxuto ----------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
