import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { computeBazi } from "@/lib/bazi";
import { getAnthropicCredential, hasAnthropicAuth } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { strictSanitize } from "@/lib/sanitize";

import {
  ROUND_ENGINE_SYSTEM_PROMPT,
  buildRoundEngineInput,
} from "@/lib/agents/round-engine";
import {
  PEEK_MIND_SYSTEM_PROMPT,
  buildPeekMindInput,
} from "@/lib/agents/peek-mind";
import {
  INTERVENE_SYSTEM_PROMPT,
  buildInterveneInput,
} from "@/lib/agents/intervene";
import {
  RELATIONSHIP_SUMMARY_SYSTEM_PROMPT,
  buildRelationshipSummaryInput,
} from "@/lib/agents/relationship-summary";
import {
  mockRoundEngine,
  mockPeekMind,
  mockIntervene,
  mockRelationshipSummary,
} from "@/lib/agents/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

let _client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (_client !== undefined) return _client;
  const cred = getAnthropicCredential();
  if (cred.source === "none") {
    _client = null;
    return null;
  }
  const defaultHeaders: Record<string, string> = {};
  if (cred.betaHeader) defaultHeaders["anthropic-beta"] = cred.betaHeader;
  _client = new Anthropic({
    apiKey: cred.apiKey ?? null,
    authToken: cred.authToken ?? null,
    defaultHeaders,
  });
  return _client;
}

// 如果 SDK + OAuth 路径已经永久失败（如 Anthropic 拒绝），就跳过 SDK 直接走 mock
let sdkOauthBanned = false;

async function callLLM(
  system: string,
  user: string,
  maxTokens = 1500,
  modelHint?: "haiku" | "sonnet" | "opus",
  images?: string[]
): Promise<string> {
  const client = !sdkOauthBanned ? getClient() : null;
  const cred = getAnthropicCredential();
  const isOauth = cred.source === "env-oauth" || cred.source === "keychain-oauth";

  if (client) {
    const modelName =
      modelHint === "haiku"
        ? "claude-haiku-4-5-20251001"
        : modelHint === "opus"
        ? "claude-opus-4-7"
        : MODEL;

    let content: Anthropic.MessageParam["content"];
    if (images && images.length > 0) {
      content = [
        ...images
          .map((dataUrl) => parseDataUrl(dataUrl))
          .filter((x): x is { mediaType: string; data: string } => x !== null)
          .map(
            (img) =>
              ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: img.mediaType as
                    | "image/jpeg"
                    | "image/png"
                    | "image/gif"
                    | "image/webp",
                  data: img.data,
                },
              })
          ),
        { type: "text", text: user },
      ];
    } else {
      content = user;
    }

    try {
      // ⭐ Prompt caching：把 system prompt 标 ephemeral
      // SDK 0.32 types 还没有 cache_control，运行时支持，用 as any 绕过类型
      const resp = await client.messages.create({
        model: modelName,
        max_tokens: maxTokens,
        system: [
          {
            type: "text",
            text: system,
            cache_control: { type: "ephemeral" },
          } as any,
        ],
        messages: [{ role: "user", content }],
      });
      return resp.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
    } catch (err: any) {
      // OAuth token 被 Anthropic 拒绝（403 forbidden）→ 永久 ban，让上层 fallback 到 mock
      const status = err?.status || err?.response?.status;
      const isForbidden = status === 403 || err?.message?.includes("Request not allowed");
      if (isOauth && isForbidden) {
        sdkOauthBanned = true;
        console.warn(
          "[llm] OAuth token rejected by Anthropic API (403). All subsequent calls will use smart mock."
        );
        // 抛错让 safeCallLLM 返回 null → 上层走 mock
        throw err;
      }
      // 其他错误（如真 API key 配错 / 网络 / 5xx）直接抛出
      throw err;
    }
  }

  // 无 SDK 客户端 → 让 mock 接管
  throw new Error("NO_LLM_BACKEND");
}

