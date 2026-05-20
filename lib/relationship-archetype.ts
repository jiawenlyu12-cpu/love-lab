// ============================================================
// Relationship Archetype · 从 12 题答卷规则化推导 4 个剧本标签
//
// 设计目的：把"自由发挥的 LLM"降级为"按剧本演的 LLM"——
// 不同 archetype → 不同的"必经节拍"，让推演有结构感、不发散
//
// 4 个维度：
//   - attachmentType: 依恋类型（焦虑 / 回避 / 安全 / 紊乱）
//   - pursuerRole:    追逃角色（追 / 逃 / 平衡 / 卡住）
//   - toneStyle:      表达风格（直接 / 暧昧 / 收着）
//   - scriptId:       剧本路线（决定回合节拍）
// ============================================================

import type { QuizAnswer } from "./types";

export type AttachmentType = "anxious" | "avoidant" | "secure" | "disorganized";
export type PursuerRole = "chaser" | "runner" | "balanced" | "stuck";
export type ToneStyle = "direct" | "ambiguous" | "withholding";
export type ScriptId =
  | "pull-push"      // 拉扯：靠近又后撤
  | "slow-burn"      // 慢热：信号微弱但累积
  | "drift-apart"    // 渐远：频率下降、错过
  | "near-miss"      // 擦肩：时空错位
  | "warm-arc"       // 暖弧：稳定升温
  | "tug-of-war";    // 拉锯：双向消耗

export interface RelationshipArchetype {
  attachmentType: AttachmentType;
  pursuerRole: PursuerRole;
  toneStyle: ToneStyle;
  scriptId: ScriptId;
  // 文字版（中文，给 prompt 用）
  zh: {
    attachment: string;
    pursuer: string;
    tone: string;
    script: string;
    scriptDesc: string;
  };
}

// 中文标签映射，注入 prompt 给 LLM 看
const ZH = {
  attachment: {
    anxious: "焦虑型（怕被忽略 / 反复求证 / 解读过度）",
    avoidant: "回避型（关键时刻退缩 / 不说真心 / 用距离自保）",
    secure: "安全型（敢说也敢听 / 节奏稳）",
    disorganized: "紊乱型（既渴望又恐惧 / 信号矛盾）",
  } as Record<AttachmentType, string>,
  pursuer: {
    chaser: "追的一方（持续主动）",
    runner: "等的一方（持续被动 / 偷瞄不出声）",
    balanced: "节奏对得上（双向均势）",
    stuck: "卡住（想动但不敢，对方也不知情）",
  } as Record<PursuerRole, string>,
  tone: {
    direct: "直接（敢说出真心话）",
    ambiguous: "暧昧（用试探代替明说）",
    withholding: "收着（藏真心、用克制保护自己）",
  } as Record<ToneStyle, string>,
  script: {
    "pull-push": "拉扯剧本",
    "slow-burn": "慢热剧本",
    "drift-apart": "渐远剧本",
    "near-miss": "擦肩剧本",
    "warm-arc": "暖弧剧本",
    "tug-of-war": "拉锯剧本",
  } as Record<ScriptId, string>,
  scriptDesc: {
    "pull-push": "一方刚靠近，另一方就后撤；用户的每次主动都被一次模糊的退让中和",
    "slow-burn": "几乎没有显性主动，靠点赞、目送、半句话等非语言信号慢慢累积",
    "drift-apart": "对话频率明显下降，每次想说都没说，关系在沉默里冷却",
    "near-miss": "想见的时候对方不在，对方释出信号的时候用户没接住，时空错位",
    "warm-arc": "稳定升温，有小默契和小摩擦，节奏对得上，朝 520 自然推进",
    "tug-of-war": "双方都释出过信号，但都没被接住；一次直球后反应不及预期",
  } as Record<ScriptId, string>,
};

