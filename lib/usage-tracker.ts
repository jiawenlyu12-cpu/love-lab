// LLM 调用计数 + 阈值告警
// - 计数存 Netlify Blobs（持久化，跨函数实例）
// - 月度 key：count:2026-05 / count:2026-06 ...
// - 跨阈值时输出 console.warn，可在 netlify logs 里 grep

import { getStore } from "@netlify/blobs";

// 估算的月度推演容量上限（基于 $100 Netlify AI credits ÷ Claude 4.5 Haiku 单次成本）
// 可通过 LLM_MONTHLY_LIMIT env 调整
const MONTHLY_LIMIT = parseInt(process.env.LLM_MONTHLY_LIMIT || "580", 10);
const THRESHOLDS = [0.5, 0.8, 0.95] as const;
const CIRCUIT_BREAKER_PCT = 0.95;

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function safeStore() {
  try {
    return getStore({ name: "usage", consistency: "strong" });
  } catch (e: any) {
    console.error("[usage] getStore failed:", e?.message || e);
    return null;
  }
}

export async function incrementLLMCount(): Promise<number> {
  const store = safeStore();
  if (!store) return 0;
  const key = `count:${monthKey()}`;
  let current = 0;
  try {
    const raw = await store.get(key, { type: "text" });
    current = parseInt((raw as string | null) || "0", 10) || 0;
  } catch (e: any) {
    console.error("[usage] blob get failed:", e?.message || e);
  }
  const next = current + 1;
  try {
    await store.set(key, String(next));
    console.log(`[usage] count=${next}/${MONTHLY_LIMIT}`);
  } catch (e: any) {
    console.error("[usage] blob set failed:", e?.message || e);
  }

  // 阈值检测：跨越某档时 warn
  const beforePct = current / MONTHLY_LIMIT;
  const afterPct = next / MONTHLY_LIMIT;
  for (const t of THRESHOLDS) {
    if (beforePct < t && afterPct >= t) {
      console.warn(
        `⚠️ [usage] crossed ${Math.round(t * 100)}% — ${next}/${MONTHLY_LIMIT} LLM calls this month`
      );
    }
  }
  return next;
}

export async function getUsageStats() {
  const store = safeStore();
  if (!store) {
    return { month: monthKey(), count: 0, limit: MONTHLY_LIMIT, pct: 0, fallback: true };
  }
  let count = 0;
  try {
    const raw = await store.get(`count:${monthKey()}`, { type: "text" });
    count = parseInt((raw as string | null) || "0", 10) || 0;
  } catch (e: any) {
    console.error("[usage] stats get failed:", e?.message || e);
  }
  return {
    month: monthKey(),
    count,
    limit: MONTHLY_LIMIT,
    pct: Math.round((count / MONTHLY_LIMIT) * 100),
  };
}

// 是否应该熔断到 mock（用量已超 95%）
export async function shouldCircuitBreak(): Promise<boolean> {
  const { pct } = await getUsageStats();
  return pct >= CIRCUIT_BREAKER_PCT * 100;
}
