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

// 简单脏字（可按需扩展）。命中后整段标记为 [屏蔽]
const HARD_BLOCK: RegExp[] = [
  /(?:操|草|fuck|shit|asshole)\b/i,
  // 政治敏感不在 demo 范畴展开
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

  // 脏字检测
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
