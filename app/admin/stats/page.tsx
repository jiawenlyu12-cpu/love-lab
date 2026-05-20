"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

interface Stats {
  today: string;
  events: { today: Record<string, number>; total: Record<string, number> };
  pageviews: { today: Record<string, number> };
  visitors: { today: number; last7d: number; allTime: number };
}

// 事件中文标签 + 分组
interface EventGroup {
  title: string;
  emoji: string;
  events: Array<{ key: string; label: string; hint?: string }>;
}

const FUNNEL: EventGroup[] = [
  {
    title: "入 口 漏 斗",
    emoji: "🚪",
    events: [
      { key: "pageview", label: "页面浏览", hint: "全站所有页面 PV 累加" },
      { key: "setup_started", label: "进入资料填写", hint: "/setup 加载" },
      { key: "setup_completed", label: "完成资料填写", hint: "点了「下一步：捏 agent」" },
      { key: "builder_started", label: "进入捏 agent", hint: "/builder 加载" },
      { key: "builder_q_answered", label: "答题次数（累计）", hint: "12 题中每答一道 +1" },
      { key: "builder_completed", label: "完成 12 道题", hint: "点了「开始推演」" },
    ],
  },
  {
    title: "沙 盘 推 演",
    emoji: "🎲",
    events: [
      { key: "simulator_opened", label: "进入沙盘", hint: "/simulator 加载" },
      { key: "prophecy_viewed", label: "看到开局预言", hint: "首屏命盘速览展示" },
      { key: "scenario_picked", label: "选择关系主场景", hint: "选了 chip / 自定义场景" },
      { key: "round_advance", label: "推进时间", hint: "每点一次「翻开 / 推进」+1" },
      { key: "intervene_submit", label: "介入", hint: "用户写了一句给 ta" },
      { key: "peek_used", label: "读心", hint: "消耗一次读心额度" },
      { key: "round_reroll", label: "重玩本回合", hint: "撤销最后一回合" },
    ],
  },
  {
    title: "终 局 & 人 设 库",
    emoji: "🪄",
    events: [
      { key: "final_summary_view", label: "看主预言", hint: "/report 加载（10 回合走完）" },
      { key: "agent_saved", label: "保存人设", hint: "完成 12 题自动入库" },
      { key: "agent_loaded", label: "从人设库载入", hint: "/agents 选了一套老人设" },
    ],
  },
];

// 中文页面名映射
const PATH_LABEL: Record<string, string> = {
  "/": "首页",
  "/setup": "Step 1 · 资料填写",
  "/builder": "Step 2 · 捏 agent",
  "/simulator": "Step 3 · 关系沙盘",
  "/report": "终局 · 主预言",
  "/agents": "人设库",
  "/admin/stats": "管理后台",
  "/legal/privacy": "隐私声明",
  "/legal/terms": "用户协议",
};

// 关键转化率
function computeConversions(events: Record<string, number>) {
  const n = (k: string) => events[k] || 0;
  function rate(a: string, b: string): { pct: number; a: number; b: number } {
    const A = n(a);
    const B = n(b);
    return { pct: A > 0 ? Math.round((B / A) * 100) : 0, a: A, b: B };
  }
  return {
    setupToSubmit: rate("setup_started", "setup_completed"),
    builderComplete: rate("builder_started", "builder_completed"),
    enterSimulator: rate("builder_completed", "simulator_opened"),
    seeFinal: rate("simulator_opened", "final_summary_view"),
    avgRounds: (() => {
      const sim = n("simulator_opened");
      const adv = n("round_advance");
      return sim > 0 ? (adv / sim).toFixed(1) : "0";
    })(),
  };
}

export default function AdminStatsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100svh] px-5 py-8 text-rose-200/55">
          加载中…
        </main>
      }
    >
      <StatsView />
    </Suspense>
  );
}

