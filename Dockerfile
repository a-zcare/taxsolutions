FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM build AS runtime
ENV NODE_ENV=production
RUN chown -R node:node /app/.next
USER node
EXPOSE 3000
CMD ["npm","start"]
