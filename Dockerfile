# 多阶段构建，最终镜像 ~150MB
# 适用：腾讯云轻量应用服务器 / 阿里云 ECS / 自建 VPS

# ============== 1) 依赖层 ==============
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile --no-audit --no-fund

# ============== 2) 构建层 ==============
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js standalone output 模式（最小化运行时依赖）
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============== 3) 运行层 ==============
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
