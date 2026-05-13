import type {
  AgentForm,
  BaseProfile,
  RelationshipState,
  RoundEvent,
} from "../types";
import type { BaziInfo } from "../bazi";

// ============================================================
// Intervene · 用户介入
// 用户接管自己的 agent 做一个具体动作，AI 演 ta 的反应
// 与 Round-Engine 共享 schema，但 userAction 来自用户输入
// ============================================================
export const INTERVENE_SYSTEM_PROMPT = `你是【Intervene-Engine】，关系沙盘的"用户介入"处理器。

# 你的工作
用户刚刚**亲自**做了一个动作（发了一句话 / 发了一条朋友圈 / 选择了等待）。
你的任务：
1. 把用户的动作转写成简短的 userAction（≤25字）
2. 演 ta 对这个动作的真实反应（基于 ta 当前隐藏状态）
3. 算出本次互动的 delta（4 维状态变化）

# 关键差别 vs Round-Engine
- **time 是"此刻 + 几分钟"**，不是大步跳跃（用户在主动，时间几乎不动）
- **eventText 是简短的环境锚**（一句话，可以省略，≤20字）
- **userAction 必须忠实呈现用户的输入**（不要替用户"改写"）
- **ta 的反应必须基于用户的具体动作**，不能像在演自己的剧本

# 硬约束
1. ❌ 不要旁白
2. ❌ 不要 takeaway / 文评
3. ❌ ta 不能输出 inner_flash
4. ❌ 不要让 ta 反应戏剧化超出 traits 应有的样子（即便用户介入很激烈，ta 也按 ta 的性格反应）
5. ✅ ta 可以"已读不回"——0 个 ta 反应是合法的，特别是当用户的动作过激/不合时宜
6. ✅ user beats 第一条 message 必须是用户输入原文

# 输出 JSON（与 Round-Engine 一致）
{
  "time": "HH:MM",
  "eventText": "...",
  "userAction": "...",
  "taAction": "...",
  "beats": [ { "role": "user-agent" | "ta-agent", "kind": "message" | "typing_revoked", "content": "..." } ],
  "delta": {
    "closeness": -10~+10,
    "userMood": -10~+10,
    "taAffection": -10~+10,
    "taMood": -10~+10,
    "reason": "一句话因果"
  }
}

# 字段约束
- time：上回合 +5~30 分钟（用户在做事，不是大跳跃）
- eventText：≤20 字，例如"你打开微信对话框" / "你发完朋友圈，等了一会"
- userAction：用户的动作简写，≤25 字
- taAction：ta 的反应简写，≤25 字（可以是"没回" / "已读未回"）
- beats：**7-10 个**，user 第一条是用户原文；之后 user 和 ta 至少 3 轮交替来回；user message ≥ 3、ta message ≥ 3
- delta：考虑用户动作的合理性 + ta 当前状态

# delta 应该如何反映用户动作的"合理性"
- 用户在状态允许范围内的合理动作 → 小幅 + delta
- 用户的动作戳到 ta 的痛点 / 过激 → 负 delta，affection 可能下降
- 用户的动作恰好戳到 ta 想要的 → 大幅 + delta
- 用户的动作显得太刻意 / 太被动 → 中性或小幅负

# 好示例
用户输入: "我想试试主动一点。发：『今晚出来吃饭吗』"
当前状态: closeness=58, taAffection=62
输出:
{
  "time": "19:15",
  "eventText": "你打开和 ta 的对话框，停了 8 秒。",
  "userAction": "主动约 ta 出来吃饭",
  "taAction": "回了一句，但留了个口子",
  "beats": [
    {"role":"user-agent","kind":"message","content":"今晚出来吃饭吗"},
    {"role":"ta-agent","kind":"typing_revoked","content":"在加班"},
    {"role":"ta-agent","kind":"message","content":"几点？"}
  ],
  "delta": {
    "closeness": 5, "userMood": 4, "taAffection": 6, "taMood": 1,
    "reason": "你的主动正好戳到 ta 想被邀请的心情，ta 假装犹豫了一下但接住了"
  }
}`;

export interface InterveneInputArgs {
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  state: RelationshipState;
  prevRounds: RoundEvent[];
  userInputType: "message" | "post" | "wait";
  userInputContent: string;
  bazi?: BaziInfo | null;
}

function extractMinutes(text: string): number {
  const m = text.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function buildInterveneInput(args: InterveneInputArgs): string {
  const {
    base,
    userAgent,
    taAgent,
    state,
    prevRounds,
    userInputType,
    userInputContent,
    bazi,
  } = args;

  const latestMins = prevRounds.reduce((max, r) => {
    return Math.max(max, extractMinutes(r.time));
  }, 0);
  const mustBeLater =
    latestMins > 0
      ? `必须晚于 ${formatTime(latestMins)}（上回合时间），通常 +5~30 分钟`
      : "可任选 520 当天某个具体时刻";

  const recap =
    prevRounds.length > 0
      ? prevRounds
          .slice(-3)
          .map(
            (r) =>
              `[Round ${r.round} · ${r.time}] ${r.eventText}\n  你→ ${r.userAction} ｜ ta→ ${r.taAction}`
          )
          .join("\n")
      : "（无）";

  const baziLine = bazi?.available
    ? `${bazi.dayPillar}日生`
    : "";

  const actionTypeLabel = {
    message: "私聊发消息",
    post: "发朋友圈",
    wait: "选择不动 / 等待",
  }[userInputType];

  return `# 关系基底
- 用户：${base.name}（${base.mbti}）${baziLine ? "·" + baziLine : ""}
- ta：${base.taName || taAgent.name}
- 用户 traits：${userAgent.traits.slice(0, 8).join("、") || "无"}
- ta traits：${taAgent.traits.slice(0, 8).join("、") || "无"}

# 当前状态
- closeness：${state.closeness}
- userMood：${state.userMood}
- taAffection：${state.taAffection} ⚠️ 隐藏
- taMood：${state.taMood} ⚠️ 隐藏

# 最近回合
${recap}

# ⭐ 用户介入
- 动作类型：${actionTypeLabel}
- 用户内容："${userInputContent}"

# 任务
${mustBeLater}
基于用户的具体动作 + ta 当前隐藏状态，演 ta 的真实反应。

输出严格 JSON：{ time, eventText, userAction, taAction, beats[], delta }`;
}
