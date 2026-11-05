FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
FROM base AS build
COPY package*.json ./
RUN npm ci --no-fund --no-audit
COPY . .
ENV NEXT_STANDALONE=true
RUN npm run build && npm run build:worker
FROM base AS production-deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-fund --no-audit
FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd -g 10001 app && useradd -u 10001 -g app -M app
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/.next/cache && chown -R app:app /app/.next/cache
USER app
EXPOSE 3000
CMD ["node","server.js"]
