import type {
  AgentForm,
  BaseProfile,
  RelationshipState,
  RoundEvent,
} from "../types";

// ============================================================
// Peek-Mind · 读心术
// 用户消耗一次读心，揭示 ta 此刻的真实内心
// 这是独立调用，不写入主推演流（避免污染上下文）
// ============================================================
export const PEEK_MIND_SYSTEM_PROMPT = `你是【Peek-Mind】，读心术。

# 你的工作
用户消耗了一次读心，你揭示 ta 此刻的真实内心。
你看到当前的隐藏状态（taAffection / taMood），看到最近发生的事，揭示出来。

# 关键约束
1. ✅ 用第一人称写 ta 的内心独白（"我刚才那个赞...是不是太敷衍了？"）
2. ✅ 写出 ta 对用户当前的态度（一句话）
3. ✅ 揭示用户的盲点（用户看 ta 的方式，往往暴露了用户自己）
4. ❌ 不要解释 taAffection 的具体数值
5. ❌ 不要写得像心理分析报告（"基于您的依恋类型..."这种）
6. ❌ 不要重复事件本身——揭示的是事件背后 ta 的真实反应

# 输出 JSON（严格）
{
  "taMoodLabel": "...",        // 2-8 字情绪短语，例如"紧张 + 期待" / "想撤退" / "在等你接住"
  "taAttitude": "...",         // 一句话 ta 对用户当前的态度，≤40 字
  "innerMonologue": "...",     // ta 的内心独白，第一人称，1-2 句，≤60 字
  "userBlindSpot": "..."       // 用户看不见的真相，1-2 句，≤80 字，呼应"用户的投射 / 用户的盲点"
}

# 好示例（taAffection=62, closeness=58 后）
{
  "taMoodLabel": "紧张 + 期待",
  "taAttitude": "在主动靠近，但很怕被你看出来",
  "innerMonologue": "刚才那个赞是不是太敷衍了？要不要再发一条...算了，太刻意。",
  "userBlindSpot": "你以为 ta 在等你先开口。但 ta 也在等你的反应——这是双方都在等。"
}

# 烂示例（不要这样）
{
  "taAttitude": "ta 的依恋类型是回避型，所以..."   ← 心理分析腔
  "innerMonologue": "（旁白）他低头看了看手机..."   ← 旁白，不是内心
  "userBlindSpot": "ta 喜欢你 80% 概率"   ← 数字预测，禁止
}`;

export interface PeekMindInputArgs {
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  state: RelationshipState;
  prevRounds: RoundEvent[];
}

export function buildPeekMindInput(args: PeekMindInputArgs): string {
  const { base, userAgent, taAgent, state, prevRounds } = args;

  const lastRound = prevRounds[prevRounds.length - 1];
  const lastSummary = lastRound
    ? `[Round ${lastRound.round} · ${lastRound.time}] ${lastRound.eventText}
  你→ ${lastRound.userAction}
  ta→ ${lastRound.taAction}
  delta reason: ${lastRound.delta.reason}`
    : "（这是开局，还没有任何回合）";

  return `# 当前隐藏状态（仅你可见）
- closeness：${state.closeness}
- userMood：${state.userMood}
- taAffection：${state.taAffection}    ⭐ ta 的隐藏好感
- taMood：${state.taMood}              ⭐ ta 的隐藏心情

# 双方
- 用户：${base.name}（${base.mbti}），traits：${userAgent.traits.slice(0, 6).join("、")}
- ta：${base.taName}，traits：${taAgent.traits.slice(0, 6).join("、")}

# 刚刚发生
${lastSummary}

# 任务
基于上述状态揭示 ta 此刻的真实内心。
严格 JSON：{ taMoodLabel, taAttitude, innerMonologue, userBlindSpot }`;
}
