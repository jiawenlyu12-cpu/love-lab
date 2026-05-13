// 八字推演 helper · 用 lunar-javascript 离线计算
// 仅供 LLM prompt 注入"命理底色"，不在前端展示原始八字术语

// @ts-ignore - lunar-javascript 没有官方 .d.ts
import { Solar } from "lunar-javascript";

export interface BaziInfo {
  available: boolean;
  hasHour: boolean;
  yearPillar: string;    // 年柱 e.g. "戊寅"
  monthPillar: string;
  dayPillar: string;
  hourPillar: string;    // 时柱 (粗略)，若 hasHour=false 则为占位
  dayStem: string;       // 日干 "甲"
  dayBranch: string;     // 日支 "子" — 配偶宫
  // 五行计数（不含时柱时只统计 3 柱）
  fiveElements: {
    wood: number;
    fire: number;
    earth: number;
    metal: number;
    water: number;
  };
  // LLM 友好的一段叙事（≤120 字）— prompt 直接用
  narrative: string;
}

// 时辰范围 → 取中点小时
const HOUR_RANGE_MAP: Record<string, number | null> = {
  "凌晨 (00:00-06:00)": 3,
  "上午 (06:00-12:00)": 9,
  "中午 (12:00-14:00)": 13,
  "下午 (14:00-18:00)": 16,
  "晚上 (18:00-24:00)": 21,
  "不知道": null,
};

// 天干 → 五行
const STEM_TO_ELEMENT: Record<string, keyof BaziInfo["fiveElements"]> = {
  甲: "wood", 乙: "wood",
  丙: "fire", 丁: "fire",
  戊: "earth", 己: "earth",
  庚: "metal", 辛: "metal",
  壬: "water", 癸: "water",
};
const BRANCH_TO_ELEMENT: Record<string, keyof BaziInfo["fiveElements"]> = {
  寅: "wood", 卯: "wood",
  巳: "fire", 午: "fire",
  辰: "earth", 戌: "earth", 丑: "earth", 未: "earth",
  申: "metal", 酉: "metal",
  亥: "water", 子: "water",
};

// 日柱 → 性格底色 narrative（覆盖常见组合，未覆盖的走通用模板）
const DAY_PILLAR_NARRATIVES: Record<string, string> = {
  甲子: "阳木立于水上，外刚内柔；习惯独立行动，但内里需要被理解",
  乙丑: "阴木坐湿土，温润但坚韧；表面随和，骨子里有不可越的边界",
  丙寅: "阳火生于阳木，热烈直率；情绪起伏明显，被推一下就燃烧",
  丁卯: "阴火藏在阴木里，温柔而敏感；细腻得能感知到情绪的颗粒",
  戊辰: "阳土坐湿土，沉稳厚重；不轻易表态，一旦认定就难以撼动",
  己巳: "阴土生于阳火，细腻而务实；外表平和，内心计算细致",
  庚午: "阳金生于阳火，刚烈果决；锋芒明显，但也容易被点燃",
  辛未: "阴金坐于燥土，外柔内坚；说话克制，内心有自己的秩序",
  壬申: "阳水生于阳金，灵动深邃；情感丰沛但流向多变",
  癸酉: "阴水坐于阴金，敏感清澈；容易共情但不易投入",
};

function getDayPillarNarrative(stem: string, branch: string): string {
  const key = stem + branch;
  if (DAY_PILLAR_NARRATIVES[key]) return DAY_PILLAR_NARRATIVES[key];
  // 通用：基于天干阴阳 + 五行
  const yang = ["甲", "丙", "戊", "庚", "壬"].includes(stem);
  const elem = STEM_TO_ELEMENT[stem];
  const elemCN = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" }[elem];
  return `${stem}${branch}日生，${yang ? "阳" : "阴"}${elemCN}日主，骨子里带着${
    elem === "wood" ? "生长与坚韧" :
    elem === "fire" ? "热烈与急切" :
    elem === "earth" ? "稳重与守护" :
    elem === "metal" ? "锋利与边界" :
    "流动与深沉"
  }的底色`;
}

const BRANCH_SPOUSE_HINT: Record<string, string> = {
  子: "另一半通常承担情感容器的角色，会主动接住你的复杂",
  丑: "另一半往往沉稳务实，但需要你主动开口才会靠近",
  寅: "另一半多有锋芒和主见，关系里需要互相让出空间",
  卯: "另一半温柔但有自己的节奏，急不来",
  辰: "另一半有自己的世界，不轻易让你完全看进去",
  巳: "另一半看似平和，内心戏多过表达",
  午: "另一半热烈但容易冷却，情绪是关系的主调",
  未: "另一半重情但矜持，需要你主动给信号",
  申: "另一半理性且独立，情感表达偏务实",
  酉: "另一半重视细节和秩序，容易被你的随意刺到",
  戌: "另一半忠诚但固执，关系里安全感是底色",
  亥: "另一半敏感且善良，容易被你的语气影响一整天",
};

export function computeBazi(birthday: string, birthTimeRange?: string): BaziInfo | null {
  if (!birthday) return null;
  const m = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1]);
  const month = parseInt(m[2]);
  const day = parseInt(m[3]);

  const hour = birthTimeRange ? HOUR_RANGE_MAP[birthTimeRange] : null;
  const hasHour = hour !== null && hour !== undefined;

  try {
    const solar = hasHour
      ? Solar.fromYmdHms(year, month, day, hour as number, 0, 0)
      : Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();

    const yearPillar: string = ec.getYear();
    const monthPillar: string = ec.getMonth();
    const dayPillar: string = ec.getDay();
    const hourPillar: string = hasHour ? ec.getTime() : "—";

    const dayStem = dayPillar.charAt(0);
    const dayBranch = dayPillar.charAt(1);

    const elem: BaziInfo["fiveElements"] = {
      wood: 0, fire: 0, earth: 0, metal: 0, water: 0,
    };
    const allStems = [yearPillar, monthPillar, dayPillar, ...(hasHour ? [hourPillar] : [])].map(p => p.charAt(0));
    const allBranches = [yearPillar, monthPillar, dayPillar, ...(hasHour ? [hourPillar] : [])].map(p => p.charAt(1));
    allStems.forEach(s => { const e = STEM_TO_ELEMENT[s]; if (e) elem[e]++; });
    allBranches.forEach(b => { const e = BRANCH_TO_ELEMENT[b]; if (e) elem[e]++; });

    const characterLine = getDayPillarNarrative(dayStem, dayBranch);
    const spouseLine = BRANCH_SPOUSE_HINT[dayBranch] || "另一半的特质从日支看不出明显倾向";

    const elemSorted = Object.entries(elem).sort((a, b) => b[1] - a[1]);
    const strongest = elemSorted[0];
    const weakest = elemSorted[elemSorted.length - 1];
    const elemMap = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
    const elemNote = `五行${elemMap[strongest[0] as keyof typeof elemMap]}最旺，${
      weakest[1] === 0 ? `缺${elemMap[weakest[0] as keyof typeof elemMap]}` : `${elemMap[weakest[0] as keyof typeof elemMap]}偏弱`
    }`;

    const narrative = `${characterLine}。${spouseLine}。${elemNote}。`;

    return {
      available: true,
      hasHour,
      yearPillar,
      monthPillar,
      dayPillar,
      hourPillar,
      dayStem,
      dayBranch,
      fiveElements: elem,
      narrative,
    };
  } catch {
    return null;
  }
}
