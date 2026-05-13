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
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (apiKey && apiKey.startsWith("sk-ant-api")) {
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
      const raw = execFileSync(
        "security",
        ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
        { encoding: "utf8", timeout: 4000 }
      ).trim();
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

  cached = { source: "none" };
  return cached;
}

export function hasAnthropicAuth(): boolean {
  const c = getAnthropicCredential();
  return c.source !== "none";
}

// 清空缓存（如果 token 过期需要重新读 keychain）
export function clearAuthCache() {
  cached = null;
}
