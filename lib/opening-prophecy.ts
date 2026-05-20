// ============================================================
// Opening Prophecy · 开局预言（规则生成，同输入同输出）
//
// 输入：用户 + ta 的生日/时辰（都选填）+ Q1 关系阶段 + 关键日
// 输出：双人命盘速览 + 用户/ta 底色 + 星座兼容性 + 关键日判定 +
//      终局必中时刻 + AI 推算依据小字
//
// 这一步不调 LLM。所有结论都来自规则——
// 让 simulator 开篇先把"算出来的东西"给用户看，再开始 LLM 演剧本。
// 走的是西方星座 + 现代占星语言，不用「合婚 / 冲克害」。
// ============================================================

import type {
  AstroBeing,
  BaseProfile,
  OpeningProphecy,
  QuizAnswer,
  SignCompatibility,
  ZodiacSign,
  SignElement,
} from "./types";
import {
  computeBazi,
  computeStreamDay,
  type BaziInfo,
} from "./bazi";
import {
  computeSignCompatibility,
  computeWesternSign,
} from "./zodiac-sign";
import { deriveArchetype } from "./relationship-archetype";

const DEFAULT_KEY_DATE = "2026-05-20";

const FATED_MOMENT_BY_STREAM_ENERGY: Record<string, string> = {
  助: "12:24",
  用: "20:18",
  泄: "16:32",
  克: "23:47",
  强: "09:09",
};

const FATED_MOMENT_BY_SIGN_ENERGY: Record<string, string> = {
  同频: "12:24",
  和谐: "12:24",
  互补: "20:18",
  张力: "21:55",
  互照: "23:47",
  中性: "20:20",
};

const STAGE_BACKDROP: Record<string, string> = {
  A: "你单方面把心藏起来，ta 还没接到信号。",
  B: "你们都站在那条没说破的线两边。",
  C: "你们已经在一起。今天要回答的是「能不能更近」。",
  D: "你们之间有一座桥，断了一半。",
};

const STREAM_DAY_DESCRIPTOR: Record<string, string> = {
  助: "这一天会有人递来善意——你能接住的话，今天会变得很轻",
  用: "这一天你能拿到主动权，可以试探，也可以直球",
  泄: "你今天想表达的会很多，但说出来会消耗自己一些",
  克: "今天压力会大过预期，节奏可能不在你这边，谨慎主动",
  强: "今天和你同频的人会多——但也容易和「自己人」较劲",
};

// 12 星座 → "一句话个性白描"（不用占星术语）
const SIGN_TRAIT: Record<string, string> = {
  白羊: "热度上来得快，凉下来也快；想要的东西不掩饰",
  金牛: "慢热但稳定；一旦认定，节奏就只跟自己走",
  双子: "脑子总有 N 条线在跑，话比情绪先出口",
  巨蟹: "心思藏得深，但能记住别人忘掉的细节",
  狮子: "需要被看见；越在意的人面前越要装不在乎",
  处女: "嘴上挑剔，心里多半已经给对方让了三步",
  天秤: "总在权衡谁付出更多，但其实最怕的是不公平",
  天蝎: "话不多，看进去就深；爱也好恨也好都不浅",
  射手: "对距离比对承诺更敏感；自由是底线",
  摩羯: "看着冷静，内里把「喜欢」换算成了一整套行动",
  水瓶: "脑子和心永远不在同一个频道，但都不肯认",
  双鱼: "情绪先于事实；常常已经在想象里把对方原谅过一遍",
};

const SIGN_INDEX: Record<string, number> = {
  白羊: 1, 金牛: 2, 双子: 3, 巨蟹: 4, 狮子: 5, 处女: 6,
  天秤: 7, 天蝎: 8, 射手: 9, 摩羯: 10, 水瓶: 11, 双鱼: 12,
};

function signTraitLine(sign: ZodiacSign | null): string {
  if (!sign) return "你身上有不容易被一句话说清的底色";
  return SIGN_TRAIT[sign] || "";
}

// 中文相位名（供 evidenceLine 使用）
function aspectZh(c: SignCompatibility): string {
  switch (c.kind) {
    case "conjunction": return "合相（同星座）";
    case "trine": return "三分相";
    case "sextile": return "六分相";
    case "square": return "四分相";
    case "opposition": return "对分相";
    default: return "中性相位";
  }
}

function buildHeadline(args: {
  hasCompat: boolean;
  signEnergy?: string;
  stage: string;
}): string {
  if (args.hasCompat) {
    switch (args.signEnergy) {
      case "同频":
      case "和谐":
        return "你们是合得上的";
      case "互补":
        return "你们互相托住对方";
      case "张力":
        return "靠近时容易碰撞";
      case "互照":
        return "你们是彼此的镜子";
      case "中性":
        return "靠近与否在你们自己";
    }
  }
  switch (args.stage) {
    case "A": return "你的心还藏着";
    case "B": return "线在那里，没说破";
    case "C": return "今天能不能更近";
    case "D": return "桥断了一半";
    default: return "今天我们要走完十步";
  }
}

