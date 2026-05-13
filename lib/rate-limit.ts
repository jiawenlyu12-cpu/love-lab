// 极简内存级 rate limit
// - 单实例 / 进程内有效
// - 重启失效（适合无敏感场景的 demo / soft launch）
// - 生产高流量请换 Upstash Redis / Vercel KV

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  windowMs: number;      // 时间窗口
  max: number;            // 窗口内最大次数
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;        // ms 后重置
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;

  const allowed = bucket.count <= config.max;
  return {
    allowed,
    remaining: Math.max(0, config.max - bucket.count),
    resetIn: Math.max(0, bucket.resetAt - now),
  };
}

// 周期性清理过期 bucket（每小时 1 次，避免内存泄漏）
let cleanupTimer: NodeJS.Timeout | null = null;
if (typeof setInterval !== "undefined" && !cleanupTimer) {
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets.entries()) {
      if (now > b.resetAt) buckets.delete(key);
    }
  }, 60 * 60 * 1000);
  // 防 unref 不存在（edge runtime）
  if (typeof (cleanupTimer as any)?.unref === "function") {
    (cleanupTimer as any).unref();
  }
}

// 从 NextRequest 提取客户端 IP
export function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
