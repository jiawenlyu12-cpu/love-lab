// ============================================================
// Western zodiac sign · 由生日算星座 + 两个人的星座兼容性
//
// 用现代占星语言（火/土/风/水 四元素 + 5 种主要相位），
// 不引入"合婚 / 冲克害"这类传统命理词汇。
// ============================================================

import type {
  SignAspectKind,
  SignCompatibility,
  SignElement,
  SignEnergy,
  ZodiacSign,
} from "./types";

// MM-DD 边界（西方占星太阳星座）
const SIGN_RANGES: Array<{
  sign: ZodiacSign;
  startMonth: number;
  startDay: number;
}> = [
  { sign: "摩羯", startMonth: 12, startDay: 22 },
  { sign: "水瓶", startMonth: 1, startDay: 20 },
  { sign: "双鱼", startMonth: 2, startDay: 19 },
  { sign: "白羊", startMonth: 3, startDay: 21 },
  { sign: "金牛", startMonth: 4, startDay: 20 },
  { sign: "双子", startMonth: 5, startDay: 21 },
  { sign: "巨蟹", startMonth: 6, startDay: 22 },
  { sign: "狮子", startMonth: 7, startDay: 23 },
  { sign: "处女", startMonth: 8, startDay: 23 },
  { sign: "天秤", startMonth: 9, startDay: 23 },
  { sign: "天蝎", startMonth: 10, startDay: 24 },
  { sign: "射手", startMonth: 11, startDay: 23 },
];

const SIGN_ELEMENT: Record<ZodiacSign, SignElement> = {
  白羊: "火", 狮子: "火", 射手: "火",
  金牛: "土", 处女: "土", 摩羯: "土",
  双子: "风", 天秤: "风", 水瓶: "风",
  巨蟹: "水", 天蝎: "水", 双鱼: "水",
};

// 黄道顺序（白羊为 0）
const SIGN_INDEX: Record<ZodiacSign, number> = {
  白羊: 0, 金牛: 1, 双子: 2, 巨蟹: 3, 狮子: 4, 处女: 5,
  天秤: 6, 天蝎: 7, 射手: 8, 摩羯: 9, 水瓶: 10, 双鱼: 11,
};

export function computeWesternSign(
  date: string
): { sign: ZodiacSign; element: SignElement } | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = parseInt(m[2]);
  const day = parseInt(m[3]);

  // 摩羯跨年（12/22 - 1/19）单独判定
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
    return { sign: "摩羯", element: SIGN_ELEMENT["摩羯"] };
  }
  for (let i = 1; i < SIGN_RANGES.length; i++) {
    const cur = SIGN_RANGES[i];
    const next = SIGN_RANGES[i + 1];
    const after =
      month > cur.startMonth ||
      (month === cur.startMonth && day >= cur.startDay);
    const before =
      next == null
        ? true
        : month < next.startMonth ||
          (month === next.startMonth && day < next.startDay);
    if (after && before) {
      return { sign: cur.sign, element: SIGN_ELEMENT[cur.sign] };
    }
  }
  return null;
}

// 元素配对偏向
function elementPairEnergy(
  a: SignElement,
  b: SignElement
): "complementary" | "tense" | "neutral" {
  // 火↔风、土↔水 = 互补
  if ((a === "火" && b === "风") || (a === "风" && b === "火")) return "complementary";
  if ((a === "土" && b === "水") || (a === "水" && b === "土")) return "complementary";
  // 火↔水、风↔土 = 张力
  if ((a === "火" && b === "水") || (a === "水" && b === "火")) return "tense";
  if ((a === "风" && b === "土") || (a === "土" && b === "风")) return "tense";
  // 火↔土、风↔水 = 中性
  return "neutral";
}

function aspectFromDistance(d: number): SignAspectKind {
  if (d === 0) return "conjunction";
  if (d === 4 || d === 8) return "trine";       // 同元素
  if (d === 2 || d === 10) return "sextile";    // 兼容元素
  if (d === 3 || d === 9) return "square";      // 张力
  if (d === 6) return "opposition";
  return "neutral";
}

export function computeSignCompatibility(
  userSign: ZodiacSign,
  taSign: ZodiacSign
): SignCompatibility {
  const ui = SIGN_INDEX[userSign];
  const ti = SIGN_INDEX[taSign];
  const dist = Math.abs(ui - ti);
  const cyclicDist = Math.min(dist, 12 - dist);
  // 用绝对差判 conjunction/trine 等；用 mod 12 算 distance
  const realDist = (ti - ui + 12) % 12;
  const kind = aspectFromDistance(realDist);

  const userElement = SIGN_ELEMENT[userSign];
  const taElement = SIGN_ELEMENT[taSign];

  // energy + descriptor
  let energy: SignEnergy;
  let descriptor: string;
  let label: string;

  if (kind === "conjunction") {
    energy = "同频";
    descriptor = "同一个星座——同频是默契，也可能是同一个盲区";
    label = `${userSign} × ${taSign} · 同频`;
  } else if (kind === "trine") {
    energy = "和谐";
    descriptor = "同元素的人天然合拍，像本来就该靠近的两个人";
    label = `${userSign} × ${taSign} · ${userElement}${userElement === taElement ? "" : taElement}三分相`;
  } else if (kind === "sextile") {
    energy = "互补";
    descriptor = "不同但互相托住——他给你空气，你给他火焰";
    label = `${userSign} × ${taSign} · ${userElement}${taElement}互补`;
  } else if (kind === "square") {
    energy = "张力";
    descriptor = "节奏不同步，越想拉近越容易碰撞——但碰撞也是被看见";
    label = `${userSign} × ${taSign} · ${userElement}${taElement}四分相`;
  } else if (kind === "opposition") {
    energy = "互照";
    descriptor = "黄道两端，是对方身上看见自己缺的那一半";
    label = `${userSign} × ${taSign} · 对分相`;
  } else {
    const ep = elementPairEnergy(userElement, taElement);
    if (ep === "complementary") {
      energy = "互补";
      descriptor = "节奏不同，但互相托住";
    } else if (ep === "tense") {
      energy = "张力";
      descriptor = "需要互相把节奏放慢一些";
    } else {
      energy = "中性";
      descriptor = "不冲不合，靠近与否全凭你们自己";
    }
    label = `${userSign} × ${taSign}`;
  }
  // 防止 "未使用变量" 警告：cyclicDist 暂时不用，但留作未来扩展位置
  void cyclicDist;

  return {
    kind,
    userSign,
    taSign,
    userElement,
    taElement,
    label,
    energy,
    descriptor,
  };
}