// 黄道距离 0-6（取 min(d, 12-d)），用于"相距 N 宫"
function zodiacDistance(a: ZodiacSign, b: ZodiacSign): number {
  const ai = SIGN_INDEX[a];
  const bi = SIGN_INDEX[b];
  const d = Math.abs(ai - bi);
  return Math.min(d, 12 - d);
}

export interface BuildOpeningProphecyArgs {
  base: BaseProfile;
  quizAnswers: QuizAnswer[];
  keyDate?: string;
  bazi?: BaziInfo | null;
  chatScreenshotsCount?: number;
}

export function buildOpeningProphecy(
  args: BuildOpeningProphecyArgs
): OpeningProphecy {
  const { base, quizAnswers } = args;
  const keyDate = args.keyDate || DEFAULT_KEY_DATE;
  const shotsCount = Math.max(0, Math.min(5, args.chatScreenshotsCount ?? 0));
  const userBazi =
    args.bazi ??
    (base.birthday ? computeBazi(base.birthday, base.birthTimeRange) : null);

  const userSignInfo = base.birthday ? computeWesternSign(base.birthday) : null;
  const taSignInfo = base.taBirthday ? computeWesternSign(base.taBirthday) : null;

  // archetype（从 12 道题规则化推导）
  const archetype = quizAnswers.length > 0 ? deriveArchetype(quizAnswers) : null;

  const userName = base.name || "你";
  const taName = base.taName || "ta";

  // ===== AstroBeing × 2（前端命盘速览用）=====
  const user: AstroBeing = {
    name: userName,
    sign: userSignInfo?.sign ?? null,
    element: userSignInfo?.element ?? null,
    mbti: base.mbti && base.mbti !== "不知道" ? base.mbti : undefined,
    attachmentTypeZh: archetype?.zh.attachment,
    scriptZh: archetype?.zh.script,
    trait: signTraitLine(userSignInfo?.sign ?? null),
  };

  const ta: AstroBeing = {
    name: taName,
    sign: taSignInfo?.sign ?? null,
    element: taSignInfo?.element ?? null,
    trait: taSignInfo
      ? signTraitLine(taSignInfo.sign)
      : "ta 的生日还没填，AI 暂时只能从你的描述里读 ta",
  };

  // ===== userBackdrop / taBackdrop =====
  const userBackdrop = userSignInfo
    ? `${userName}是${userSignInfo.sign}座（${userSignInfo.element}象）——${user.trait}`
    : userBazi?.available
      ? `${userName}的命盘底色：${stripBaziJargon(userBazi.narrative)}`
      : `${userName}尚未填写生日，我看不见你的底色。`;

  const taBackdropBase = taSignInfo
    ? `${taName}是${taSignInfo.sign}座（${taSignInfo.element}象）——${ta.trait}`
    : shotsCount > 0
      ? `${taName} 的生日还没填，但你给了 ${shotsCount} 张你们的聊天——AI 直接从里面读 ta 的说话风格。`
      : `${taName} 的生日还没填，AI 只能从你 3 题的描述里推 ta。`;
  const taBackdrop =
    taSignInfo && shotsCount > 0
      ? `${taBackdropBase} 你又上传了 ${shotsCount} 张聊天——ta 的语气、回复节奏、表情习惯会被 AI 直接读出来。`
      : taBackdropBase;

  // ===== compatibility（双方都有星座时才算） =====
  let compatibility: OpeningProphecy["compatibility"] = null;
  if (userSignInfo && taSignInfo) {
    const sign: SignCompatibility = computeSignCompatibility(
      userSignInfo.sign,
      taSignInfo.sign
    );
    const distance = zodiacDistance(userSignInfo.sign, taSignInfo.sign);
    const sentence = `${userName}是${userSignInfo.sign}座（${userSignInfo.element}象），${taName}是${taSignInfo.sign}座（${taSignInfo.element}象）——${signRelationPhrase(sign)}：${sign.descriptor}。`;
    const evidenceLine = `黄道：${userSignInfo.sign}(${SIGN_INDEX[userSignInfo.sign]} 宫) ↔ ${taSignInfo.sign}(${SIGN_INDEX[taSignInfo.sign]} 宫) · 相距 ${distance} 宫 → ${aspectZh(sign)}`;
    compatibility = { sign, sentence, distance, evidenceLine };
  }

  // ===== keyDay =====
  const streamDay =
    userBazi?.available && userBazi.dayStem
      ? computeStreamDay(keyDate, userBazi.dayStem)
      : null;
  const keyDaySentence = streamDay
    ? `${keyDate} 对你而言——${STREAM_DAY_DESCRIPTOR[streamDay.energy] || streamDay.descriptor}。`
    : `${keyDate} 是这次推演的终点。`;
  const keyDayEvidence = streamDay
    ? `推算：你出生日 ${base.birthday || "—"} + 关键日 ${keyDate} 的命盘节点 → 「${streamDay.descriptor.slice(0, 12)}…」`
    : `（未填写生日，关键日没有命盘对照）`;

  // ===== stageBackdrop（Q1）=====
  const q1 = quizAnswers.find((a) => a.questionId === "q1_stage");
  const stageBackdrop =
    (q1?.optionKey && STAGE_BACKDROP[q1.optionKey]) ||
    "你们之间还有很多没说出口的事。";

  // ===== archetypeReveal =====
  const archetypeSource = shotsCount > 0
    ? `你 3 题的回答 + ${shotsCount} 张你们的聊天截图`
    : `你 3 题的回答`;
  const archetypeReveal = archetype
    ? `根据${archetypeSource}，AI 把你识别为「${archetype.zh.attachment.split("（")[0]}」× 「${archetype.zh.tone}」 → 剧本路线：${archetype.zh.script}（${archetype.zh.scriptDesc.slice(0, 28)}…）`
    : "";

  // ===== screenshotsLine（仅当有截图时显示）=====
  const screenshotsLine =
    shotsCount > 0
      ? `📷 AI 已读你们 ${shotsCount} 张聊天，ta 的说话风格 / 回复节奏会被直接用进推演。`
      : undefined;

  // ===== fatedMoment =====
  const fatedMoment = (() => {
    if (streamDay) {
      return FATED_MOMENT_BY_STREAM_ENERGY[streamDay.energy] || "20:20";
    }
    if (compatibility) {
      return FATED_MOMENT_BY_SIGN_ENERGY[compatibility.sign.energy] || "20:20";
    }
    return "20:20";
  })();
  const fatedMomentEvidence = (() => {
    const parts: string[] = [];
    if (streamDay) {
      parts.push(`命盘能量「${streamDay.descriptor.slice(0, 10)}…」`);
    }
    if (compatibility) {
      parts.push(`你们 ${aspectZh(compatibility.sign)}（${compatibility.sign.energy}）`);
    }
    if (parts.length === 0) parts.push("默认锚点（未填生日）");
    return `锚定依据：${parts.join(" + ")}`;
  })();

  // ===== headline =====
  const headline = buildHeadline({
    hasCompat: !!compatibility,
    signEnergy: compatibility?.sign.energy,
    stage: q1?.optionKey || "",
  });
  const headlineEvidence = (() => {
    const ev: string[] = [];
    if (compatibility) {
      ev.push(`黄道相距 ${compatibility.distance} 宫 · ${compatibility.sign.userElement}${compatibility.sign.taElement} 元素`);
    } else if (userSignInfo) {
      ev.push(`你的${userSignInfo.sign}座 · ${userSignInfo.element}象`);
    }
    if (base.mbti && base.mbti !== "不知道") ev.push(`你 ${base.mbti}`);
    if (archetype) ev.push(`3 题 → ${archetype.zh.script}`);
    return ev.length ? `依据：${ev.join(" · ")}` : "";
  })();

  // ===== fullText =====
  const lines: string[] = [];
  lines.push(userBackdrop);
  lines.push(taBackdrop);
  if (compatibility) lines.push(compatibility.sentence);
  lines.push(stageBackdrop);
  if (archetypeReveal) lines.push(archetypeReveal);
  lines.push(keyDaySentence);
  lines.push(
    `今天我们要演的是你最可能走过的十个时刻——最后一回合，会落在 ${keyDate} ${fatedMoment}。`
  );

  return {
    user,
    ta,
    headline,
    headlineEvidence,
    userBackdrop,
    taBackdrop,
    compatibility,
    stageBackdrop,
    archetypeReveal,
    screenshotsLine,
    keyDay: {
      date: keyDate,
      streamDay,
      sentence: keyDaySentence,
      evidenceLine: keyDayEvidence,
    },
    fatedMoment,
    fatedMomentEvidence,
    fullText: lines.join(" "),
  };
}

// ============ helpers ============

function stripBaziJargon(narrative: string): string {
  const parts = narrative.split("。").filter(Boolean);
  const charPart = (parts[0] || "").split(/[；;]/).slice(-1)[0] || parts[0] || "";
  const spousePart = parts[1] || "";
  return [charPart, spousePart].filter(Boolean).join("。") + (spousePart ? "。" : "");
}

function signRelationPhrase(c: SignCompatibility): string {
  switch (c.kind) {
    case "conjunction":
      return "你们是同一个星座";
    case "trine":
      return `${c.userElement === c.taElement ? "同元素三分相" : "三分相"}（${c.userElement} × ${c.taElement}）`;
    case "sextile":
      return `元素互补（${c.userElement} × ${c.taElement}）`;
    case "square":
      return `四分相（${c.userElement} × ${c.taElement}，张力位）`;
    case "opposition":
      return "对分相（黄道两端，互为镜子）";
    default:
      return `${c.userElement} × ${c.taElement}`;
  }
}

// 给 TS 看，避免 SignElement 未使用警告
type _unused = SignElement;