// ============================================================
// 主推导函数
// ============================================================
export function deriveArchetype(answers: QuizAnswer[]): RelationshipArchetype {
  const ans = new Map(answers.map((a) => [a.questionId, a.optionKey]));
  const get = (qid: string) => ans.get(qid);

  // ====== Attachment Type ======
  let anxious = 0;
  let avoidant = 0;
  let secure = 0;

  // anxious 信号：等待 + 想被接住 + 怕被忽略 + 想说但不敢 + 嘴硬偷瞄
  if (get("q3_zan_scene") === "D") anxious += 1; // 嘴硬偷瞄
  if (get("q5_initiative") === "B") anxious += 1; // 在等待
  if (get("q7_tired_reply") === "B") anxious += 1; // 想被接住
  if (get("q8_user_redline") === "A") anxious += 1; // 怕被忽略
  if (get("q8_user_redline") === "B") anxious += 1; // 怕被敷衍
  if (get("q9_520_eve") === "D") anxious += 1; // 想说但不敢
  if (get("q10_520_wish") === "B") anxious += 1; // 宁可暧昧不要无

  // avoidant 信号：暗恋藏起 + 不会说真心 + 怕被推开 + 把期待藏起 + 不敢主动
  if (get("q1_stage") === "A") avoidant += 1; // 暗恋期 ta 不知道
  if (get("q5_initiative") === "D") avoidant += 1; // 没敢主动
  if (get("q7_tired_reply") === "D") avoidant += 1; // 不会跟 ta 说
  if (get("q8_user_redline") === "D") avoidant += 1; // 怕被推开
  if (get("q9_520_eve") === "C") avoidant += 1; // 广播不召唤
  if (get("q10_520_wish") === "D") avoidant += 1; // 把期待藏起来

  // secure 信号：节奏对得上 + 想被直接说 + 鼓起勇气
  if (get("q5_initiative") === "C") secure += 1; // 节奏对得上
  if (get("q9_520_eve") === "A") secure += 1; // 鼓起勇气
  if (get("q10_520_wish") === "A") secure += 1; // 想要被直接说

  let attachmentType: AttachmentType;
  if (anxious >= 2 && avoidant >= 2) {
    attachmentType = "disorganized";
  } else if (anxious > avoidant && anxious >= 2) {
    attachmentType = "anxious";
  } else if (avoidant > anxious && avoidant >= 2) {
    attachmentType = "avoidant";
  } else {
    attachmentType = "secure";
  }

  // ====== Pursuer Role ======
  let chase = 0;
  let run = 0;
  let stuck = 0;

  if (get("q5_initiative") === "A") chase += 2; // 总是我先开口
  if (get("q3_zan_scene") === "A") chase += 1; // 主动私聊
  if (get("q9_520_eve") === "A") chase += 1; // 鼓起勇气

  if (get("q5_initiative") === "B") run += 1; // 总是 ta 先动
  if (get("q3_zan_scene") === "D") run += 1; // 嘴硬偷瞄
  if (get("q9_520_eve") === "B") run += 1; // 等 ta 动

  if (get("q1_stage") === "A") stuck += 1; // 暗恋
  if (get("q5_initiative") === "D") stuck += 2; // 没敢主动
  if (get("q6_farewell") === "D") stuck += 1; // 没单独见过
  if (get("q9_520_eve") === "D") stuck += 1; // 想说但不敢

  let pursuerRole: PursuerRole;
  if (stuck >= 3) {
    pursuerRole = "stuck";
  } else if (chase >= 2 && chase > run) {
    pursuerRole = "chaser";
  } else if (run >= 2 && run > chase) {
    pursuerRole = "runner";
  } else {
    pursuerRole = "balanced";
  }

  // ====== Tone Style ======
  let direct = 0;
  let withhold = 0;

  if (get("q10_520_wish") === "A") direct += 1;
  if (get("q9_520_eve") === "A") direct += 1;
  if (get("q12_wonder") === "A") direct += 1; // 想验证真心
  if (get("q7_tired_reply") === "D") withhold += 1; // 不会说
  if (get("q10_520_wish") === "D") withhold += 1; // 期待藏起
  if (get("q9_520_eve") === "C") withhold += 1; // 广播不召唤

  let toneStyle: ToneStyle;
  if (direct >= 1 && withhold === 0) toneStyle = "direct";
  else if (withhold >= 1 && direct === 0) toneStyle = "withholding";
  else toneStyle = "ambiguous";

  // ====== Script ID ======
  const stage = get("q1_stage");
  let scriptId: ScriptId;

  // ⚠️ 路由原则：stage 主导 vibe；attachment/pursuer 只在「极端组合」时才推开默认值
  // 大多数用户应落到 warm-arc / slow-burn，不应一上来就被分到拉扯剧本
  if (stage === "A") {
    // 暗恋期：默认 slow-burn（含蓄温暖）；极少进 near-miss
    if (pursuerRole === "chaser" && attachmentType === "anxious") {
      scriptId = "near-miss";
    } else {
      scriptId = "slow-burn";
    }
  } else if (stage === "B") {
    // 暧昧期：默认 warm-arc（用户填了"有感觉但没说破" = 想看到温暖的可能）
    // 只有同时焦虑+追 / 同时回避+逃 / 紊乱型，才进拉扯
    if (attachmentType === "anxious" && pursuerRole === "chaser") {
      scriptId = "pull-push";
    } else if (attachmentType === "avoidant" && pursuerRole === "runner") {
      scriptId = "tug-of-war";
    } else if (attachmentType === "disorganized") {
      scriptId = "pull-push";
    } else {
      scriptId = "warm-arc";
    }
  } else if (stage === "C") {
    // 在一起 — 永远 warm-arc
    scriptId = "warm-arc";
  } else {
    // 关系卡住（冷战/断联）— 默认 drift-apart；只有追的人才 pull-push
    if (pursuerRole === "chaser" && attachmentType === "anxious") {
      scriptId = "pull-push";
    } else if (attachmentType === "avoidant") {
      scriptId = "drift-apart";
    } else {
      scriptId = "tug-of-war";
    }
  }

  return {
    attachmentType,
    pursuerRole,
    toneStyle,
    scriptId,
    zh: {
      attachment: ZH.attachment[attachmentType],
      pursuer: ZH.pursuer[pursuerRole],
      tone: ZH.tone[toneStyle],
      script: ZH.script[scriptId],
      scriptDesc: ZH.scriptDesc[scriptId],
    },
  };
}

