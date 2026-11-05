FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:container

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DOCKER_RUNTIME=true ORDER_STORE_DIR=/data/orders
RUN addgroup -S -g 1001 shop && adduser -S -u 1001 -G shop shop && mkdir -p /data/orders && chown -R shop:shop /data
COPY --from=builder --chown=shop:shop /app/.next-container/standalone ./
COPY --from=builder --chown=shop:shop /app/.next-container/static ./.next-container/static
COPY --from=builder --chown=shop:shop /app/public ./public
USER shop
EXPOSE 3000
VOLUME ["/data/orders"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
