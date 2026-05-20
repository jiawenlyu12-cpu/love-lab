import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { computeBazi, type BaziInfo } from "@/lib/bazi";
import {
  computeVerdict,
  verdictLabel,
  deriveNextChanceDate,
} from "@/lib/five-twenty-verdict";
import { getAnthropicCredential, hasAnthropicAuth } from "@/lib/auth";

// === 全局代理：和 /api/agents 同款，dev 用 ===
{
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (proxy) {
    try {
      setGlobalDispatcher(new ProxyAgent(proxy));
    } catch {
      /* ignore */
    }
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL =
  process.env.ANTHROPIC_DEFAULT_SONNET_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-sonnet-4-5";
const BASE_URL = process.env.ANTHROPIC_BASE_URL?.trim() || undefined;

// ----------------- types -----------------

interface Side {
  name: string;
  birthday: string; // YYYY-MM-DD
}

interface RequestBody {
  user: Side;
  ta: Side;
  screenshots?: string[]; // base64 data URLs
}

interface LLMOutput {
  closenessEstimate: number; // 0-100, ai 从截图判断
  taAffectionEstimate: number; // 0-100, ai 从截图判断
  title: string; // 4-10 字主标题
  chatReading: string; // 第一步：聊天解读 50-100 字
  baziReading: string; // 第二步：八字底色 50-100 字
  fiveTwentyEnding: string; // 第三步：520 结局 50-100 字
  punchline?: string; // 普适诗化金句
}

// ----------------- main -----------------

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const user = body.user;
  const ta = body.ta;
  if (
    !user?.name ||
    !user?.birthday ||
    !ta?.name ||
    !ta?.birthday
  ) {
    return NextResponse.json(
      { error: "缺少必填字段：双方姓名 + 生日" },
      { status: 400 }
    );
  }
  const screenshots = (body.screenshots || []).slice(0, 5);

  // 1) 双方八字
  const userBazi = computeBazi(user.birthday);
  const taBazi = computeBazi(ta.birthday);

  // 2) 构建 LLM 输入
  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(user, ta, userBazi, taBazi, screenshots.length);

  // 3) 调 LLM（或 mock）
  let llmOut: LLMOutput;
  if (!hasAnthropicAuth()) {
    llmOut = mockOutput(user, ta);
  } else {
    try {
      llmOut = await callClaude(systemPrompt, userPrompt, screenshots);
    } catch (e: any) {
      console.error("[api/520] llm error:", e?.message || e);
      // 兜底用 mock，不让用户看到空白
      llmOut = mockOutput(user, ta);
    }
  }

  // 4) 服务端规则化 verdict（不让 LLM 自由发挥）
  const closeness = clamp01(llmOut.closenessEstimate);
  const taAffection = clamp01(llmOut.taAffectionEstimate);
  const verdict = computeVerdict({
    closeness,
    taAffection,
    userMood: 60,
    taMood: 60,
  });
  const label = verdictLabel(verdict);

  // 5) wont 时给下次机会日
  const nc =
    verdict === "wont"
      ? deriveNextChanceDate({
          fromDate: "2026-05-20",
          userDayStem: userBazi?.dayStem,
        })
      : null;

  return NextResponse.json({
    verdict,
    verdictLabel: label,
    title: (llmOut.title || "").trim() || fallbackTitle(verdict, ta.name),
    chatReading: (llmOut.chatReading || "").trim(),
    baziReading: (llmOut.baziReading || "").trim(),
    fiveTwentyEnding: (llmOut.fiveTwentyEnding || "").trim(),
    nextChanceDate: nc?.date,
    nextChanceReason: nc?.reason,
    punchline: llmOut.punchline ? llmOut.punchline.trim() : undefined,
    // 调试用，前端不展示
    _debug: { closeness, taAffection },
  });
}

// ----------------- prompt -----------------

const SYSTEM_PROMPT = `你是【Lovelab 520 解卦】——一个把聊天截图 + 双方八字熬成一段「钉死的、扎心但留希望」预言的 AI。

# 顶层原则
1. 用户脑子里就一个问题：「这个 520，ta 会不会向我表白 / 松口 / 主动？」
2. 你必须先看截图，再叠八字，最后给一个钉死的三段答案
3. 整段文案要"残忍但留希望"——既扎心又给出下一次机会，是 viral 公式
4. **白描胜形容**。给具体动作、具体时刻、具体物件，不要泛泛"你们的关系会..."

# 输出 JSON（严格，只输出这一个对象，无前后多余文字）
{
  "closenessEstimate": 0-100,        // 从截图判断你们当前亲密度（外人能看见的那部分）
  "taAffectionEstimate": 0-100,      // 从截图判断 ta 对用户的隐藏好感（话密度 / 回复速度 / 主动开话题 / emoji 用法）
  "title": "...",                    // 4-10 字主标题：描述 520 这天的关键画面，不是结论字
  "chatReading": "...",              // 50-100 字。从截图里抓 1-2 个具体证据（"你发 3 条 ta 回 1 条" / "ta 最近一次主动是 3 天前" / "你删过那条 '在吗'" 之类），下一个有数字的判断
  "baziReading": "...",              // 50-100 字。用日柱 / 日支 / 五行某 1-2 个点，说 ta 当前的状态（"ta 这个月走食伤，话多但不走心" / "你日支坐子，习惯把心藏水底"），不要堆术语
  "fiveTwentyEnding": "...",         // 50-100 字。直接说 520 这天大概率发生什么 + 一个具体时刻或具体动作。例："5/20 22:30，ta 会发一条朋友圈，配图里没有你。你看到时手悬在评论框上半分钟，最后还是关掉了"
  "punchline": "..."                 // 30-60 字。普适诗化金句，朋友圈截图首选。绝对不含 ta 真名，用「那个人」「ta」代指。可分行用 \\n
}

# 三段语调
- chatReading: 冷静、有证据、有数字。像一个旁观者翻你聊天后的复盘
- baziReading: 命理化但克制。每个术语后面跟一句人话翻译
- fiveTwentyEnding: 预言时态（"会"/"大概率"/"可能"）。要具体到分钟 / 物件 / 没说的话
- punchline: 现在时 / 普适视角 / 白描

# 校准 closenessEstimate / taAffectionEstimate
看截图时盯这几个信号：
- ta 主动开话题的次数 vs 用户主动的次数
- ta 的回复时长（秒回 / 几小时 / 隔天）
- ta 用 emoji / 语气词的密度（"哈哈" "嗯" "好" 越简短越冷）
- 话题深度（聊正事 vs 聊废话 vs 聊感受）
- 称呼变化（叫名字 / 叫昵称 / 没有称呼）
没截图或截图模糊时，默认两个值都给 40-50（偏冷，符合"不会"是主流的产品预期）。

# verdict 阈值（提示，最终由服务端判，不要你输出 verdict 字段）
- 两个值都 ≥ 75 → "会"
- 两个值都 ≥ 55 → "差一步"
- 其它 → "不会"
预期约 80% 用户落在"不会"，这是产品想要的扎心比例。

# 自检
1. punchline 不含 ta 真名？
2. title 4-10 字？
3. chatReading 里有具体证据（数字 / 动作 / 频次）？
4. fiveTwentyEnding 里有具体时刻或具体动作？
5. JSON 是否合法、没有多余文字？`;

function buildUserPrompt(
  user: Side,
  ta: Side,
  userBazi: BaziInfo | null,
  taBazi: BaziInfo | null,
  imgCount: number
): string {
  const userBaziBlock = formatBazi("用户", userBazi);
  const taBaziBlock = formatBazi("ta", taBazi);
  const imgLine =
    imgCount > 0
      ? `# 聊天截图（${imgCount} 张已附在 message 里）
请直接看图，提取 chatReading 所需的具体证据。`
      : `# 聊天截图（无）
没有截图，chatReading 只能凭空写，标记 closenessEstimate / taAffectionEstimate 在 35-50 之间。`;

  return `# 用户基础
- 姓名：${user.name}
- 生日：${user.birthday}
${userBaziBlock}

# ta 基础
- 姓名：${ta.name}
- 生日：${ta.birthday}
${taBaziBlock}

${imgLine}

# 任务
输出严格 JSON。整段文案残忍但留希望。punchline 不含「${ta.name}」字眼。`;
}

function formatBazi(side: string, b: BaziInfo | null): string {
  if (!b || !b.available) return `- 八字：（生日不合法，跳过）`;
  return `- 八字：年${b.yearPillar} 月${b.monthPillar} 日${b.dayPillar}（日干 ${b.dayStem}，日支 ${b.dayBranch}）
- ${side}五行：木${b.fiveElements.wood} 火${b.fiveElements.fire} 土${b.fiveElements.earth} 金${b.fiveElements.metal} 水${b.fiveElements.water}
- 命理底色：${b.narrative}`;
}

// ----------------- claude call -----------------

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  screenshots: string[]
): Promise<LLMOutput> {
  const cred = getAnthropicCredential();
  const isOauth =
    cred.source === "env-oauth" || cred.source === "keychain-oauth";
  const defaultHeaders: Record<string, string> = {};
  if (cred.betaHeader) defaultHeaders["anthropic-beta"] = cred.betaHeader;
  const client = new Anthropic({
    apiKey: cred.apiKey ?? null,
    authToken: cred.authToken ?? null,
    baseURL: BASE_URL,
    defaultHeaders,
  });

  // 图片 → base64 image blocks
  type ImgBlock = {
    type: "image";
    source: {
      type: "base64";
      media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      data: string;
    };
  };
  const imgBlocks: ImgBlock[] = screenshots
    .map((dataUrl) => {
      const m = dataUrl.match(
        /^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/
      );
      if (!m) return null;
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: m[1] as ImgBlock["source"]["media_type"],
          data: m[2],
        },
      };
    })
    .filter((x): x is ImgBlock => x !== null);

  const userContent: Anthropic.MessageParam["content"] = [
    ...imgBlocks,
    { type: "text", text: userPrompt },
  ];

  // OAuth (从 Claude Code 订阅借) 需要 sentinel 头
  const systemBlocks: Anthropic.MessageParam["content"] = [];
  if (isOauth) {
    systemBlocks.push({
      type: "text",
      text: "You are Claude Code, Anthropic's official CLI for Claude.",
    });
  }
  systemBlocks.push({
    type: "text",
    text: systemPrompt,
    // @ts-ignore — ephemeral cache 让重复请求更便宜
    cache_control: { type: "ephemeral" },
  });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemBlocks as any,
    messages: [{ role: "user", content: userContent }],
  });

  const text = resp.content
    .map((b: any) => (b.type === "text" ? b.text : ""))
    .join("");
  return parseJsonStrict(text);
}