function StatsView() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!token) {
      setErr("缺少 ?token=xxx");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/stats?token=${encodeURIComponent(token)}`);
      if (r.status === 401) {
        setErr("token 错误，或服务端未配置 ADMIN_TOKEN");
        return;
      }
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      setStats((await r.json()) as Stats);
    } catch (e: any) {
      setErr(e?.message || "请求失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [token]);

  return (
    <main className="min-h-[100svh] px-4 sm:px-6 py-6 sm:py-10 max-w-3xl mx-auto text-rose-100">
      <header className="flex items-baseline justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="font-serif-cn text-2xl sm:text-3xl text-rose-100">
            数 据 看 板
          </h1>
          <p className="text-rose-200/55 text-[11px] tracking-wider mt-1">
            命盘恋语 · AI Love-Lab
            {stats && <span className="ml-3 tabular-nums">{stats.today}</span>}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-rose-300 text-sm border border-rose-300/30 rounded-full px-3.5 py-1.5 hover:bg-rose-300/10 active:scale-95 transition"
        >
          {loading ? "刷新中…" : "↻ 刷新"}
        </button>
      </header>

      {err && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/5 text-red-200 text-sm px-4 py-3 mb-6">
          {err}
        </div>
      )}

      {stats && (
        <div className="space-y-5">
          {/* === 访客 === */}
          <Section emoji="👤" title="访 客">
            <div className="grid grid-cols-3 gap-3">
              <BigStat label="今日访客" v={stats.visitors.today} accent />
              <BigStat label="近 7 日" v={stats.visitors.last7d} />
              <BigStat label="累计访客" v={stats.visitors.allTime} />
            </div>
            <p className="text-rose-200/40 text-[10.5px] mt-3 leading-snug">
              一个浏览器 = 一个匿名访客（清缓存 / 无痕窗口 / 换设备会重新计入）
            </p>
          </Section>

          {/* === 关键转化率 === */}
          <Section emoji="📈" title="关 键 转 化 率（累计）">
            <Conversions events={stats.events.total} />
          </Section>

          {/* === 分组漏斗 === */}
          {FUNNEL.map((group) => (
            <Section key={group.title} emoji={group.emoji} title={group.title}>
              <FunnelTable
                events={group.events}
                today={stats.events.today}
                total={stats.events.total}
              />
            </Section>
          ))}

          {/* === 各页面浏览 === */}
          <Section emoji="📄" title="各 页 面 浏 览（今日）">
            <PathTable
              today={stats.pageviews.today}
              labels={PATH_LABEL}
            />
          </Section>

          <p className="text-rose-200/35 text-[11px] text-center pt-2">
            数据存于 Netlify Blobs · 无第三方上报 · 实时拉取
          </p>
        </div>
      )}
    </main>
  );
}

// ============ 子组件 ============

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-rose-300/15 bg-white/[0.02] px-4 sm:px-5 py-4">
      <div className="flex items-center gap-2 text-rose-200/65 text-[10.5px] tracking-[0.3em] mb-3">
        <span className="text-[14px]">{emoji}</span>
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function BigStat({
  label,
  v,
  accent,
}: {
  label: string;
  v: number;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={
          accent
            ? "font-serif-cn text-rose-200 text-3xl tabular-nums"
            : "font-serif-cn text-rose-100/85 text-2xl tabular-nums"
        }
      >
        {v}
      </div>
      <div className="text-rose-200/55 text-[10.5px] tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}

function FunnelTable({
  events,
  today,
  total,
}: {
  events: Array<{ key: string; label: string; hint?: string }>;
  today: Record<string, number>;
  total: Record<string, number>;
}) {
  // 该组内 today 最大值 — 用于绘制柱形宽度
  const maxToday = Math.max(...events.map((e) => today[e.key] || 0), 1);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-rose-200/40 text-[10px] tracking-wider px-1">
        <span>事 件</span>
        <span className="w-12 text-right">今日</span>
        <span className="w-12 text-right">累计</span>
      </div>
      {events.map((e) => {
        const t = today[e.key] || 0;
        const tot = total[e.key] || 0;
        const pct = (t / maxToday) * 100;
        return (
          <div key={e.key} className="group">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
              <div className="min-w-0">
                <div className="text-rose-100 text-[13px] truncate">
                  {e.label}
                </div>
                {e.hint && (
                  <div className="text-rose-200/40 text-[10px] truncate">
                    {e.hint}
                  </div>
                )}
              </div>
              <span className="text-rose-100 text-[13.5px] tabular-nums w-12 text-right font-medium">
                {t}
              </span>
              <span className="text-rose-200/55 text-[11.5px] tabular-nums w-12 text-right">
                {tot}
              </span>
            </div>
            <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-300/80 to-rose-400/80 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Conversions({ events }: { events: Record<string, number> }) {
  const c = computeConversions(events);
  const items: Array<{ label: string; pct: number; sub: string }> = [
    {
      label: "资料填写 → 提交",
      pct: c.setupToSubmit.pct,
      sub: `${c.setupToSubmit.b} / ${c.setupToSubmit.a}`,
    },
    {
      label: "捏 agent 通关",
      pct: c.builderComplete.pct,
      sub: `${c.builderComplete.b} / ${c.builderComplete.a}`,
    },
    {
      label: "完成 → 进沙盘",
      pct: c.enterSimulator.pct,
      sub: `${c.enterSimulator.b} / ${c.enterSimulator.a}`,
    },
    {
      label: "沙盘 → 主预言",
      pct: c.seeFinal.pct,
      sub: `${c.seeFinal.b} / ${c.seeFinal.a}`,
    },
  ];
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-xl border border-rose-300/12 bg-white/[0.02] px-3 py-2.5 text-center"
          >
            <div
              className={
                "font-serif-cn text-2xl tabular-nums " +
                (it.pct >= 50
                  ? "text-emerald-200"
                  : it.pct >= 20
                  ? "text-rose-200"
                  : "text-orange-300")
              }
            >
              {it.pct}%
            </div>
            <div className="text-rose-200/65 text-[10.5px] mt-0.5 leading-tight">
              {it.label}
            </div>
            <div className="text-rose-200/35 text-[9.5px] tabular-nums mt-0.5">
              {it.sub}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-rose-300/10 flex items-baseline justify-between">
        <span className="text-rose-200/65 text-[12px]">
          人均推演回合数
          <span className="text-rose-200/35 text-[10px] ml-2">
            （round_advance / simulator_opened）
          </span>
        </span>
        <span className="font-serif-cn text-rose-100 text-xl tabular-nums">
          {c.avgRounds}
        </span>
      </div>
    </>
  );
}

function PathTable({
  today,
  labels,
}: {
  today: Record<string, number>;
  labels: Record<string, string>;
}) {
  const rows = Object.entries(today).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) {
    return (
      <p className="text-rose-200/45 text-[11px]">（今日还没有数据）</p>
    );
  }
  const max = Math.max(...rows.map(([, v]) => v), 1);
  return (
    <div className="space-y-2">
      {rows.map(([path, count]) => {
        const pct = (count / max) * 100;
        return (
          <div key={path}>
            <div className="flex items-baseline justify-between">
              <div className="min-w-0 flex-1 pr-3">
                <div className="text-rose-100 text-[12.5px] truncate">
                  {labels[path] || path}
                </div>
                <div className="text-rose-200/40 text-[10px] truncate font-mono">
                  {path}
                </div>
              </div>
              <span className="text-rose-100 text-[13px] tabular-nums">
                {count}
              </span>
            </div>
            <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-300/60 to-cyan-300/60"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
