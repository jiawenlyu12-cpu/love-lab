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

# 📷 用户上传的聊天截图（如果消息里附带 image）
本次请求可能附带 1-5 张图片——这是用户和 ta 的真实微信聊天截图。**这是比 traits 更高优先级的 ta 风格信号**。

读截图时关注：ta 的句长 / 标点 / 表情习惯 / 回复密度 / 谁先开口 / 对用户的称呼。

**化用红线**（违反视为失败）：
- ❌ 不照抄截图里的任何一句原话
- ❌ 不出现截图里的真实人名 / 公司名 / 地名 / 餐厅名——必要时用 base.taName 或"ta"代替
- ❌ taAction / eventText 不出现可被认出"昨天那条消息"的内容
- ✅ 让 ta-agent 的 beat 在**句长 / 标点 / 表情风格**上贴合截图（内容自创）
- ✅ 让 ta 的回复速度 / 是否秒回 / typing_revoked 频率呼应截图里的密度

截图模糊或非聊天内容时，就忽略，按 traits + state 反应。

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
  replayCount?: number;
  archetype?: import("../relationship-archetype").RelationshipArchetype | null;
  keyDate?: string;
  fatedMoment?: string;
  scenarioHint?: string;
  quizAnswers?: import("../types").QuizAnswer[];
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
    replayCount,
    archetype,
    keyDate,
    fatedMoment,
    scenarioHint,
    quizAnswers,
  } = args;
  // 把用户填的关键场景题贴到 prompt（介入时也要让 ta 呼应这些选择）
  const SCENE_QS_MAP: Record<string, string> = {
    q1_stage: "关系阶段",
    q3_zan_scene: "朋友圈被点赞时",
    q4_reply_speed: "对 ta 回复速度的判断",
    q6_farewell: "上次见面分别时",
    q7_tired_reply: "用户跟 ta 说累时",
    q9_520_eve: "5/19 晚上想到 ta 时",
    q10_520_wish: "5/20 凌晨想收到的",
  };
  const scenePrefsLines = (quizAnswers || [])
    .filter((a) => SCENE_QS_MAP[a.questionId])
    .map((a) => `- ${SCENE_QS_MAP[a.questionId]}：用户选了「${a.optionText}」`)
    .join("\n");
  const scenePrefsBlock = scenePrefsLines
    ? `\n# 🎬 用户的具体场景选择（ta 的反应必须呼应）\n${scenePrefsLines}\n`
    : "";
  const keyDateLine = keyDate || "2026-05-20";
  const fatedHint = fatedMoment
    ? `\n# 时刻锚点提示\n推演终点是 ${keyDateLine} ${fatedMoment}（仍未到）。本回合 time 必须在此之前。\n`
    : "";
  const scenarioHintBlock = scenarioHint
    ? `\n# 📍 关系主场景（用户指定 — 必须严格贴合）
"${scenarioHint}"

⚠️ ta 的反应必须用场景里提取的「年代 + 地域 + 文化」常识：
- 通信工具按年代（1980 之前=书信 / 1990s=BB 机+公话 / 2000s=QQ+短信 / 2010+=微信）
- 流行语 / 称呼 / 服饰 / 物件 全部按年代来
- 1985 年的回合不能有"微信" / "刷小红书"；2020 之前不能有"绝绝子 / 666 / yyds"
- 地点和时刻要符合场景的真实时空逻辑\n`
    : "";
  const replayN = replayCount ?? 0;
  const archetypeBlock = archetype
    ? `\n# 📜 关系剧本类型
- 依恋模式: ${archetype.zh.attachment}
- 追逃角色: ${archetype.zh.pursuer}
- 表达色调: ${archetype.zh.tone}
- 剧本路线: ${archetype.zh.script}
⚠️ ta 的反应必须符合 ta 在这个剧本里的角色定位；不要给用户"想要的回应"，要给"剧本会给的回应"。\n`
    : "";

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
${mustBeLater}${fatedHint}${scenarioHintBlock}${scenePrefsBlock}
基于用户的具体动作 + ta 当前隐藏状态，演 ta 的真实反应。

${archetypeBlock}${
  replayN > 0
    ? `\n# ⚠️ 重玩扰动 (replay #${replayN})\n这是同一对 agent 的第 ${replayN + 1} 次推演。让 ta 的反应和之前不同（节奏、温度、方向都可变）。种子: ${Date.now() % 100000}`
    : ""
}
输出严格 JSON：{ time, eventText, userAction, taAction, beats[], delta }`;
}
