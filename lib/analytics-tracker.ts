// 轻量埋点 · 服务端 · Netlify Blobs 计数
//
// Storage keys (analytics store):
//   event:<name>:<YYYY-MM-DD>   → integer counter
//   event:<name>:total          → integer counter
//   pv:<path>:<YYYY-MM-DD>      → integer counter
//   visitors:<YYYY-MM-DD>       → CSV of visitorIds (deduped)
//   visitors:all                → CSV of all-time visitorIds
//
// 注意：Blobs 的 set 没有原子递增，并发会丢一些。对单机量级的产品够用；
// 真要严丝合缝再上 PostHog。

import { getStore } from "@netlify/blobs";

const STORE_NAME = "analytics";
const MAX_VISITORS_PER_DAY_INLINE = 5000; // 防止单 key 过大

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeStore() {
  try {
    return getStore({ name: STORE_NAME, consistency: "strong" });
  } catch (e: any) {
    console.error("[analytics] getStore failed:", e?.message || e);
    return null;
  }
}

async function bumpCounter(
  store: ReturnType<typeof safeStore>,
  key: string
): Promise<void> {
  if (!store) return;
  try {
    const raw = (await store.get(key, { type: "text" })) as string | null;
    const next = (parseInt(raw || "0", 10) || 0) + 1;
    await store.set(key, String(next));
  } catch (e: any) {
    console.error(`[analytics] bump ${key} failed:`, e?.message || e);
  }
}

async function addToCsvSet(
  store: ReturnType<typeof safeStore>,
  key: string,
  value: string,
  capItems = MAX_VISITORS_PER_DAY_INLINE
): Promise<void> {
  if (!store || !value) return;
  try {
    const raw = (await store.get(key, { type: "text" })) as string | null;
    const set = new Set(raw ? raw.split(",").filter(Boolean) : []);
    if (set.has(value)) return;
    set.add(value);
    // 防止 key 过大
    const arr = [...set];
    const trimmed = arr.length > capItems ? arr.slice(-capItems) : arr;
    await store.set(key, trimmed.join(","));
  } catch (e: any) {
    console.error(`[analytics] csv-set ${key} failed:`, e?.message || e);
  }
}

export interface TrackInput {
  event: string;
  visitorId?: string;
  path?: string;
  props?: Record<string, any>;
}

export async function recordEvent(input: TrackInput): Promise<void> {
  const store = safeStore();
  if (!store) return;
  const today = todayKey();
  const event = (input.event || "").slice(0, 64).replace(/[^a-zA-Z0-9_]/g, "_");
  if (!event) return;

  await Promise.all([
    bumpCounter(store, `event:${event}:${today}`),
    bumpCounter(store, `event:${event}:total`),
    input.path
      ? bumpCounter(store, `pv:${input.path.slice(0, 64)}:${today}`)
      : Promise.resolve(),
    input.visitorId
      ? Promise.all([
          addToCsvSet(store, `visitors:${today}`, input.visitorId),
          addToCsvSet(store, "visitors:all", input.visitorId, 100_000),
        ])
      : Promise.resolve(),
  ]);
}

export interface StatsSummary {
  today: string;
  events: {
    today: Record<string, number>;
    total: Record<string, number>;
  };
  pageviews: {
    today: Record<string, number>;
  };
  visitors: {
    today: number;
    last7d: number;
    allTime: number;
  };
}

// 已知事件名 + 已知页面路径（一次性查询，比 list() 稳）
const KNOWN_EVENTS = [
  "pageview",
  "setup_started",
  "setup_completed",
  "builder_started",
  "builder_q_answered",
  "builder_completed",
  "simulator_opened",
  "prophecy_viewed",
  "scenario_picked",
  "round_advance",
  "round_reroll",
  "intervene_submit",
  "peek_used",
  "final_summary_view",
  "agent_saved",
  "agent_loaded",
];

const KNOWN_PATHS = [
  "/",
  "/setup",
  "/builder",
  "/simulator",
  "/report",
  "/agents",
  "/admin/stats",
  "/legal/privacy",
  "/legal/terms",
];

async function readInt(
  store: ReturnType<typeof safeStore>,
  key: string
): Promise<number> {
  if (!store) return 0;
  try {
    const raw = (await store.get(key, { type: "text" })) as string | null;
    return parseInt(raw || "0", 10) || 0;
  } catch {
    return 0;
  }
}

async function readCsvCount(
  store: ReturnType<typeof safeStore>,
  key: string
): Promise<number> {
  if (!store) return 0;
  try {
    const raw = (await store.get(key, { type: "text" })) as string | null;
    if (!raw) return 0;
    return raw.split(",").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

export async function getStats(): Promise<StatsSummary> {
  const store = safeStore();
  const today = todayKey();
  const summary: StatsSummary = {
    today,
    events: { today: {}, total: {} },
    pageviews: { today: {} },
    visitors: { today: 0, last7d: 0, allTime: 0 },
  };
  if (!store) return summary;

  await Promise.all([
    ...KNOWN_EVENTS.map(async (name) => {
      const [todayCount, totalCount] = await Promise.all([
        readInt(store, `event:${name}:${today}`),
        readInt(store, `event:${name}:total`),
      ]);
      if (todayCount > 0) summary.events.today[name] = todayCount;
      if (totalCount > 0) summary.events.total[name] = totalCount;
    }),
    ...KNOWN_PATHS.map(async (path) => {
      const v = await readInt(store, `pv:${path}:${today}`);
      if (v > 0) summary.pageviews.today[path] = v;
    }),
  ]);

  // visitors
  const last7 = lastNDates(7);
  const last7Counts = await Promise.all(
    last7.map((d) => readCsvSet(store, `visitors:${d}`))
  );
  // 7 日合并去重
  const union = new Set<string>();
  for (const s of last7Counts) for (const v of s) union.add(v);
  summary.visitors.last7d = union.size;
  summary.visitors.today = last7Counts[0]?.size || 0;
  summary.visitors.allTime = await readCsvCount(store, "visitors:all");

  return summary;
}

async function readCsvSet(
  store: ReturnType<typeof safeStore>,
  key: string
): Promise<Set<string>> {
  if (!store) return new Set();
  try {
    const raw = (await store.get(key, { type: "text" })) as string | null;
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  } catch {
    return new Set();
  }
}
