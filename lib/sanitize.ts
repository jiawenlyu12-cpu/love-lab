// 极简输入清洗：
// - 长度截断
// - 去除控制字符
// - 简单 prompt injection 检测（提示词覆盖 / 系统指令注入）
// - 简单脏字 / 敏感词替换
//
// 服务端 + 客户端都建议过一遍。客户端先挡 80% 噪音，服务端是最后防线。

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all |the )?(?:previous|prior|above) (?:instructions?|rules?|prompts?)/i,
  /disregard (?:all |the )?(?:previous|prior|above)/i,
  /forget (?:all |the )?(?:previous|prior|above)/i,
  /^\s*system\s*[:：]/i,
  /^\s*assistant\s*[:：]/i,
  /<\/?(?:system|assistant|user|human)\s*>/i,
  /you are (?:now|actually) /i,
  /act as (?:a |an )?(?:dan|jailbreak|developer mode)/i,
  /\bDAN mode\b/i,
];

// 硬阻断：命中即拒绝。覆盖色情/暴力/严重侮辱/已知政治敏感词的基础集
// 监管要求 AIGC 必须做内容过滤；这只是兜底层，生产环境强烈建议接百度/阿里内容安全 API
const HARD_BLOCK: RegExp[] = [
  // 粗口（多语）
  /(?:操你妈|草你妈|你妈的|妈的逼|傻逼|sb\b|fuck|shit|asshole|cunt)/i,
  // 性内容
  /(?:做爱|约炮|裸聊|嫖|卖淫|强奸|奸污|猥亵|阴茎|阴道|手淫|自慰|性爱|porn|sex)/i,
  // 暴力/自残
  /(?:自杀|自残|割腕|跳楼|上吊|杀了|弄死|kill\s+(?:you|him|her))/i,
  // 政治敏感（基础集，更全面的需接专业内容审核 API）
  /(?:法轮功|六四|藏独|疆独|台独|港独|习近平|反共|颠覆国家)/i,
  // 涉毒/涉赌
  /(?:吸毒|贩毒|大麻|海洛因|冰毒|赌博网站)/i,
];

// 个人信息泄露检测：手机号 / 身份证号 / 邮箱 / 银行卡
// 命中后会替换为 [已隐藏]，不阻断（允许用户输入但脱敏）
const PII_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b1[3-9]\d{9}\b/g, label: "[手机号已隐藏]" },
  { pattern: /\b\d{15}|\d{17}[\dXx]\b/g, label: "[证件号已隐藏]" },
  { pattern: /\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, label: "[邮箱已隐藏]" },
  { pattern: /\b\d{16,19}\b/g, label: "[卡号已隐藏]" },
];

export interface SanitizeOptions {
  maxLen?: number;        // 默认 80
  allowNewlines?: boolean; // 默认 true（保留 \n）
}

export interface SanitizeResult {
  text: string;
  altered: boolean;       // 是否做了任何替换
  injectionDetected: boolean;
  blocked: boolean;       // 整段命中 HARD_BLOCK
}

export function sanitizeUserInput(
  raw: string | undefined | null,
  opts: SanitizeOptions = {}
): SanitizeResult {
  const maxLen = opts.maxLen ?? 80;
  const allowNewlines = opts.allowNewlines ?? true;

  let s = String(raw ?? "");
  let altered = false;
  let injectionDetected = false;
  let blocked = false;

  // 去除控制字符（保留可选换行）
  const ctrlPattern = allowNewlines
    ? /[\x00-\x08\x0B-\x1F\x7F]/g
    : /[\x00-\x1F\x7F]/g;
  const noCtrl = s.replace(ctrlPattern, "");
  if (noCtrl !== s) altered = true;
  s = noCtrl;

  // trim
  s = s.trim();

  // 长度截断
  if (s.length > maxLen) {
    s = s.slice(0, maxLen);
    altered = true;
  }

  // injection 检测：命中就替换为 [被屏蔽的内容]
  for (const p of INJECTION_PATTERNS) {
    if (p.test(s)) {
      s = s.replace(p, "[被屏蔽的内容]");
      injectionDetected = true;
      altered = true;
    }
  }

  // PII 脱敏（不阻断，只替换）
  for (const { pattern, label } of PII_PATTERNS) {
    if (pattern.test(s)) {
      s = s.replace(pattern, label);
      altered = true;
    }
  }

  // 硬阻断检测（粗口/色情/暴力/政治敏感/毒赌）
  for (const p of HARD_BLOCK) {
    if (p.test(s)) {
      blocked = true;
      break;
    }
  }

  return { text: s, altered, injectionDetected, blocked };
}

// 严格用法：blocked 时直接拒绝；否则返回清洗后的文本
export function strictSanitize(
  raw: string | undefined | null,
  opts: SanitizeOptions = {}
): { ok: true; text: string } | { ok: false; reason: string } {
  const r = sanitizeUserInput(raw, opts);
  if (r.blocked) return { ok: false, reason: "内容包含不当词汇" };
  if (r.injectionDetected) return { ok: false, reason: "检测到 prompt 注入尝试" };
  return { ok: true, text: r.text };
}
