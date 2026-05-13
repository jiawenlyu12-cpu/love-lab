# AI Love-Lab · 开发文档

> 当前实现状态的完整技术文档。给后续开发 / 维护 / 接手的人看。
>
> 文档版本与代码状态对齐时间：2026-05-12（v2，含 rate-limit / sanitize / prefetch / save-image / PWA / 重玩 / 多维曲线）
>
> 这份文档假设你已经能熟练读 TypeScript + Next.js + Tailwind，不解释通用概念。

---

## 0. 一句话定位

**让用户在 10 个回合的上帝视角沙盘里，看见自己心里那个人在 520 这一天会怎么和自己互动。不预测真实，不算命，是用户对关系的「试错预演」。**

核心机制：

- **状态机驱动**：4 维 0-100 关系状态（其中 2 维对用户隐藏），每回合 LLM 输出 delta 推进状态
- **3 Agent 编排**：主推演 / 读心 / 用户介入，各管一段
- **回合制 + 翻页交互**：≤10 回合，左右翻页推进，单卡承载 5 轮对话
- **可见 / 不可见的张力**：你看得见自己的"亲密度感受"，看不见 ta 的"隐藏好感"——这是产品的核心钩子

---

## 1. 技术栈与依赖

```json
{
  "next": "14.2.18",                    // app router
  "react": "^18.3.1",
  "typescript": "^5.6.3",
  "tailwindcss": "^3.4.15",
  "framer-motion": "^11.11.17",         // 翻页动画 + 拖拽手势
  "zustand": "^5.0.1",                  // 全局状态 + persist 到 localStorage
  "@anthropic-ai/sdk": "^0.32.1",       // LLM 调用（无 cache_control 类型，运行时支持）
  "lunar-javascript": "^1.7.7",         // 八字日柱计算
  "html-to-image": "^1.11.13",          // ⭐ share card 导出 PNG（含微信内置浏览器 fallback）
  "tailwind-merge": "^2.5.4",
  "clsx": "^2.1.1",
  "recharts": "^2.13.3"                 // 暂未使用（可移除）
}
```

> ⚠️ Anthropic SDK 0.32.1 的 `system` 字段类型不含 `cache_control`，运行时 Anthropic API 支持。代码里用 `as any` 绕过类型。如果升级 SDK 到 0.40+ 应该移除该类型 hack。

---

## 2. 目录结构

```
ai-love-lab/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局 + viewport meta
│   ├── globals.css               # 全局样式 / safe-area / iOS 字号修正
│   ├── page.tsx                  # 首页（产品入口）
│   ├── setup/page.tsx            # Step 1：基础信息（姓名 / 生日 / MBTI / ta 代称）
│   ├── builder/page.tsx          # Step 2：12 题问卷养成 agent
│   ├── simulator/page.tsx        # Step 3：关系沙盘（核心交互）
│   ├── report/page.tsx           # 终局：主预言卡 + 折叠的分析
│   └── api/
│       └── agents/
│           └── route.ts          # 唯一后端 endpoint，4 个 agent case 路由
│
├── lib/
│   ├── types.ts                  # 所有共享类型
│   ├── utils.ts                  # cn() / uid() 等小工具
│   ├── bazi.ts                   # 八字日柱计算（独立于 LLM）
│   ├── quiz.ts                   # 12 题问卷定义（builder 用）
│   ├── auth.ts                   # Anthropic 凭证解析链
│   ├── rate-limit.ts             # ⭐ 内存级 IP rate limit（30/min）
│   ├── sanitize.ts               # ⭐ 用户输入清洗（长度 / 控制字符 / prompt injection）
│   ├── engine.ts                 # 客户端 → /api/agents 的 4 个调用函数
│   ├── store/
│   │   └── simulation-store.ts   # Zustand 全局状态 + localStorage 持久化
│   └── agents/                   # Agent prompt + 输入构造
│       ├── round-engine.ts       # 主推演（一回合）
│       ├── peek-mind.ts          # 读心术
│       ├── intervene.ts          # 用户介入
│       ├── relationship-summary.ts  # 终局报告
│       └── mock.ts               # 智能 mock（无 API key 时的兜底）
│
├── components/
│   ├── avatar/
│   │   └── QAvatar.tsx           # q 版头像（hue + traits 标签）
│   └── sandbox/
│       ├── SandboxHud.tsx        # 沙盘顶部：双 agent 头像 + 亲密度条 + 双 mood 条
│       ├── RoundDigest.tsx       # 单回合卡片（含「重玩本回合」按钮 + 介入态金边）
│       ├── PeekMindModal.tsx     # 读心结果浮层（含「再读一次」按钮）
│       └── InterveneModal.tsx    # 用户介入输入浮层（含 80 字上限）
│
├── public/                       # ⭐ PWA 静态资源
│   ├── manifest.json             # PWA manifest（"添加到主屏幕"）
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
│
└── app/legal/
    └── privacy/                  # 隐私声明（首页底部链接）
```

---

## 3. 用户流程

```
[首页 /]
   ↓ 「开始捏 agent」
[/setup]  Step 1
   填：姓名、生日、MBTI（选填）、ta 的代称
   写入 store.base + 调 store.initAgentsFromBase()
   ↓ 「下一步」
[/builder] Step 2
   12 道问卷（关系阶段 / ta 印象 / 朋友圈反应 等）
   每题答完：addQuizAnswer + pushUserTrait/pushTaTrait + shiftUserHue/shiftTaHue
   答完 12 题点「开始推演」：initRelationship() 把 Q1 转成 RelationshipState 初始值
   ↓
[/simulator]  Step 3 · 关系沙盘
   - 顶部：双 agent HUD + 亲密度条 + 当前时间
   - 中部：单回合卡片（左右翻页）
   - 底部：← 上一回合 · 当前页 · 推进时间/下一回合/看主预言卡 →
   - 行动：「介入」「读心」分别消耗一个 callIntervene/callPeekMind
   - 上限：10 回合
   ↓ 「看主预言卡」（10 回合用完 或 用户主动跳出）
[/report]
   - 顶部大卡：主分享卡（title + prophecyLine + punchline，截图发朋友圈）
   - 折叠：3 维投射分析、关键转折点、状态轨迹曲线
   - 重玩：resetGame() 跳回 /setup
```

每一步都有路由守卫，缺前置数据自动 replace 到前一步。

---

## 4. 数据模型

所有类型定义在 `lib/types.ts`。

### 4.1 基础