function parseDataUrl(
  dataUrl: string
): { mediaType: string; data: string } | null {
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

function hasLLMBackend(): boolean {
  // 总是返回 true：有真实 LLM 用真实，没有用 mock，都能正常响应
  // 之所以保留这个函数是为了未来万一要 hard-fail 的入口
  return true;
}

function tryParseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start < 0 || end < 0) return null;
    return JSON.parse(s.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// 包一层：LLM 调用任何失败都返回 null，让上层走 mock fallback
async function safeCallLLM(
  system: string,
  user: string,
  maxTokens = 1500,
  modelHint?: "haiku" | "sonnet" | "opus",
  images?: string[]
): Promise<string | null> {
  try {
    return await callLLM(system, user, maxTokens, modelHint, images);
  } catch (e: any) {
    console.error("[llm] call failed:", e?.message || e);
    return null;
  }
}

// 校验 round-engine / intervene 共用 schema
function validateRoundOutput(p: any): boolean {
  return (
    p &&
    typeof p.time === "string" &&
    typeof p.eventText === "string" &&
    typeof p.userAction === "string" &&
    typeof p.taAction === "string" &&
    Array.isArray(p.beats) &&
    p.delta &&
    typeof p.delta.closeness === "number" &&
    typeof p.delta.userMood === "number" &&
    typeof p.delta.taAffection === "number" &&
    typeof p.delta.taMood === "number" &&
    typeof p.delta.reason === "string"
  );
}

export async function POST(req: NextRequest) {
  // 简单 IP rate limit：每个 IP 每分钟 30 次调用上限
  // 单次完整推演（10 round + 3 peek + 终局）≈ 14 次调用，30/min 够用且能挡爬虫
  const ip = getClientIp(req);
  const rl = rateLimit(`agents:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "请稍后再试",
        resetInSec: Math.ceil(rl.resetIn / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetIn / 1000)),
        },
      }
    );
  }

  const body = await req.json();
  const { agent, payload } = body as { agent: string; payload: any };
  const hasBackend = hasLLMBackend();

  try {
    switch (agent) {
      // ========================================
      // round-engine · 主推演
      // ========================================
      case "round-engine": {
        if (!hasBackend) {
          return NextResponse.json({
            ...mockRoundEngine(
              payload.base,
              payload.userAgent,
              payload.taAgent,
              payload.prevRounds || [],
              payload.state
            ),
            mock: true,
          });
        }
        const bazi = payload.base
          ? computeBazi(payload.base.birthday, payload.base.birthTimeRange)
          : null;
        const images = Array.isArray(payload.images) ? payload.images : undefined;
        const raw = await safeCallLLM(
          ROUND_ENGINE_SYSTEM_PROMPT,
          buildRoundEngineInput({
            base: payload.base,
            userAgent: payload.userAgent,
            taAgent: payload.taAgent,
            state: payload.state,
            prevRounds: payload.prevRounds || [],
            hint: payload.hint,
            bazi,
          }),
          1200,
          "haiku",
          images
        );
        const parsed = tryParseJson<any>(raw);
        if (!validateRoundOutput(parsed)) {
          console.error(
            "[round-engine] schema fail. raw[:400]=",
            String(raw ?? "").slice(0, 400)
          );
          return NextResponse.json({
            ...mockRoundEngine(
              payload.base,
              payload.userAgent,
              payload.taAgent,
              payload.prevRounds || [],
              payload.state
            ),
            mock_fallback: true,
          });
        }
        return NextResponse.json(parsed);
      }

      // ========================================
      // peek-mind · 读心
      // ========================================
      case "peek-mind": {
        if (!hasBackend) {
          return NextResponse.json({
            ...mockPeekMind(payload.base, payload.state, payload.prevRounds || []),
            mock: true,
          });
        }
        const raw = await safeCallLLM(
          PEEK_MIND_SYSTEM_PROMPT,
          buildPeekMindInput({
            base: payload.base,
            userAgent: payload.userAgent,
            taAgent: payload.taAgent,
            state: payload.state,
            prevRounds: payload.prevRounds || [],
          }),
          600,
          "haiku"
        );
        const parsed = tryParseJson<any>(raw);
        const ok =
          parsed &&
          typeof parsed.taMoodLabel === "string" &&
          typeof parsed.taAttitude === "string" &&
          typeof parsed.innerMonologue === "string" &&
          typeof parsed.userBlindSpot === "string";
        if (!ok) {
          console.error("[peek-mind] schema fail. raw[:300]=", String(raw ?? "").slice(0, 300));
          return NextResponse.json({
            ...mockPeekMind(payload.base, payload.state, payload.prevRounds || []),
            mock_fallback: true,
          });
        }
        return NextResponse.json(parsed);
      }

      // ========================================
      // intervene · 用户介入（含 input sanitize）
      // ========================================
      case "intervene": {
        // 1) 服务端再过一遍用户输入（客户端有 maxLength 但不可信）
        const wait = payload.userInputType === "wait";
        if (!wait) {
          const r = strictSanitize(payload.userInputContent, { maxLen: 80 });
          if (!r.ok) {
            return NextResponse.json(
              { error: "invalid_input", message: r.reason },
              { status: 400 }
            );
          }
          payload.userInputContent = r.text;
        }

        if (!hasBackend) {
          return NextResponse.json({
            ...mockIntervene(
              payload.base,
              payload.userInputType,
              payload.userInputContent,
              payload.prevRounds || [],
              payload.state
            ),
            mock: true,
          });
        }
        const bazi = payload.base
          ? computeBazi(payload.base.birthday, payload.base.birthTimeRange)
          : null;
        const raw = await safeCallLLM(
          INTERVENE_SYSTEM_PROMPT,
          buildInterveneInput({
            base: payload.base,
            userAgent: payload.userAgent,
            taAgent: payload.taAgent,
            state: payload.state,
            prevRounds: payload.prevRounds || [],
            userInputType: payload.userInputType,
            userInputContent: payload.userInputContent,
            bazi,
          }),
          1400,
          "haiku"
        );
        const parsed = tryParseJson<any>(raw);
        if (!validateRoundOutput(parsed)) {
          console.error("[intervene] schema fail. raw[:400]=", String(raw ?? "").slice(0, 400));
          return NextResponse.json({
            ...mockIntervene(
              payload.base,
              payload.userInputType,
              payload.userInputContent,
              payload.prevRounds || [],
              payload.state
            ),
            mock_fallback: true,
          });
        }
        return NextResponse.json(parsed);
      }

      // ========================================
      // relationship-summary · 终局报告
      // ========================================
      case "relationship-summary": {
        const baziRS = payload.base
          ? computeBazi(payload.base.birthday, payload.base.birthTimeRange)
          : null;
        if (!hasBackend) {
          return NextResponse.json({
            ...mockRelationshipSummary(payload.base, baziRS, payload.rounds || [], payload.finalState),
            mock: true,
          });
        }
        const raw = await safeCallLLM(
          RELATIONSHIP_SUMMARY_SYSTEM_PROMPT,
          buildRelationshipSummaryInput({
            base: payload.base,
            userAgent: payload.userAgent,
            taAgent: payload.taAgent,
            rounds: payload.rounds || [],
            finalState: payload.finalState,
            bazi: baziRS,
          }),
          2000,
          "sonnet"
        );
        const parsed = tryParseJson<any>(raw);
        const ok =
          parsed &&
          parsed.shareCard &&
          typeof parsed.shareCard.title === "string" &&
          typeof parsed.shareCard.prophecyLine === "string" &&
          typeof parsed.shareCard.punchline === "string" &&
          parsed.analysis &&
          typeof parsed.analysis.yourProjection === "string" &&
          typeof parsed.analysis.yourPosition === "string" &&
          typeof parsed.analysis.yourBlindSpot === "string";
        if (!ok) {
          console.error(
            "[relationship-summary] schema fail. raw[:400]=",
            String(raw ?? "").slice(0, 400)
          );
          return NextResponse.json({
            ...mockRelationshipSummary(payload.base, baziRS, payload.rounds || [], payload.finalState),
            mock_fallback: true,
          });
        }
        return NextResponse.json(parsed);
      }

      default:
        return NextResponse.json(
          { error: `unknown agent: ${agent}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[agents] error", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "agent_error" },
      { status: 500 }
    );
  }
}
