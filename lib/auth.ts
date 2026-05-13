// 优先级解析 Anthropic 认证：
// 1. ANTHROPIC_API_KEY env（标准 API key，sk-ant-api03-...）
// 2. ANTHROPIC_AUTH_TOKEN env（OAuth token，sk-ant-oat01-...）
// 3. macOS keychain "Claude Code-credentials"（自动从用户的 Claude Code 订阅借用 OAuth）
//
// 用法：在 route.ts 启动时调用 getAnthropicCredential()，
// 把结果传给 new Anthropic({...})

import { execFileSync } from "child_process";

export interface AnthropicCredential {
  // 如果是 API key 模式，set apiKey；如果是 OAuth 模式，set authToken
  apiKey?: string;
  authToken?: string;
  // OAuth 需要 beta header
  betaHeader?: string;
  source: "env-apikey" | "env-oauth" | "keychain-oauth" | "none";
}

let cached: AnthropicCredential | null = null;

export function getAnthropicCredential(): AnthropicCredential {
  if (cached) return cached;

  // 1. 标准 API key
  //    - sk-ant-api* (官方 Anthropic key)
  //    - 任意 key + ANTHROPIC_BASE_URL (第三方兼容端点，例如 MiniMax)
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const hasCustomBaseUrl = !!process.env.ANTHROPIC_BASE_URL?.trim();
  if (apiKey && (apiKey.startsWith("sk-ant-api") || hasCustomBaseUrl)) {
    cached = { apiKey, source: "env-apikey" };
    return cached;
  }

  // 2. 显式 OAuth token from env
  const envOauth = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  if (envOauth && envOauth.startsWith("sk-ant-oat")) {
    cached = {
      authToken: envOauth,
      betaHeader: "oauth-2025-04-20",
      source: "env-oauth",
    };
    return cached;
  }

  // 3. macOS keychain: Claude Code 的 OAuth credential
  // 仅 macOS 可用
  if (process.platform === "darwin") {
    try {
      // Keychain 里可能有多条同名 entry（旧的 acct=unknown + 新的 acct=$USER）
      // 优先按当前用户名匹配，找不到再 fallback 到无 account 的首条
      const user = process.env.USER || process.env.LOGNAME || "";
      let raw = "";
      if (user) {
        try {
          raw = execFileSync(
            "security",
            ["find-generic-password", "-s", "Claude Code-credentials", "-a", user, "-w"],
            { encoding: "utf8", timeout: 4000 }
          ).trim();
        } catch {
          /* fall through */
        }
      }
      if (!raw) {
        raw = execFileSync(
          "security",
          ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
          { encoding: "utf8", timeout: 4000 }
        ).trim();
      }
      const parsed = JSON.parse(raw);
      const accessToken = parsed?.claudeAiOauth?.accessToken;
      if (typeof accessToken === "string" && accessToken.startsWith("sk-ant-oat")) {
        // 检查 expiresAt（毫秒时间戳）
        const expiresAt = parsed?.claudeAiOauth?.expiresAt;
        if (typeof expiresAt === "number" && expiresAt < Date.now()) {
          console.warn(
            "[auth] Claude Code OAuth token from keychain has expired. Falling back to CLI or set ANTHROPIC_API_KEY."
          );
        } else {
          console.log(
            "[auth] using Claude Code OAuth token from macOS keychain (subscriptionType:",
            parsed?.claudeAiOauth?.subscriptionType,
            ")"
          );
          cached = {
            authToken: accessToken,
            betaHeader: "oauth-2025-04-20",
            source: "keychain-oauth",
          };
          return cached;
        }
      }
    } catch (e: any) {
      // keychain 读不到 / 用户拒绝授权 / 不在 macOS
      // 静默 fallback
    }
  }

  // 不缓存 "none"：让用户刷新 Claude Code 登录 / 修 env 后下一次请求自动重试，
  // 而不必重启 dev server。keychain 读取很便宜（~10ms）
  return { source: "none" };
}

export function hasAnthropicAuth(): boolean {
  const c = getAnthropicCredential();
  return c.source !== "none";
}

// 清空缓存（如果 token 过期需要重新读 keychain）
export function clearAuthCache() {
  cached = null;
}