```ts
interface BaseProfile {
  name: string;       // 用户姓名
  birthday: string;   // YYYY-MM-DD
  mbti: MBTI | "";    // 16 类 + "不知道"
  taName: string;     // ta 的代称
}

interface AgentForm {
  name: string;
  avatarSeed: string;   // 派生 emoji 主体
  traits: string[];     // 答题后累积的 trait chip
  hue: number;          // 0-360 情绪色
}

interface QuizAnswer {
  questionId: string;
  optionKey: "A" | "B" | "C" | "D";
  optionText: string;
  userTrait?: string;
  taTrait?: string;
}
```

### 4.2 关系状态（核心新增）

```ts
interface RelationshipState {
  closeness: number;      // 亲密度 0-100，对用户可见
  userMood: number;       // 用户此刻状态 0-100，对用户可见
  taAffection: number;    // ta 隐藏好感度 0-100，⚠️ 对用户完全隐藏
  taMood: number;         // ta 隐藏心情 0-100，⚠️ 对用户完全隐藏
}

interface StateDelta {
  closeness: number;      // 本回合变化（-10 ~ +10）
  userMood: number;
  taAffection: number;
  taMood: number;
  reason: string;         // 一句话因果（≤30字）
}
```

### 4.3 回合

```ts
interface RoundEvent {
  id: string;
  round: number;            // 1-based
  time: string;             // "HH:MM" 在 520 当天
  eventText: string;        // 30-60 字事件描述（带 1-2 个感官细节）
  userAction: string;       // ≤25 字第三人称动作摘要
  taAction: string;         // ≤25 字
  beats: Beat[];            // 完整对话（默认折叠在 UI 里）
  delta: StateDelta;
  stateAfter: RelationshipState;
  intervened?: boolean;     // 是否由用户介入产生
}

type BeatKind =
  | "message"           // 对话
  | "typing_revoked"    // 打了又删
  | "inner_flash";      // 用户内心独白（ta 不允许）

interface Beat {
  id: string;
  role: "user-agent" | "ta-agent" | "narration";
  kind: BeatKind;
  content: string;
}
```

> `scene` 和 `time_skip` 这两个 BeatKind 是老数据兼容，**新代码不要再产生**。

### 4.4 终局

```ts
interface ShareCard {
  title: string;         // 4-8 字
  prophecyLine: string;  // 30-60 字，具体到分钟的画面感预言
  punchline: string;     // 30-60 字普适诗化金句，**不含 ta 真名**
}

interface RelationshipAnalysis {
  yourProjection: string;   // 你对 ta 的投射（80-150 字）
  yourPosition: string;     // 你在亲密关系里的本能站位（含八字底色）
  yourBlindSpot: string;    // 你最容易自欺的盲点
}

interface KeyMoment {
  time: string;
  label: string;
  impact: string;        // "亲密+8 / 心情-2"
  note: string;
}

interface FinalSummary {
  shareCard: ShareCard;            // ⭐ 主分享卡，截图发朋友圈
  analysis?: RelationshipAnalysis; // 默认折叠
  keyMoments?: KeyMoment[];
}
```

### 4.5 全局 SimulationState

```ts
interface SimulationState {
  base: BaseProfile;
  quizAnswers: QuizAnswer[];
  userAgent: AgentForm;
  taAgent: AgentForm;
  rounds: RoundEvent[];           // 回合历史
  relationship: RelationshipState;
  peeksRemaining: number;         // 读心剩余次数，默认 3
  finalSummary: FinalSummary | null;
  phase: SimPhase;
  // 老字段兼容（不再主用）
  scenes: PlayScene[];
  prefetched: PlayScene[];
  scenarioMode: ScenarioMode | null;
}
```

存储：`zustand/persist` 到 `localStorage`，key 是 `ai-love-lab-sim`，**version: 9**。
版本升级时所有旧数据被丢弃（store 自动 reset）。

---

## 5. 关系状态机详解

### 5.1 4 维的含义

| 维度 | 范围 | 可见性 | 含义 |
|------|-----|------|------|
| `closeness` | 0-100 | ✅ 可见 | 双方亲密程度，越高越近 |
| `userMood` | 0-100 | ✅ 可见 | 用户此刻状态（松弛 vs 紧张） |
| `taAffection` | 0-100 | ❌ 隐藏 | ta 对用户的好感（产品核心张力） |
| `taMood` | 0-100 | ❌ 隐藏 | ta 此刻心情 |

> 「ta 的两个状态对用户隐藏」是产品的核心钩子。读心术（peek-mind）是唯一能"瞄一眼" ta 隐藏状态的方式。

### 5.2 初始值来源

`initRelationship()` 在用户答完 12 题点「开始推演」时触发。根据 Q1（关系阶段）映射：

| Q1 选项 | closeness | userMood | taAffection | taMood |
|---------|----------|----------|------------|--------|
| A 破冰期 | 22 | 60 | 18 | 52 |
| B 高度暧昧 | 58 | 55 | 62 | 55 |
| C 冷战期 | 38 | 32 | 50 | 28 |
| D 断联期 | 14 | 42 | 30 | 45 |
| 默认 | 40 | 50 | 40 | 50 |

实现在 `lib/store/simulation-store.ts:deriveInitialRelationship`。

### 5.3 delta 推进

每个回合 LLM 输出 `delta`，引擎调用 `applyDelta(d)`：

```ts
next.closeness   = clamp(cur.closeness   + d.closeness,   0, 100);
next.userMood    = clamp(cur.userMood    + d.userMood,    0, 100);
next.taAffection = clamp(cur.taAffection + d.taAffection, 0, 100);
next.taMood      = clamp(cur.taMood      + d.taMood,      0, 100);
```

delta 单维度允许范围 -10 ~ +10。前端在 `consumeRoundResult` 用 `clampDelta` 再次约束。

### 5.4 状态如何影响 LLM 输出

`buildRoundEngineInput` 把当前 4 维 state 全部传给 LLM。Prompt 里有明确规则：

```
- taAffection 高 (>60)：ta 行为温度更高，主动一些
- taAffection 中 (30-60)：ta 礼貌但克制
- taAffection 低 (<30)：ta 冷淡疏远

- userMood 低：user 更敏感、更过度解读
- userMood 高：user 更松弛、更敢主动
```

Mock 路径用更简化的 `isWarm = taAffection >= 50` 二分法，选 cold 或 warm 分支。

---

## 6. Agent 系统