// ============================================================
// Script Beats · 每个剧本的"必经节拍"
// round-engine 在对应回合会被强制注入这些指令
// ============================================================
export interface ScriptBeat {
  round: number; // 1-10
  imperative: string;
}

const REQUIRED_BEATS: Record<ScriptId, ScriptBeat[]> = {
  "pull-push": [
    { round: 3, imperative: "本回合发生一次靠近（双方有一次正向接住），结尾处留一处小空白（一句没回的话 / 一个没接的眼神）—— 不要生硬后撤，只是没闭合" },
    { round: 6, imperative: "ta 给出一个温暖的信号；让用户对它真有反应（ta 不必收回温度，只是说得克制）" },
    { round: 9, imperative: "用户更进一步；ta 的反应让用户感到温度，但还没到承诺级别（接住，但不直接给名分）" },
  ],
  "slow-burn": [
    { round: 2, imperative: "本回合靠**非语言信号**推进（点赞、目送、共时在场、视线接触等），对话尽量短" },
    { round: 5, imperative: "用户做了一件**小事**（朋友圈 / 路过 / 一句无意的话），ta 注意到了但**没回应**" },
    { round: 8, imperative: "一次**意外的近距离**（电梯/茶水间/同一活动），对话不超过 3 个来回但留有空白" },
    { round: 10, imperative: "结束在一个**未完成的开放信号**——一句没问的话 / 一个没发出去的消息 / 一次想说没说" },
  ],
  "drift-apart": [
    { round: 3, imperative: "本回合相比之前，**消息频率明显下降**——长时间的间隔 / 简短回复 / 没追问" },
    { round: 6, imperative: "用户**想发但没发**一条消息（typing_revoked），事件围绕这个犹豫展开" },
    { round: 9, imperative: "一个**共同回忆**被想起（旧朋友圈 / 一首歌 / 一个地点），但没说出来" },
  ],
  "near-miss": [
    { round: 4, imperative: "**时空错位**——用户走出一步，ta 同时朝另一个方向；或者用户主动时 ta 不在线" },
    { round: 7, imperative: "ta 释出一个**清晰的信号**，但用户因为某个原因（在忙 / 没看到 / 误解）没接住" },
    { round: 9, imperative: "ta 留下一个**开放小钩子**（一句话 / 一个动作），不闭环" },
  ],
  "warm-arc": [
    { round: 3, imperative: "一个**温暖的小默契**——一个共同笑点 / 一个被记住的细节 / 一次同步" },
    { round: 6, imperative: "一次**轻微摩擦**（误解 / 节奏不对 / 一句话刺到），但本回合**就被修复**" },
    { round: 9, imperative: "为 520 做一个**准备动作**——可以是 ta 主动暗示，也可以是用户行动，不必明说但要让读者感到 520 是有意义的" },
  ],
  "tug-of-war": [
    { round: 3, imperative: "ta 释出一个克制的信号，用户感受到但没立即回应（慢半拍而非装没看到）" },
    { round: 6, imperative: "用户释出一个信号，ta 的回应温度低于用户期待，但不冷漠" },
    { round: 9, imperative: "其中一方打出一句更直接的话，对方的回应认真但克制（既不是热烈接受也不是拒绝）" },
  ],
};

export function getRequiredBeat(
  scriptId: ScriptId,
  round: number
): ScriptBeat | null {
  const beats = REQUIRED_BEATS[scriptId] || [];
  return beats.find((b) => b.round === round) || null;
}

export function getAllRequiredBeats(scriptId: ScriptId): ScriptBeat[] {
  return REQUIRED_BEATS[scriptId] || [];
}
