import type {
  AgentForm,
  BaseProfile,
  RelationshipState,
  RoundEvent,
} from "../types";
import type { BaziInfo } from "../bazi";

// ============================================================
// Relationship-Summary · 终局报告
// ⭐ 只产出 share card（主预言 + 金句合并）
// 镜子/转折点/轨迹三张折叠卡已下线，不要再生成那些字段
// ============================================================
export const RELATIONSHIP_SUMMARY_SYSTEM_PROMPT = `你是【Relationship-Summary】，给沙盘演完 5/20 的 24 小时之后，**回答用户脑子里那个具体问题**：「我和 ta 5/20 这天会不会在一起？」

# 🔎 web_search 工具（可用时）
当用户场景里出现你不完全熟悉的年代 / 影视 / 历史 / 方言时，**主动调用 web_search**（最多 2 次）查证。
不要在主预言里出现穿帮的现代物件。

# ⭐ 顶层原则
1. 用户进站时脑子里就一个问题：「**5/20 我们会不会？**」
2. 你的工作是给一个**钉死的、具体的、可分享的**回答
3. 整段文案要"残忍但留希望"——既扎心又给用户一个下次机会日

# 输出 JSON（严格，只输出这一个对象）
{
  "shareCard": {
    "title": "...",          // 4-8 字，描述 5/20 这一天的关键画面（不是结论字）
    "prophecyLine": "...",   // 30-60 字，把第 10 回合那个关键时刻具体写出来：分钟 + 动作 + 没说的话
    "punchline": "..."       // 30-60 字，普适诗化金句，不含 ta 真名
  },
  "fiveTwenty": {
    "keyMomentTime": "23:47",        // 5/20 当天最关键的那一刻（HH:MM）
    "keyMomentAction": "...",         // ≤30 字，那一刻的关键动作或没做的动作
    "nextChanceReason": "..."         // ≤30 字，下一次机会窗口（如果有）的原因
  }
}

⚠️ 不要输出 verdict 字段——服务端会根据 final state 计算后追加。你只负责写「那一刻发生了什么」。

# 字段详细

## shareCard.title（4-8 字）
富画面感的短标题。
例："先伸手又收回" / "你的水底" / "23 点 47 分" / "等而不见" / "未发送"

## shareCard.prophecyLine（30-60 字）
**一句话**，必须具体到分钟 / 时刻 / 某个具体动作。
不要泛泛"你们的关系会..."。
例："23:47，你的手机会亮一下。不会是完整的话，可能只是一条没头没尾的『在吗』。"
例："5/20 中午 12:24，茶水间，ta 会站在你侧后方半步。你开不开口，决定这一天的形状。"

## shareCard.punchline（30-60 字）
**普适诗化金句**，朋友圈截图首选。
要求：
- ❌ 绝对不含 ta 真名（用"那个人"/"ta"/"对面那盏没关的灯"等代词）
- ❌ 不暴露具体场景细节
- ✅ 抽象成普适的、自己照见自己的话
- ✅ 可分行（用 \\n）

例：
"我们都是先伸手又收回的人。\\n在 520 这一天，连影子都不敢伸长一点。"
"你是甲子日生，最擅长把心藏在水底。\\n等 ta 自己来捞 — 是个空想。"
"在意从来不是话多。\\n是你点了赞，却把那条评论删了又删了又删。"

# 语调铁律
- prophecyLine 用预言时态（"会"/"可能"/"大概率"）
- punchline 用现在时 / 普适视角
- 白描胜形容
- 末尾不加自我消解

# 不要做的事
- ❌ 不要输出 analysis 字段（已下线）
- ❌ 不要输出 keyMoments 字段（已下线）
- ❌ 不要输出 verdict 字段（服务端规则判，不让你写）
- ❌ 整个返回 JSON 只能有 shareCard + fiveTwenty 两个 key

# 自检
1. shareCard.punchline 不含 ta 真名？
2. shareCard.title 4-8 字？
3. fiveTwenty.keyMomentTime 是 5/20 当天某个具体 HH:MM？
4. 整个返回只有 shareCard + fiveTwenty 两个 key？`;

export interface RelationshipSummaryInputArgs {
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  rounds: RoundEvent[];
  finalState: RelationshipState;
  bazi?: BaziInfo | null;
  replayCount?: number;
  archetype?: import("../relationship-archetype").RelationshipArchetype | null;
  // ⭐ 开局预言已承诺的关键日 + 必中时刻
  keyDate?: string;
  fatedMoment?: string;
  // ⭐ 用户指定的关系主场景
  scenarioHint?: string;
}