4 个 Agent，每个职责清晰，互不污染。

### 6.1 Agent 总览

| Agent | 调用名 | 触发 | 输入 token 上限 | 输出 token 上限 |
|-------|-------|-----|--------------|--------------|
| **round-engine** | `round-engine` | 用户点「推进时间」 | ~3K | 1200 |
| **peek-mind** | `peek-mind` | 用户点「读心」 | ~2K | 600 |
| **intervene** | `intervene` | 用户介入后 | ~3K | 1400 |
| **relationship-summary** | `relationship-summary` | 看主预言卡 | ~5K | 2000（用 sonnet） |

所有调用通过同一个 endpoint：`POST /api/agents`，body:
```json
{ "agent": "round-engine", "payload": { ... } }
```

### 6.2 round-engine

**职责**：基于当前 state + 双方人设 + 历史回合，演算下一回合（事件 + 双方动作 + 5 轮对话 + state delta）。

**输入** (`RoundEngineInputArgs` in `lib/agents/round-engine.ts`):
- `base` (BaseProfile)
- `userAgent`, `taAgent` (含 traits)
- `state` (4 维 RelationshipState)
- `prevRounds` (最近 3 个回合，更早的截断)
- `hint?` 可选用户提示
- `bazi?` 八字底色（用户日柱 + 五行）

**输出**：
```ts
{
  time: string;            // HH:MM，必须晚于上回合
  eventText: string;       // 30-60 字事件
  userAction: string;
  taAction: string;
  beats: Beat[];           // ⭐ 9-12 个，要构成 5 轮 user↔ta 来回
  delta: StateDelta;
}
```

**硬约束**（写在 system prompt 里）：

```
❌ 禁旁白叙事（"窗外有风"这种）
❌ 禁 takeaway / 文评 / 总结
❌ 禁硬塞"心动瞬间"
❌ 禁双方节奏过于协调
❌ ta 不能输出 inner_flash（ta 是黑盒）
✅ user 可以 1-3 个 inner_flash
✅ 一回合 9-12 个 beat，user/ta message 各 ≥ 4，构成 5 轮真实来回
✅ ta 可以个别"已读不回"，但不是整段沉默
```

### 6.3 peek-mind

**职责**：用户消耗一次读心，揭示 ta 此刻真实内心。

**输入**：base + userAgent + taAgent + state + prevRounds（含隐藏 taAffection / taMood）

**输出**：
```ts
{
  taMoodLabel: string;     // 2-8 字情绪短语
  taAttitude: string;      // 一句话 ta 对用户态度，≤40 字
  innerMonologue: string;  // ta 第一人称内心独白，1-2 句，≤60 字
  userBlindSpot: string;   // 用户的盲点（这是产品魂级别的内容），≤80 字
}
```

**关键设计**：

- 独立 LLM 调用，**不写入主推演 context**——避免污染后续 round-engine
- 不解释 taAffection 数字
- userBlindSpot 必须是"对用户自己的发现"，不是"对 ta 的判断"
- 用户消耗一次 `peeksRemaining`（默认 3）

### 6.4 intervene

**职责**：用户接管自己的 agent 做一个具体动作，AI 演 ta 的反应。

**输入**：
- base / userAgent / taAgent / state / prevRounds
- `userInputType`: `"message" | "post" | "wait"`
- `userInputContent`: 用户原文

**输出**：跟 round-engine 同 schema（time / eventText / userAction / taAction / beats / delta）

**关键差别 vs round-engine**：

- `time` 只 +5~30 分钟（用户在做事，不是大跳跃）
- `eventText` 简短（≤20 字），更像"环境锚"
- `userAction` 必须忠实呈现用户的输入
- ta 的反应必须基于用户的具体动作 + 当前隐藏状态

### 6.5 relationship-summary

**职责**：跑完所有回合后生成主预言卡 + 3 维投射分析 + 关键转折点。

**输入**：base + userAgent + taAgent + rounds（全部）+ finalState + bazi

**输出**：
```ts
{
  shareCard: ShareCard,                // ⭐ 主分享卡（合并主预言 + 金句）
  analysis: RelationshipAnalysis,
  keyMoments: KeyMoment[]              // 3-5 个，按 delta 影响排序
}
```

**关键铁律**（写在 prompt 里）：

- ❌ punchline 绝对不含 ta 真名（用"那个人"/"对面那盏灯"代词）
- ❌ punchline 不暴露具体场景细节
- ✅ punchline 是普适诗化金句，适合 4-6 寸竖屏截图
- ✅ analysis 三段全部关于"用户自己"，不是关于 ta
- ✅ yourPosition 必须引用八字日柱 / 五行 / 配偶宫

> 用 sonnet 而非 haiku 因为终局质量直接影响分享意愿，值得多花一点 token。

---

## 7. LLM 后端策略

详见 `app/api/agents/route.ts` + `lib/auth.ts`。

### 7.1 凭证解析链

`lib/auth.ts:getAnthropicCredential()` 按优先级查找：

1. `process.env.ANTHROPIC_API_KEY` （`sk-ant-api03-...`）→ 标准 API key，最佳路径
2. `process.env.ANTHROPIC_AUTH_TOKEN` （`sk-ant-oat01-...`）→ OAuth token
3. macOS keychain 读 `Claude Code-credentials` → 借用用户 Claude Code 订阅的 OAuth token

返回 `{ apiKey, authToken, betaHeader, source }`。

### 7.2 调用与降级

`route.ts:callLLM` 的逻辑：

```
1. getClient() 拿凭证
2. 如果有 client：
   a. SDK 调用 client.messages.create({ system: [{type:"text", text, cache_control:{type:"ephemeral"}}] })
   b. 如果成功：返回输出
   c. 如果 403 forbidden && 是 OAuth 路径：
      - 标记 sdkOauthBanned = true（本进程不再尝试）
      - 抛错让 safeCallLLM 返回 null → 上层走 mock
   d. 其他错误：抛出
3. 无 client：抛 NO_LLM_BACKEND → safeCallLLM 返回 null → mock
4. safeCallLLM 包装：任何错误返回 null
5. 上层用 tryParseJson 解析，schema 失败或 null → 返回对应 mock_fallback
```

> ⚠️ **OAuth 已被 Anthropic 永久封禁**。2026.5.12 起，从 macOS keychain 读到的 OAuth token 用直连 API 会 403。代码会自动检测并降级。这条路径只能用 mock 兜底。
>
> ⚠️ **CLI fallback 已彻底移除**。之前的 `lib/cli-llm.ts` + `ALLOW_CLI_FALLBACK` 因 60-100s/回合的延迟问题，体验比 mock 差很多，已删。