// ----------------- helpers -----------------

function parseJsonStrict(text: string): LLMOutput {
  // 容错：剥 ```json ... ``` 外壳
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  // 找第一个 { 和最后一个 }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("LLM did not return JSON");
  const slice = raw.slice(start, end + 1);
  return JSON.parse(slice) as LLMOutput;
}

function clamp01(v: number | undefined | null): number {
  if (typeof v !== "number" || !isFinite(v)) return 45;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function fallbackTitle(
  verdict: "will" | "maybe" | "wont",
  taName: string
): string {
  const t = taName || "ta";
  if (verdict === "will") return `${t} 会 松 口`;
  if (verdict === "maybe") return `差 一 步 而 已`;
  return `${t} 不 会 表 白`;
}

// ----------------- mock（没 key 时本地能跑） -----------------

function mockOutput(user: Side, ta: Side): LLMOutput {
  // 基于姓名哈希做一个看起来不死板的 mock
  const h = (user.name + ta.name + user.birthday).split("").reduce(
    (a, c) => (a + c.charCodeAt(0)) % 100,
    0
  );
  const close = 30 + (h % 40); // 30-69
  const ta_aff = 25 + ((h * 7) % 45); // 25-69

  return {
    closenessEstimate: close,
    taAffectionEstimate: ta_aff,
    title: `${ta.name} 不 会 先 开 口`,
    chatReading: `（mock）从你给的几张截图看，最近 7 天里你发起的话题大概是 ${ta.name} 的两倍，ta 的平均回复时长被拉长到了 38 分钟。最后一次 ta 主动找你，是 4 天前问"在吗"，你回了之后那句话就停住了。`,
    baziReading: `（mock）${user.name} 日支坐子，习惯把心藏在水底——等对方先来捞，但 ${ta.name} 今年走食伤运，话多但不走心，捞不到。你们的五行是水土相搏，黏度高但摩擦也高。`,
    fiveTwentyEnding: `（mock）5/20 22:47，${ta.name} 会发一条朋友圈，配图里没有你。你看到时手悬在评论框上半分钟，敲了又删，最后只点了赞就关掉了。这一天就这样过去，没有人提"我们"。`,
    punchline: `我们都是先伸手又收回的人。\n在 520 这一天，连影子都不敢伸长一点。`,
  };
}