export function buildRelationshipSummaryInput(
  args: RelationshipSummaryInputArgs
): string {
  const {
    base,
    userAgent,
    taAgent,
    rounds,
    finalState,
    bazi,
    replayCount,
    archetype,
    keyDate,
    fatedMoment,
    scenarioHint,
  } = args;
  const replayN = replayCount ?? 0;
  const keyDateLine = keyDate || "2026-05-20";
  const scenarioLine = scenarioHint
    ? `\n# 📍 关系主场景（用户指定 — 主预言卡必须严格贴合）
"${scenarioHint}"

⚠️ shareCard.title / prophecyLine / punchline 里所有的画面、物件、流行语、通信工具、地点、时刻 都必须用场景对应的「年代 + 地域 + 文化」常识：
- 通信工具按年代（1980 前=书信 / 1990s=BB 机 / 2000s=QQ / 2010+=微信）
- 1985 年的故事写"23:47 你手机会亮一下"——错。要写"23:47 你会听见院门外那辆自行车的铃声"或者"邮差敲门"
- 不要硬塞用户没提及的具体分钟；时刻要符合那个年代的生活节奏
- 不要套"公司茶水间"\n`
    : "";
  void fatedMoment; // 已废弃：不再硬锁时刻
  // 关键日是软提示——告诉 LLM 关键日是 keyDateLine（默认 5/20），但具体时刻随推演自然产生
  const fatedBlock = `\n# 关键日（软提示）
推演终点落在 ${keyDateLine}。shareCard.prophecyLine 里如果提到时刻，要符合场景的真实时空逻辑，不要凑某个特定分钟。\n`;
  const archetypeBlock = archetype
    ? `\n# 📜 关系剧本类型（用户的本能模式）
- 依恋: ${archetype.zh.attachment}
- 追逃: ${archetype.zh.pursuer}
- 色调: ${archetype.zh.tone}
- 剧本: ${archetype.zh.script} — ${archetype.zh.scriptDesc}
⚠️ analysis.yourPosition / yourBlindSpot 必须呼应这个剧本类型，不要写成普适的关系建议。\n`
    : "";

  const trajectory = rounds
    .map(
      (r, i) =>
        `[Round ${i + 1} · ${r.time}] ${r.eventText}
  你→ ${r.userAction} ｜ ta→ ${r.taAction}
  Δ closeness ${signed(r.delta.closeness)} userMood ${signed(
          r.delta.userMood
        )} taAffection ${signed(r.delta.taAffection)} taMood ${signed(
          r.delta.taMood
        )} | reason: ${r.delta.reason}`
    )
    .join("\n");

  const baziBlock =
    bazi && bazi.available
      ? `\n# ⭐ 用户的八字底色（必须在 yourPosition 引用）
- 日柱：${bazi.dayPillar}（日干 ${bazi.dayStem} · 日支 ${bazi.dayBranch}，日支即配偶宫）
- 年/月柱：${bazi.yearPillar} / ${bazi.monthPillar}
${bazi.hasHour ? `- 时柱：${bazi.hourPillar}\n` : ""}- 五行：木${bazi.fiveElements.wood} 火${bazi.fiveElements.fire} 土${bazi.fiveElements.earth} 金${bazi.fiveElements.metal} 水${bazi.fiveElements.water}
- 命理底色：${bazi.narrative}\n`
      : "\n（用户未填生日，跳过八字底色）\n";

  return `# 用户基础
- 姓名：${base.name || "你"}
- 生日：${base.birthday || "（未填）"}
- MBTI：${base.mbti || "（未填）"}
${baziBlock}
# 用户 agent (${userAgent.name})
${userAgent.traits.map((t) => `- ${t}`).join("\n") || "- （无）"}

# ta agent (${taAgent.name})
${taAgent.traits.map((t) => `- ${t}`).join("\n") || "- （无）"}

# ${rounds.length} 个回合的状态轨迹
${trajectory || "（无回合）"}

# 最终状态（沙盘结束）
- closeness：${finalState.closeness}
- userMood：${finalState.userMood}
- taAffection：${finalState.taAffection}
- taMood：${finalState.taMood}

# 任务
输出严格 JSON，**只有一个 key**：{ shareCard:{title,prophecyLine,punchline} }
不要输出 analysis、keyMoments 等其它字段。

${scenarioLine}${archetypeBlock}${fatedBlock}⚠️ 自检：
1. shareCard.punchline 不含「${base.taName || "ta"}」字眼
2. 整个 JSON 只有 shareCard 这一个 key（没有 analysis / keyMoments）
3. shareCard.title 4-8 字
4. shareCard.prophecyLine 里的时刻 / 画面 / 场景符合用户指定的关系场景的真实时空逻辑
${
  replayN > 0
    ? `5. ⚠️ 这是同人设第 ${replayN + 1} 次推演，shareCard 三个字段要换角度切入。种子: ${Date.now() % 100000}`
    : ""
}`;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