### 7.3 IP rate limit + input sanitize（生产防护）

#### Rate limit · `lib/rate-limit.ts`

内存级（单实例 / 进程内有效，重启失效）。`POST /api/agents` 入口处对每个 IP：

```ts
const ip = getClientIp(req);
const rl = rateLimit(`agents:${ip}`, { windowMs: 60_000, max: 30 });
if (!rl.allowed) return 429 with Retry-After header;
```

30/min 够一个完整推演（14 次调用）+ 一些容错，能挡爬虫。

⚠️ 生产高流量请换 **Upstash Redis** / **Vercel KV** 跨实例共享。

#### Input sanitize · `lib/sanitize.ts`

intervene 是唯一接收用户自由文本的入口。两层清洗：

**客户端**（InterveneModal）：
- textarea `maxLength={80}`
- onChange 里 slice 强约束
- 实时字数计数 `n / 80`

**服务端**（route.ts intervene case）：

```ts
const r = strictSanitize(payload.userInputContent, { maxLen: 80 });
if (!r.ok) return 400 { error: "invalid_input", message: r.reason };
payload.userInputContent = r.text;
```

`sanitizeUserInput` / `strictSanitize` 做：
1. 长度截断（默认 80）
2. 去除控制字符（`\x00-\x08, \x0B-\x1F, \x7F`）
3. Prompt injection 检测（`ignore previous` / `system:` / `you are now` / DAN / 标签注入等），命中后返回 `ok:false`
4. 简单脏字过滤（`HARD_BLOCK` 数组，可按需扩展）

> 生产建议加：（1）二次过滤接 Anthropic moderation 或自建模型；（2）记录恶意输入到 audit log。

### 7.3 Prompt Caching

每次 SDK 调用都把 system prompt 标记 `cache_control: ephemeral`：

```ts
system: [
  { type: "text", text: system, cache_control: { type: "ephemeral" } } as any
]
```

- 第一次调用：full input token 价
- 5 分钟内同 system 再调用：input token 价 ×0.1，延迟下降 30-50%
- SDK 0.32.1 的类型不含 cache_control，运行时支持，用 `as any` 绕过

### 7.4 Mock 兜底（默认路径）

**当前部署默认走 mock**，因为：
- API key 没配 → 没有真 LLM 通道
- OAuth 被封 → SDK 直连不通
- CLI fallback 太慢（70-100s/回合），默认 disable

`lib/agents/mock.ts` 提供智能 mock：

- 10 个回合模板 × cold/warm 双分支 × delta jitter = ~20 个差异化产物
- 名字占位符 `{U}` `{T}` 自动替换为真实姓名
- `[COLD]xxx[WARM]yyy` 文本根据 `taAffection >= 50` 自动选择支路
- 读心按 taAffection 4 段分级（≤25 / 26-50 / 51-75 / >75），每段独立模板
- 介入根据 type (message/post/wait) + warm/cold 排列组合
- 终局根据 closeness tone（warm/neutral/cold）选 share card 调子

**响应时间**：~25ms（基本即时）。

**局限**：
- 10 个回合模板，超过 10 回合后会循环（但 round cap 是 10，正好用完）
- 内容深度不如真 LLM，但已经"看起来像真的"
- 共享对话池子有限，多次玩同一用户重复度高

---

## 8. 页面详解

### 8.1 `/` 首页 (`app/page.tsx`)

纯静态着陆页。视觉：暗夜紫底 + 玫瑰金标题 + 50 个随机粒子背景。
CTA：「开始捏 agent →」跳 `/setup`。
3 个特性卡片（基础信息 / 12 题养成 / 沙盘推演）。

### 8.2 `/setup` (`app/setup/page.tsx`)

4 个 Field：
1. 姓名（必填）
2. 生日（必填，date input，用于八字计算）
3. MBTI（选填，select）
4. ta 的代称（必填）

按钮 disable 直到必填项满足。点「下一步」调 `setBase` 然后 `router.push("/builder")`。

不在这里 init agents——交给 builder。

### 8.3 `/builder` (`app/builder/page.tsx`)

主交互：

- 顶部 sticky header：进度条 + Step 2 / 3 + N/12
- 中部：双 q 版头像（默认 110px，每答一题相应 hue 微调 + traits chip 累积）
- 下部：当前题（带 framer-motion 切题动画）+ 4 个选项按钮

每题选项 metadata（在 `lib/quiz.ts`）含可选的 `userTrait` 和 `taTrait`，答题时 `pushUserTrait` / `pushTaTrait` 加入 agent。

12 题答完显示「开始推演 →」，点击：
1. 调 `initRelationship()` 把 Q1 转成初始 RelationshipState
2. `setPhase("play")`
3. `router.push("/simulator")`

### 8.4 `/simulator` (`app/simulator/page.tsx`)

⭐ **核心页面**。包含**翻页 / 重玩 / prefetch / 介入 / 读心** 5 套交互。布局自上而下：

```
┌────────────────────────────────┐
│ Header: ← / Step 3/3 / N/10    │ sticky
├────────────────────────────────┤
│ SandboxHud                     │
│  双 agent 头像 + 亲密度条 + mood│
├────────────────────────────────┤
│ 进度指示器 (10 dots)            │
├────────────────────────────────┤
│                                │
│   单回合卡片                   │ ← 可左右滑动
│   (RoundDigest)                │ ← framer-motion drag="x"
│                                │
├────────────────────────────────┤
│ ← 上一回合 / 回合 X/Y / 推进 → │
│       介入  ·  读心 · N         │
└────────────────────────────────┘
```

**核心状态**：

```ts
const [currentPage, setCurrentPage] = useState(0);
const [slideDir, setSlideDir] = useState<1 | -1>(1);
const [phase, setPhase] = useState<LocalPhase>("idle");
const [peekResult, setPeekResult] = useState<PeekMindResult | null>(null);
const [showIntervene, setShowIntervene] = useState(false);

const MAX_ROUNDS = 10;
const isFirstPage = currentPage <= 0;
const isLastPage = currentPage >= rounds.length - 1;
const atRoundCap = rounds.length >= MAX_ROUNDS;
```

**翻页交互**：

