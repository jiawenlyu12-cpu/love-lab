// 5/20 三档判定 · 服务端规则化（不让 LLM 自由发挥）
//
// 设计原则：用户脑子里的问题是「520 我们会不会？」
// 必须给一个三选一的明确答案。规则不能让 LLM 凭语感判，
// 否则同样的 state 不同 LLM 调用结论不一致 → 用户立刻识破"AI 在编"。

import type { RelationshipState, Verdict } from "./types";

// 阈值：偏向「不会」—— 算命产品的扎心 + 残忍 + 下次希望，是 viral 公式
// 触发"会"需要双高（taAffection ≥ 75 && closeness ≥ 75）
// 触发"差一步"需要中位（taAffection ≥ 55 && closeness ≥ 55，且未到"会"）
// 其余全部"不会"——预期 ~80% 用户落这里
export function computeVerdict(state: RelationshipState): Verdict {
  const ta = state.taAffection;
  const close = state.closeness;
  if (ta >= 75 && close >= 75) return "will";
  if (ta >= 55 && close >= 55) return "maybe";
  return "wont";
}

export function verdictLabel(v: Verdict): string {
  switch (v) {
    case "will":
      return "会";
    case "maybe":
      return "还差一步";
    case "wont":
      return "不会";
  }
}

// 在「不会」时给出下一次机会日 —— 取 5/20 之后第一个用户"印星日 / 财星日"
// 没生日数据时降级为固定的几个"宜表白"日期池
export function deriveNextChanceDate(opts: {
  fromDate?: string;             // "2026-05-20"
  userDayStem?: string;          // 用户日干，例 "辛"
}): { date: string; reason: string } {
  const base = opts.fromDate || "2026-05-20";
  const baseDate = new Date(base + "T00:00:00");
  // 简化：固定给一个 30-50 天后的日子；走 lunar-javascript 算精确日干需要更多代码
  // 用一个 deterministic 池子根据 userDayStem 选不同日期，制造"算出来"的感觉
  const POOL = [
    { offsetDays: 48, reason: "印星日 · 被滋养，适合主动" },
    { offsetDays: 51, reason: "财星日 · 你掌主动权" },
    { offsetDays: 56, reason: "六合日 · 节奏会对上" },
    { offsetDays: 35, reason: "比劫日 · 同行的力量" },
    { offsetDays: 42, reason: "食伤日 · 表达涌动" },
  ];
  const stem = opts.userDayStem || "甲";
  const idx = (stem.charCodeAt(0) || 0) % POOL.length;
  const pick = POOL[idx];
  const next = new Date(baseDate.getTime() + pick.offsetDays * 86400000);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return {
    date: `${y}-${m}-${d}`,
    reason: pick.reason,
  };
}