- **手势**：framer-motion `drag="x"` + `onDragEnd`：偏移 > 60px 或速度 > 400px/s 触发翻页
- **按钮**：底部 ← / → 按钮 + 上方点击点
- **键盘**：（暂未实现，可加 keyboard listener for arrow keys）

**「下一回合」按钮的 contextual label**：

```ts
const nextLabel =
  !isLastPage     ? "下一回合"        // 中间页：纯翻页
  : atRoundCap    ? "看主预言卡"      // 10/10：跳 report
  :                 "推进时间";       // 最后页且未满：触发 advance
```

**新回合产生后**：`consumeRoundResult` 末尾自动 `setCurrentPage(rounds.length - 1)` 翻到新页。

**重玩本回合**：

`RoundDigest` 在 props 含 `onReroll` 时显示「🔄 不满意？重玩本回合」按钮。simulator 只在用户处于**最后一页 + 不 busy + rounds > 0** 时传入回调。

流程：
1. `popLastRound()` (store) 撤销最后一回合，反向应用 delta 回到上一回合的 stateAfter
2. `invalidatePrefetch()` 丢弃缓存（state 变了）
3. `setCurrentPage(p - 1)` 翻回上一页（视觉等待）
4. 短 toast「已撤销，重新推算中…」+ 400ms 后 `advance()` 重抽

**prefetch · 用户读当前页时偷偷跑下一回合**：

```ts
const prefetchRef = useRef<{ result: RoundEngineResult; basedOn: number } | null>(null);

useEffect(() => {
  // 翻到最后一页 + 还能推进 + 没在 busy + 没已缓存 → 后台跑
  if (isLastPage && rounds.length < MAX_ROUNDS && !busy && !prefetchRef.current) {
    void prefetchNextRound();
  }
}, [currentPage, rounds.length, phase]);
```

`prefetchNextRound` 调 `callRoundEngine` 拿结果后再校验 `useSimStore.getState().rounds.length === basedOn`——如果中间用户介入 / 撤销了，丢弃结果（state 不再匹配）。

`advance()` 优先用 `prefetchRef.current`（瞬时切换），否则 fetch。

`invalidatePrefetch()` 显式调用于介入 / 重玩前。

**真 LLM 场景下：** 用户读当前回合的 5-15 秒里，下一回合已经准备好。翻到下一页时几乎瞬时。Mock 模式下 25ms 本来就快，prefetch 是锦上添花。

### 8.5 `/report` (`app/report/page.tsx`)

- 顶部：**Share Card 主分享卡**（大尺寸渐变背景，title + prophecyLine + punchline 居中），用 `useRef` 标记 DOM，用于截图导出
- 「📸 保存为图片」**真实下载**（`html-to-image` 动态 import + 微信内置浏览器兜底用全屏 img 让用户长按保存）
- 「复制文案」按钮（`navigator.clipboard.writeText`）
- 下方折叠区：
  - 「写给你的 3 张镜子」→ 展开看 yourProjection / yourPosition / yourBlindSpot
  - 「关键转折点」→ KeyMoment 列表（按 |Δcloseness|+|ΔuserMood|+|ΔtaAffection| 排序取前 5）
  - 「N 个回合的状态轨迹」→ **3 维 SVG sparkline**：
    - 玫瑰金实线 = closeness（亲密度）
    - 紫色虚线 = userMood（你的状态）
    - 红色实线 = taAffection（**ta 的真实好感 · 终局揭晓**）
    - 这一刻是产品最戳的部分：用户回顾才发现 ta 这一整天在他/她看不见的地方变了这么多
- 底部：「换一对 agent 再来一次」（resetGame + 跳 /setup）

#### Share Card 导出图片细节

```ts
const { toPng } = await import("html-to-image");
const dataUrl = await toPng(shareCardRef.current, {
  cacheBust: true,
  pixelRatio: 2,
  backgroundColor: "#1a1a2e",
  style: { transform: "none" }, // 临时去掉 motion transform 防裁切
});
```

微信兜底逻辑：检测 `navigator.userAgent.includes("micromessenger")`，是的话生成一个全屏 img 让用户长按保存（微信内置浏览器不能直接触发下载）。

---

## 9. UI 组件

### 9.1 `QAvatar`

`components/avatar/QAvatar.tsx`。q 版头像：

- 接收 `name`, `hue`（0-360），`traits[]`, `side`（"left" | "right"）, `size`, `highlight?`
- 用 hue 计算 css `filter: hue-rotate(...)`
- 显示用户姓名 + 累积的 traits chip
- 头部偏左/右取决于 side
- highlight=true 时有 glow 动画

### 9.2 `SandboxHud`

`components/sandbox/SandboxHud.tsx`。沙盘顶部 HUD：

- 中央时间锚（"5/20 当前 · HH:MM"）
- 3 列布局：用户卡 / 亲密度条 / ta 卡
- 用户卡：QAvatar（54px）+ "状态" mood 条（可见，跟 userMood 动）
- 中间：亲密度条（spring 动画跟 closeness）+ 数字 "N/100"
- ta 卡：QAvatar + "心情" mood 条（**隐藏，显示 `? ? ? ? ?`**）

### 9.3 `RoundDigest`

`components/sandbox/RoundDigest.tsx`。单回合压缩卡：

- 头部：「Round N · HH:MM」+ 「✎ 你介入」标识（如果 intervened）
- 事件文本（font-serif，~13.5px）
- 双方动作摘要（"你→" / "ta→"）
- delta 标签（亲密 +N / 你的状态 +M + 一句话原因）
- **折叠按钮「▾ 展开对话（N）」**——点开看完整 beats（默认根据 defaultOpen prop）

beat 渲染分支：
- `message`：用户右气泡（蓝色 bubble-user），ta 左气泡（米色 bubble-crush）
- `typing_revoked`：撤回样式（删除线 + 灰 + "XX 撤回了一条"）
- `inner_flash`：右对齐斜体灰字（"※ ..."）

### 9.4 `PeekMindModal` / `InterveneModal`

`components/sandbox/PeekMindModal.tsx` / `InterveneModal.tsx`。

都是底部弹起浮层，`max-w-md`，含 safe-area inset。

- **PeekMindModal**：4 个分区展示 taMoodLabel / taAttitude / innerMonologue / userBlindSpot + 「回到沙盘」按钮
- **InterveneModal**：3 个 action type 选项卡（私聊/朋友圈/不动）+ textarea + 「发出 →」

---

## 10. 设计原则（防小说化）

这套产品最容易掉进的坑：LLM 输出像微小说，不像真聊天。所有 prompt 都有强约束防止。

### 10.1 硬约束清单

```
❌ 不要旁白叙事（"窗外有风" / "雨敲玻璃" 这种）
❌ 不要 takeaway / 文评 / 总结
❌ 不要让 user / ta 节奏过于协调
❌ ta 不能输出 inner_flash（黑盒原则）
❌ 不要硬塞"心动瞬间"（剧作公式化）
❌ punchline 不含 ta 真名（普适化）
✅ 用户能 1-3 个 inner_flash 但克制
✅ 一回合 9-12 beat，5 轮真实来回
✅ ta 可以"已读不回"但不是整段沉默
✅ 双方话符合 traits + 隐藏状态
✅ delta reason 是因果，不是文评
```

### 10.2 5 轮对话节奏

每个回合应该长这样：

```
1. user inner_flash（情境感受）
2. user message ↓ ⎫
3. ta message   ↑ ⎬ turn 1
4. user message ↓ ⎫
5. ta message   ↑ ⎬ turn 2
6. user message ↓ ⎫
7. ta typing_revoked  ⎬ turn 3（带犹豫细节）
8. ta message ↑
9. user message ↓ ⎫
10. ta message ↑ ⎬ turn 4
11. user message ↓ ⎫
12. ta message ↑ ⎬ turn 5
13. user inner_flash（结尾沉淀）
```

mock 模板每个都按这个结构。LLM prompt 也明确要求。

### 10.3 cold / warm 分支

`taAffection >= 50` 走 warm，否则走 cold。

差别在 ta 的 message 内容上：

```
{ role: "ta-agent", kind: "message",
  content: "[COLD]嗯。[WARM]嗯，你也是？" }
```

替换函数 `fillTemplate(s, userName, taName, isWarm)`：
- `[COLD]xxx[WARM]yyy` → 根据 isWarm 选一边
- `{U}` `{T}` → 用户和 ta 的真实姓名

---

## 11. 手机适配规范

### 11.1 viewport meta

`app/layout.tsx`：

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1a2e",
  viewportFit: "cover",
};
```

### 11.2 globals.css

- `body { touch-action: manipulation }` 禁双击放大
- `-webkit-tap-highlight-color: transparent` 关掉点击高亮
- `input, textarea, select { font-size: 16px }` 防 iOS 自动放大
- `body { padding-bottom: env(safe-area-inset-bottom) }` 留底部安全区

### 11.3 触控热区

所有 button 至少 44pt 高（py-3 = 12+12+24line-height ≈ 48pt）。
带 `active:scale-95` 提供触控反馈动画。

### 11.4 sticky 底部 + safe area

`app/simulator/page.tsx` 底部行动栏：

```tsx
<div
  className="sticky bottom-0 glass border-t..."
  style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
>
```

避免 iPhone Home Indicator 遮挡。

### 11.5 LAN 测试

`package.json:scripts.dev = "next dev --hostname 0.0.0.0"`。

手机和 Mac 在同一 WiFi，访问 `http://<mac-lan-ip>:3000`。

---

## 12. API 详解

### 12.1 endpoint

`POST /api/agents` (`app/api/agents/route.ts`)

```json
{
  "agent": "round-engine" | "peek-mind" | "intervene" | "relationship-summary",
  "payload": { ... }
}
```

### 12.2 各 case 的 payload

#### round-engine

```ts
{
  base: BaseProfile,
  userAgent: AgentForm,
  taAgent: AgentForm,
  state: RelationshipState,
  prevRounds: RoundEvent[],
  hint?: string,
  images?: string[]      // data: URL base64
}
```

#### peek-mind

```ts
{
  base, userAgent, taAgent, state, prevRounds
}
```

#### intervene

```ts
{
  base, userAgent, taAgent, state, prevRounds,
  userInputType: "message" | "post" | "wait",
  userInputContent: string
}
```

#### relationship-summary

```ts
{
  base, userAgent, taAgent,
  rounds: RoundEvent[],         // 全部
  finalState: RelationshipState
}
```

### 12.3 fallback 链与 schema 验证

每个 case 的处理流程：

```ts
1. 无 backend → 返回 mock with { mock: true }
2. callLLM (SDK + cache_control)
3. tryParseJson → schema validate
4. schema 失败 → 返回 mock with { mock_fallback: true }
5. 校验通过 → 返回 LLM 输出
```

外层 try/catch 兜底任何抛错。`mock` / `mock_fallback` 字段供前端调试用，不影响渲染。

### 12.4 调试用 curl 例子

```bash
PAYLOAD='{
  "base": {"name":"小满","birthday":"1998-03-15","mbti":"INFJ","taName":"阿哲"},
  "userAgent": {"name":"小满","traits":["想被接住"],"hue":340},
  "taAgent": {"name":"阿哲","traits":["高冷边界感"],"hue":210},
  "state": {"closeness":58,"userMood":55,"taAffection":62,"taMood":55},
  "prevRounds": []
}'

curl -s -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"round-engine\",\"payload\":$PAYLOAD}"
```

---

## 13. 环境变量

| 变量 | 默认 | 用途 |
|------|------|------|
| `ANTHROPIC_API_KEY` | （空） | 真实 API key，第一优先级 |
| `ANTHROPIC_AUTH_TOKEN` | （空） | OAuth token，已被 Anthropic 封 |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | 默认模型（仅 fallback 用） |

`.env.local` 模板：

```
# 优先方案：申请真实 API key
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-5

# 不设以上则走智能 mock（默认 + 即时响应）
```

---

## 14. 部署考虑

### 14.1 Vercel 部署

- `npm run build && npm run start`
- 环境变量在 Vercel Dashboard 配
- 注意：默认 build 会 statically analyze 所有 page；动态部分（`/api/agents`）会作为 serverless function

### 14.2 共享给他人测试

⚠️ **不能简单 git 给别人 + npm run dev**——因为 mock 模式只够本人测，需要真 API key 才能生成个性化推演。

要让别人用，**必须**有 ANTHROPIC_API_KEY 配在 server 端：

1. Vercel / Fly / Railway 部署，env 设 API key
2. 给用户公网链接

或者部署到内网 + 反代 + 单一共享 key。

### 14.3 PWA / 添加到主屏幕

`public/manifest.json` + `app/layout.tsx` metadata 已配。iOS Safari / Android Chrome 用户访问后可"添加到主屏幕"，启动后全屏无浏览器 chrome，体验接近原生 app。

图标在 `public/icons/` 是 SVG，部署到 vercel 时自动 served。

```json
{
  "name": "心动模拟器 · AI Love-Lab",
  "short_name": "心动模拟器",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1a1a2e",
  ...
}
```

### 14.4 Rate limit 在多实例场景

`lib/rate-limit.ts` 是**内存级**——Vercel serverless 跨 invocation / 跨 region 不共享。生产高流量必须换：

- **Upstash Redis**（serverless friendly）
- **Vercel KV**（同 Vercel 集成最快）
- **@upstash/ratelimit** 库（成熟，封装好滑动窗口）

切换只需替换 `lib/rate-limit.ts` 内部实现，对外接口保持不变。

### 14.3 成本估算

按 Haiku 4.5 定价（input $0.80/M / output $4/M）：

- 单回合 round-engine：~3K input + 1K output = ~$0.0064 ≈ ¥0.045
- 单读心 peek-mind：~2K input + 500 output = ~$0.0036 ≈ ¥0.025
- 单介入 intervene：~3K input + 1.2K output = ~$0.0072 ≈ ¥0.050
- 单终局 relationship-summary（sonnet $3/$15 per M）：~5K input + 1.5K output = ~$0.038 ≈ ¥0.27

完整 10 回合一局（10 round + 3 peek + 2 intervene + 1 final）：
- input：~50K tokens
- output：~15K tokens
- 综合 ≈ ¥0.8-1.2 / 局

加 prompt caching 后大约能省 30-40%。

---

## 15. 已知限制 / 未来扩展点

### 15.1 当前的"妥协"

| 项 | 现状 | 想做 |
|----|-----|------|
| LLM 真实推演 | 没有 API key 时走 mock | 部署时务必配 API key |
| OAuth 借用订阅 | 被 Anthropic 永久封 | 死路，别再尝试 |
| 多模态 | 完全不支持（user 端 image upload 没有 UI） | 后期补上聊天截图上传 |
| 账号体系 | 没有，全在 localStorage | 后期接微信登录 + 后端持久化 |
| 分享卡截图导出 | ✅ html-to-image 真实下载 + 微信兜底 | done |
| 数据埋点 | 完全没有 | 加 Plausible / Umami / 自建几行 |
| 国际化 | 全中文硬编码 | 多语言后期 |
| Mock 多样性 | 10 个模板 × cold/warm × jitter = ~20 变体 | 扩到 30+ 模板，按 state 更精细分支 |
| Rate limit | ✅ 内存级 30/min（单实例 demo 够） | 多实例换 Upstash Redis |
| Input sanitize | ✅ 客户端 80 字 + 服务端 strict sanitize | 接 moderation API 二次过滤 |

### 15.2 架构层面想做但没做

- **streaming UI**：当前 LLM 调用是非流式，用户看到 typing 动画但实际是一次性等完。改成 SSE 流式后单回合体感能从"等 5 秒"变成"逐步呈现"
- ~~**prefetch 下一回合**~~ ✅ 已实现（见 §8.4）
- **真正的 traits → behavior 映射**：现在 traits 只是字符串拼到 prompt 里。可以做成"高冷边界感"→ 后端规则 `{ maxReplyLength: 8, initTopicProb: 0.1 }` 这样的具身化规则，让 mock 也能精细呼应 traits
- **moderation 链路**：sanitize 是规则级。复杂的内容审核（暴力 / 政治 / 仇恨）建议接 Anthropic 自家 moderation 或 OpenAI moderation 做二次过滤
- **持久化 prefetch**：用户翻回前面页面时，prefetch 的"下一回合"仍保留在 useRef。如果用户刷新或换页，会丢失。可以 persist 到 sessionStorage

### 15.3 命盘恋语联动（产品矩阵层面）

参考 `命盘恋语×心动模拟器_产品矩阵PRD_v1.0.md`：
- 命盘恋语作为前端引流，输出 8 型档案
- 档案直接成为 User-Mirror 的初始化参数
- 双人配对升级为双向沙盘

但 ai-love-lab demo 还没接入命盘恋语侧。需要：
- 新建 `/api/profile-import` endpoint 接收命盘档案
- store 加 `userArchetype` 字段（"逃跑式" / "草稿箱式" 等）
- builder 页加判断：如果已带档案就跳过部分问卷
- round-engine prompt 引用 archetype

---

## 16. 关键文件速查表

| 想改什么 | 改哪里 |
|---------|-------|
| 12 题问卷题目 / 选项 | `lib/quiz.ts` |
| 关系阶段映射到初始 state | `lib/store/simulation-store.ts:deriveInitialRelationship` |
| 加新维度到 RelationshipState | `lib/types.ts` + `lib/store` + 各 agent prompt |
| round-engine 的硬约束 / 5 轮要求 | `lib/agents/round-engine.ts:ROUND_ENGINE_SYSTEM_PROMPT` |
| 读心揭示的内容结构 | `lib/agents/peek-mind.ts` + `components/sandbox/PeekMindModal.tsx` |
| 终局 share card 的话术 | `lib/agents/relationship-summary.ts:RELATIONSHIP_SUMMARY_SYSTEM_PROMPT` |
| Mock 模板（无 API key 时的内容） | `lib/agents/mock.ts:ROUND_TEMPLATES` |
| 翻页交互逻辑 | `app/simulator/page.tsx:goNext / goPrev / handleDragEnd` |
| 10 回合上限 | `app/simulator/page.tsx:MAX_ROUNDS` 常量 |
| 重玩本回合的 UX | `app/simulator/page.tsx:rerollLastRound` + `RoundDigest:onReroll` prop |
| Prefetch 策略 / 失效条件 | `app/simulator/page.tsx:prefetchNextRound + invalidatePrefetch` |
| share card 视觉 | `app/report/page.tsx`（`#share-card` 节区） |
| share card 导出图片格式 | `app/report/page.tsx:handleSaveImage`（`toPng` 参数） |
| 微信浏览器兼容 | `app/report/page.tsx:showInWechatViewer` |
| 状态曲线维度 / 颜色 | `app/report/page.tsx:Trajectory` |
| 关键转折点排序逻辑 | `lib/agents/mock.ts` 和 `relationship-summary.ts:keyMoments` |
| 8 型恋爱模式接入（未来） | 新建 `lib/archetypes.ts` + 改 round-engine prompt |
| 添加新 agent | `lib/agents/*.ts` 新文件 + `lib/engine.ts` 加 callXxx + `route.ts` 加 case |
| 改首页文案 / CTA | `app/page.tsx` |
| 隐私声明内容 | `app/legal/privacy/page.tsx` |
| 八字算法 | `lib/bazi.ts`（基于 lunar-javascript） |
| 手机适配 padding / 字号 | `app/globals.css` + 各 page 的 `sm:` 响应式 class |
| **Rate limit 上限 / 切 Redis** | `lib/rate-limit.ts` |
| **Input sanitize 规则 / 脏字表** | `lib/sanitize.ts:INJECTION_PATTERNS / HARD_BLOCK` |
| **PWA manifest** | `public/manifest.json` + `app/layout.tsx:metadata` |

---

## 17. 调试技巧

### 17.1 看后端日志

```
nohup npm run dev > /tmp/ai-love-lab-dev.log 2>&1 &
tail -f /tmp/ai-love-lab-dev.log
```

关键日志：

```
[auth] using Claude Code OAuth token from macOS keychain (subscriptionType: max)
[llm] OAuth token rejected by Anthropic API (403). All subsequent calls will use smart mock.
[round-engine] schema fail. raw[:400]= ...
POST /api/agents 200 in 145ms
```

### 17.2 看前端 store 状态

打开浏览器 devtools，console 执行：

```js
JSON.parse(localStorage.getItem("ai-love-lab-sim"))
```

看完整 SimulationState。

### 17.3 reset 状态

```js
localStorage.removeItem("ai-love-lab-sim");
location.reload();
```

或直接走到 `/report` 页点「换一对 agent」。

### 17.4 强制走 mock 测试

不配 API key 即可。或临时在 `lib/auth.ts:getAnthropicCredential()` 顶部 return `{source:"none"}` 跳过所有真实路径。

### 17.5 强制走 CLI 测试

```bash
ALLOW_CLI_FALLBACK=1 npm run dev
```

注意单回合会 60-100s，仅用于验证 LLM prompt 在真实模型下的输出质量。

---

## 18. 测试用例（手动）

### 用例 1：完整跑通

1. `/` → 「开始捏 agent →」
2. `/setup` → 填："小满" / "1998-03-15" / "INFJ" / "阿哲" → 「下一步」
3. `/builder` → Q1 选 B（高度暧昧）→ 答完 12 题 → 「开始推演」
4. `/simulator` → 点「推进时间」5 次 → 看到 5 个回合
5. 中间点「读心」一次，看 peek modal 内容
6. 中间点「介入」一次，type=message + 内容 "今晚出来吃饭" → 看新回合
7. 翻到第 1 页，再翻回最后一页，验证翻页流畅
8. 点「看主预言卡」→ 看 /report
9. 验证 share card 不含 ta 真名「阿哲」

### 用例 2：10 回合上限

1. 跑到 10 个回合后：
   - 「推进时间」按钮自动变成「看主预言卡」
   - 「介入」按钮变灰
   - 推进按钮点击直接跳 /report

### 用例 3：冷状态轨迹

1. setup → 同样输入
2. Q1 选 D（断联期）→ 初始 closeness=14, taAffection=30
3. 推进几次看 ta 反应是否明显冷淡（应该多 "嗯。" "没回"）
4. 读心应该显示 "在抽离" 或 "想退一步"

### 用例 4：手机访问

1. Mac 跑 `npm run dev`（已绑 0.0.0.0）
2. 取 LAN IP：`ipconfig getifaddr en0`
3. 手机同 WiFi 访问 `http://<lan-ip>:3000`
4. 验证：
   - 所有页面正确响应（HTTP 200）
   - 触控按钮 ≥44pt
   - 沙盘 HUD 不挤压
   - 卡片左右滑动流畅
   - safe-area 不被 home indicator 遮挡

---

## 19. 联系 / 维护

- 当前实现状态：MVP（demo 可用，未部署生产）
- 下一步关键工作：
  1. 配真实 ANTHROPIC_API_KEY 并部署到 Vercel
  2. 加微信账号体系（实现矩阵 PRD 中的"账号前置"目标）
  3. 接入命盘恋语 8 型档案（实现真正矩阵闭环）
  4. moderation API 二次过滤 / 多实例 rate limit 换 Redis

文档维护：每次架构层改动（特别是 Agent / 数据模型 / 状态机）后更新对应章节。

---

## 附录：v1 → v2 变更日志（2026-05-12）

| 类别 | 变更 |
|------|------|
| Bug | `keyMoments` 排序破坏修复（之前 `parseInt(impact)` = NaN 导致排序失效，改为按 \|Δcloseness\|+\|ΔuserMood\|+\|ΔtaAffection\| 总和排序） |
| 首页 | 主标题从「捏两个 agent / 让 AI 看看你们会怎样」改为「你心里那个人，今天会发消息吗？」；CTA 从「开始捏 agent」改为「让 AI 演一次」 |
| 移除 | 删除 `lib/cli-llm.ts` 及所有 `ALLOW_CLI_FALLBACK` 引用（CLI 60-100s/回合体验比 mock 还差） |
| 新增 | 「重玩本回合」按钮（`popLastRound` action + RoundDigest `onReroll` prop） |
| 新增 | 报告页**3 维状态曲线**（closeness 实线 / userMood 紫虚线 / taAffection 红线·终局揭晓） |
| 新增 | Prefetch 下一回合（用户读当前页时后台跑，介入/撤销后失效） |
| 新增 | `lib/sanitize.ts` + 客户端 80 字上限 + 服务端 strictSanitize（含 prompt injection 检测） |
| 新增 | 朋友圈 vs 私聊在 ta 反应上的真实差异（post 类型用「隔几小时点赞」「单独发截图」等延迟+广播感反应） |
| 新增 | 「再读一次」按钮（PeekMindModal 内联，避免关闭再打开） |
| 新增 | 介入产生的回合**金边 + 角标**视觉强化 |
| 新增 | `html-to-image` 真实导出 share card 为 PNG（+ 微信浏览器全屏 img 兜底） |
| 新增 | PWA manifest + SVG 图标（"添加到主屏幕"） |
| 新增 | `lib/rate-limit.ts` + 30/min IP 上限（已由 ops 视角加入 route.ts） |
| 新增 | `app/legal/privacy/` 隐私声明路由（首页底部链接） |
| 新增 | setup 页 ta 代称 field 加「⚠️ 请用代称，勿填真名 / 电话 / 工作单位」隐私提示 |
