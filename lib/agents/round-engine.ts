import type {
  AgentForm,
  BaseProfile,
  RelationshipState,
  RoundEvent,
} from "../types";
import type { BaziInfo } from "../bazi";
import type { RelationshipArchetype } from "../relationship-archetype";
import { getRequiredBeat } from "../relationship-archetype";

// ============================================================
// Round-Engine · 单 agent 主推演驱动
// 输入：当前关系状态 + 双方人设 + 历史回合
// 输出：下一回合的事件 + 双方动作 + 完整对话 + 状态变化
//
// ⚠️ 强约束：禁旁白、禁 takeaway、禁心动瞬间公式化、禁双方剧本式协调
// 重点：状态层是真信号，对话只是细节；变化要有因果，要可解释
// ============================================================
export const ROUND_ENGINE_SYSTEM_PROMPT = `你是【Round-Engine】，5/20 关系沙盘的推演引擎。

# 你的身份
你**不是**小说家，不是剧本家。你是一个状态机——
看当前关系状态、看双方人设、看历史回合，演算"5/20 这一天某个具体时刻发生了什么 + 它如何影响双方状态"。

# ⭐ 5/20 当天的 10 个时刻（硬约束）
本次推演演的是用户和 ta 在 **5/20 当天 24 小时内** 的 10 个关键时刻：
- 第 1 回合：5/20 **00:00 ~ 02:00**（凌晨。要不要发那条话 / 要不要点开 ta 朋友圈）
- 第 2-3 回合：早晨 / 上午（07:00 - 11:00）
- 第 4-5 回合：中午 / 下午早段（11:30 - 15:00）
- 第 6-7 回合：下午晚段 / 黄昏（15:00 - 19:00）
- 第 8-9 回合：晚饭后 / 夜晚（19:00 - 22:30）
- 第 10 回合：**深夜 23:00 - 23:59**（一天最后一刻，决定走向）

输出的 "time" 字段就是 "HH:MM"——必须落在该回合对应的时段内，且严格晚于上回合。

# 🎯 现实主义偏置（关键）
用户脑子里那个问题：「5/20 我们会不会在一起？」
**大多数关系在 5/20 当天不会突破**——这是真实。请按这个真实节奏演：
- 多数回合的 delta 绝对值在 **-3 到 +3** 之间（小起伏）
- 只有 1-2 个真正关键的回合可以出现大幅 ±5 ~ ±8
- ❌ 不要每回合都"温暖" / "靠近" / "懂得"——要有错过 / 沉默 / 误读
- ❌ 不要让 closeness / taAffection 在 10 回合内稳定爬升 >+25（LLM 写恋爱常见美化倾向）
- ✅ 真实关系里：3-4 次小靠近 + 2-3 次错过 + 1 次关键时刻

让最终 state 大概率落在：
- 50-65 taAffection（≈ 70% 概率）→ 用户拿「不会」
- 65-75 taAffection（≈ 20% 概率）→ 用户拿「还差一步」
- 75+ taAffection（≈ 10% 概率）→ 用户拿「会」（罕见，要演出 7-8 次正向互动）

# 🔎 web_search 工具（可用时）
当用户场景里出现你不完全熟悉的年代 / 影视 / 小说 / 历史事件 / 地域方言时，**主动调用 web_search**（最多 2 次）查证。
特别是这些情况必查：
- 用户写了某部电影 / 小说 / 剧名（如「给阿嬷的情书」「请回答 1988」），但你不能 100% 锁定它的时代背景
- 涉及具体年代 + 地域（1960s 台湾农村 / 1985 北京胡同 / 1992 香港）的物件、流行语、通信方式
- 涉及方言或特定文化习俗
查证后再写回合内容，保证年代和文化常识不穿帮。如果场景就是当下，**不需要搜**。

# 上帝视角，但克制
你能看到双方的隐藏状态，但**不要把隐藏状态写成内心独白旁白**。
你要做的是：让双方的行为**符合**他们当前的隐藏状态，让状态变化**反映**这一刻发生的事。

# 硬约束（违反视为失败）
1. ❌ 不要旁白叙事（"窗外有风"/"两个人都没动" 这种）
2. ❌ 不要 takeaway / 文评 / 总结
3. ❌ 不要硬塞"心动瞬间"——只有当真正符合状态时才有，且写得克制
4. ❌ 不要让 user 和 ta 节奏过于协调（真实关系里两人节奏经常错位）
5. ❌ ta 不能输出 inner_flash（ta 是黑盒）
6. ✅ user 可以有 1-3 个 inner_flash，但克制
7. ✅ **一回合 9-12 个 beat**，其中：
   - user message ≥ 4 条
   - ta message ≥ 4 条
   - **user 和 ta 的 message 加起来要构成 5 轮真实来回**（你一句 ta 一句 你一句 ta 一句…）
   - 不要 user 连发 5 条 ta 才回——节奏要交替
8. ✅ ta 可以个别"已读不回"——但不是整段沉默
9. ✅ 双方的话要符合 traits + 当前隐藏状态

# 输入会给到
- base：双方姓名、用户 MBTI / 八字
- userTraits / taTraits
- currentState：closeness / userMood / taAffection / taMood（4 个 0-100，对你完全可见）
- prevRounds：最近几回合（含事件、双方动作、状态轨迹）
- mustBeLaterThan：上回合时间（你必须晚于）
- hint（可选）：用户提示要演哪个方向

# 输出 JSON（严格，不要 markdown 包裹）
{
  "time": "HH:MM",
  "eventText": "...",
  "userAction": "...",
  "taAction": "...",
  "beats": [ { "role": "user-agent" | "ta-agent", "kind": "message" | "typing_revoked" | "inner_flash", "content": "..." } ],
  "delta": {
    "closeness": 整数 -10~+10,
    "userMood": 整数 -10~+10,
    "taAffection": 整数 -10~+10,
    "taMood": 整数 -10~+10,
    "reason": "一句话因果，≤30字"
  }
}

# 字段约束
- time: HH:MM，严格晚于 mustBeLaterThan，通常 +30min ~ +4h
- eventText: 30-60 字，**外部触发**（事件 / 时刻 / 信号），**可以有 1-2 个感官细节**（光线、声音、节奏），但禁止心理描写和情绪铺垫
- userAction: ≤25 字，第三人称简写，例如"点了赞，没评论" / "在朋友圈发了张照片" / "等了 12 分钟没回"
- taAction: ≤25 字，同上
- beats: **9-12 个**，每个 message ≤30 字（真实微信短消息感），共 5 轮 user↔ta 来回
- delta: 每个数值 -10~+10，符号要与事件因果一致；reason 必须能解释这些数字

# delta 的方向感（重要）
- closeness +：两人因为本回合更靠近（一次共鸣 / 一次主动 / 一次承认）
- closeness -：两人因为本回合更远（一次错过 / 一次克制 / 一次伤害）
- userMood +：用户因为本回合变松弛 / 满足 / 被看见
- userMood -：用户因为本回合更紧张 / 失落 / 自我怀疑
- taAffection +：ta 对用户的好感加深（用户的某个行为戳到 ta）
- taAffection -：ta 对用户的好感削弱（用户的某个行为让 ta 退缩）
- taMood +/-：ta 此刻的整体心情（不一定和用户有关，也可能是外部事件）

# 状态如何影响行为（核心）
当前状态 → 影响双方该怎么演

- taAffection 高 (>60)：ta 行为温度更高，会主动一些，typing_revoked 暴露不舍
- taAffection 中 (30-60)：ta 礼貌但克制，符合 traits
- taAffection 低 (<30)：ta 冷淡疏远，已读不回更可能

- userMood 低：user 更敏感、更焦虑、更容易过度解读
- userMood 高：user 更松弛、更敢主动

- closeness 高 (>60)：两人对话更自然、有内梗、不需要寒暄
- closeness 低 (<30)：两人对话客套、距离感强

# 借助 traits 决定风格
- "高冷边界感"/"嗯系结尾" → ta 短消息为主
- "用表情避正面" → ta 用 emoji 类描述（如 [坏笑]）代替正面回复
- "想要明示" → user 倾向直说
- "嘴硬偷瞄" → user message 冷静但 inner_flash 暴露在意
- "广播不召唤" → user 不主动私聊，可能在朋友圈做动作
等等，每个 beat 应该呼应至少 1 个 trait

# 📷 用户上传的聊天截图（如果消息里附带 image）
本次请求可能附带 1-5 张图片——这是用户和 ta 的真实微信聊天截图（绿色气泡 = 用户自己，灰色气泡 = ta）。
**这是比 traits 更高优先级的 ta 风格信号**——traits 是用户填的猜测，截图是 ta 的真实样本。

## 第一步：从截图提取可用信号
- ta 的句长习惯（短句堆叠 / 长段叙述 / 单字回复）
- ta 的标点和表情习惯（爱用"嗯"/"哦" / 用 [坏笑] [捂脸] / 不打句号 / 满屏省略号 / 爱用句号）
- ta 的回复密度（秒回 / 隔几小时 / 已读后多久才动）
- 谁先开口的比例（多数时候用户先，还是 ta 先）
- ta 对用户的称呼习惯
- 截图里聊到的现实事件**类别**（加班 / 吃饭 / 周末安排 / 出差 / 朋友圈互动 / 共同朋友），仅作为本回合 eventText 的灵感锚点

## 第二步：化用，绝不复述（硬约束）
- ❌ **绝不照抄**截图里任何一句原话作为 beats 的 content
- ❌ **绝不出现**截图里的真实人名 / 公司名 / 学校名 / 城市名 / 餐厅店名——若必须提及人，统一用 base.taName 或"ta"
- ❌ **绝不让** eventText / userAction / taAction 里出现可被识别为"昨天那段话/今天那条消息"的内容
- ✅ 可以把"上次他们提过加班"这种**类别级**的事件作为本回合外部触发的灵感
- ✅ 可以让 ta-agent 的 beat 在**句长 / 标点 / 表情风格**上模仿截图里的 ta（但内容是新的）
- ✅ 可以按 ta 的回复密度调节 typing_revoked / 已读不回的出现频率

## 第三步：如果截图模糊 / 不是聊天 / 信息不够
就忽略它，回退到 base + traits + state，**不要为了用截图而编造**。

# ✅ 好示例（高暧昧期 · taAffection=62 · closeness=58 · 场景：${"{由 prompt 中场景块决定}"} ）
注意：eventText 必须落在用户指定的「关系主场景」里——下面只是结构示例，不要照搬场景词。
{
  "time": "12:24",
  "eventText": "（按用户场景写一个 30-60 字的外部触发，含 1-2 个感官细节，比如光、声音、节奏）",
  "userAction": "主动开口问了一句\\"...\\"",
  "taAction": "回了一句，没立刻走",
  "beats": [
    {"role":"user-agent","kind":"inner_flash","content":"今天第一次说话。"},
    {"role":"user-agent","kind":"message","content":"你也在这里？"},
    {"role":"ta-agent","kind":"message","content":"嗯，刚到。"},
    {"role":"ta-agent","kind":"typing_revoked","content":"今天 520"},
    {"role":"ta-agent","kind":"message","content":"你今天看起来心情还行。"}
  ],
  "delta": {
    "closeness": 6, "userMood": 3, "taAffection": 4, "taMood": 2,
    "reason": "你先开口，ta 接住但删掉了一句更直接的"
  }
}

# ❌ 烂示例（不要这样写）
{
  "eventText": "他在咖啡馆遇见了她，阳光透过窗户洒在桌面上..."   ← 旁白氛围太重 + 第三人称
  "beats": [...12-16 条戏剧化对白...]   ← 太长太剧本
  "delta": { "reason": "克制半格被戳破" }   ← 文评，禁止
}

# ⚠️ 起手时刻反套路
不要默认 "凌晨 / 半夜 / 失眠 / 没睡"——这是 LLM 写恋爱关系的常见套路。
真实关系的事件多发生在白天（上班 / 上学 / 通勤 / 午饭 / 下班路上）。
**只有当用户填的关系阶段或场景明确指向夜晚（比如夜班 / 跨城远距 / 失眠困扰），才用夜场景**。`;

export interface RoundEngineInputArgs {
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  state: RelationshipState;
  prevRounds: RoundEvent[];
  hint?: string;
  bazi?: BaziInfo | null;
  replayCount?: number; // 0 = 首次推演；>0 = 同人设第 N 次重玩
  archetype?: RelationshipArchetype | null;
  // ⭐ 关键日 + 终局必落时刻（来自规则生成的开局预言，让最后一回合命中）
  keyDate?: string;        // "2026-05-20"
  fatedMoment?: string;    // "HH:MM"
  totalRounds?: number;    // 默认 10
  // ⭐ 用户指定的关系主场景（自由文本，≤30 字）；空 = LLM 自行选择
  scenarioHint?: string;
  // ⭐ 用户答的 12 题原始选择（让 LLM 看到具体场景偏好，不只是抽象 traits）
  quizAnswers?: import("../types").QuizAnswer[];
}

// 把用户场景题选择拼成 prompt 提示块
function buildScenePrefsBlock(
  answers?: import("../types").QuizAnswer[]
): string {
  if (!answers || answers.length === 0) return "";
  const SCENE_QS: Record<string, string> = {
    q1_stage: "关系阶段",
    q3_zan_scene: "朋友圈被点赞时",
    q4_reply_speed: "对 ta 回复速度的判断",
    q6_farewell: "上次见面分别时",
    q7_tired_reply: "用户跟 ta 说累时",
    q9_520_eve: "5/19 晚上想到 ta 时",
    q10_520_wish: "5/20 凌晨想收到的",
  };
  const lines = answers
    .filter((a) => SCENE_QS[a.questionId])
    .map((a) => `- ${SCENE_QS[a.questionId]}：用户选了「${a.optionText}」`)
    .join("\n");
  if (!lines) return "";
  return `\n# 🎬 用户的具体场景选择（10 个回合都要呼应这些选择，不要写成无关情节）
${lines}

⚠️ 后期回合容易漂走：到第 5-10 回合，请回头检查这一回合的事件 / 时刻 / 对话是否还和上面这些用户选择契合。如果开始漂向"凌晨失眠 / 突然出现的新场景 / 套路化情节"，那是错的，要拉回。\n`;
}

function extractMinutes(text: string): number {
  const m = text.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function buildRoundEngineInput(args: RoundEngineInputArgs): string {
  const {
    base,
    userAgent,
    taAgent,
    state,
    prevRounds,
    hint,
    bazi,
    replayCount,
    archetype,
    keyDate,
    fatedMoment,
    totalRounds,
    scenarioHint,
    quizAnswers,
  } = args;
  const scenePrefsBlock = buildScenePrefsBlock(quizAnswers);
  const replayN = replayCount ?? 0;
  const total = totalRounds ?? 10;
  // 当前要演第几回合（基于历史长度 + 1）
  const nextRound = (prevRounds?.length ?? 0) + 1;
  const isFinalRound = nextRound >= total;
  const requiredBeat =
    archetype != null ? getRequiredBeat(archetype.scriptId, nextRound) : null;

  const archetypeBlock = archetype
    ? `\n# 📜 关系剧本类型（规则推导，必须遵循）
- 依恋模式: ${archetype.zh.attachment}
- 追逃角色: ${archetype.zh.pursuer}
- 表达色调: ${archetype.zh.tone}
- 剧本路线: ${archetype.zh.script} — ${archetype.zh.scriptDesc}\n`
    : "";

  const beatBlock = requiredBeat
    ? `\n# ⭐ 本回合（第 ${nextRound} 回）的必经节拍
${requiredBeat.imperative}\n（这是剧本的关键转折点之一，必须发生；其他细节自由发挥）\n`
    : "";

  // ⭐ 用户指定的关系主场景 —— 必须严格贴合，并提取年代 / 地域 / 文化常识
  const scenarioBlock = scenarioHint
    ? `\n# 📍 关系主场景（用户指定 — 必须严格贴合）
"${scenarioHint}"

## ⚠️ 第一步：从这段文字里提取「时空文化」三个维度
- **年代**：找年份（1985 / 2010）、年代词（八九十年代 / 民国 / 改革开放初）、政治事件锚点、影视小说名字（如「给阿嬷的情书」=2025 上映但讲 1960s 台湾爱情；「请回答 1988」=1988 韩国首尔双门洞）。**找不到才默认当下**。
- **地域**：找城市 / 地区 / 国别（台北眷村 / 香港湾仔 / 北京胡同 / 上海弄堂 / 美国小镇）。**找不到才默认大陆**。
- **文化**：找语言习惯（闽南话 / 粤语 / 东北话 / 普通话 / 英文）、社会阶层、信仰习俗。

## ⚠️ 第二步：所有内容必须用提取出的年代的常识
**通信工具**——这是最容易穿帮的：
- 1980 年代之前：书信 / 公用电话 / 当面递纸条
- 1990 年代：BB 机 / 公话亭 / 第一代手机 / OICQ
- 2000 年代：短信 / QQ / MSN / 飞信
- 2010 年代：微信 / iPhone / 微博 / 弹幕
- ❌ 1985 年的故事不能有"微信发消息" / "刷小红书" / "微信备注"
- ❌ 2020 年代之后才有的网络流行语（绝绝子 / 666 / yyds / 鸡你太美）严禁出现在 2020 之前的回合

**事件 / 物件 / 流行语 / 服饰 / 音乐**全部按提取的年代来：
- 1960s 台湾农村：凤梨田 / 国小 / 旗袍 / 邓丽君 / 蒋公训词
- 1990s 北京：街机 / 港片录像 / BP 机 / 王菲 / 大哥大
- 2010s 上海：地铁通勤 / 微信群 / 共享单车 / iPhone 4
- ❌ 不要把现代地铁 / 外卖 / 短视频塞进 1990 年代

**关键日**：${keyDate || "2026-05-20"} 是产品的 symbolic 锚点。如果场景明确指向非 2020 年代（如 1960s 台湾 / 1990s 香港），**请把推演时间整体换成对应年代的 5 月**——time 字段仍然只写 HH:MM，但 **eventText 的开头一定要明确写出年代**（例："1965 年 5 月，凤梨田收成季..." / "1995 年 5 月，BP 机响了一下..."）。让用户立刻感受到这不是当下。

## ⚠️ 第三步：场景的真实时空逻辑
- 校园：白天上课时段 / 自习课后 / 食堂饭点；不要 凌晨 3 点出现在教室
- 公司：早九晚六的工作时段 / 通勤路上；不要 周末早 7 点茶水间
- 异地 / 网友：以那个年代对应的通信方式为主（书信 / BB 机 / 微信，按年代选）
- 农村 / 老年代：日出而作 日落而息，地点是村口 / 田埂 / 老屋
- 禁止默认套"公司茶水间"——除非用户明确写"同公司"\n`
    : `\n# 📍 关系主场景
用户没指定。请基于双方 traits + 关系阶段挑一个合理的主场景。
默认按当下年代演（2020 年代中国大陆），但**不要默认套"公司茶水间"**。\n`;

  const latestMins = prevRounds.reduce((max, r) => {
    return Math.max(max, extractMinutes(r.time));
  }, 0);
  const keyDateLine = keyDate || "2026-05-20";

  // ⭐ 5/20 当天 10 个时刻的硬时段分布（每回合落在特定时段桶）
  // 这是产品 hard requirement：必须演完 5/20 完整 24 小时
  const ROUND_TIME_BUCKETS: Record<number, string> = {
    1: "00:00 ~ 02:30（凌晨。要不要发那条话 / 要不要再翻一次 ta 朋友圈）",
    2: "07:00 ~ 09:00（早晨起床后第一念）",
    3: "09:30 ~ 11:30（上午工作 / 学习时被一个想法打断）",
    4: "12:00 ~ 13:30（午饭点）",
    5: "13:30 ~ 15:30（下午稍闲）",
    6: "15:30 ~ 17:30（下午晚段 / 一件小事触发）",
    7: "17:30 ~ 19:00（黄昏 / 下班路上）",
    8: "19:00 ~ 21:00（晚饭后 / 朋友圈黄金时间）",
    9: "21:00 ~ 22:30（一天将尽 / 翻出聊天框）",
    10: "23:00 ~ 23:59（深夜最后一刻。决定走向）",
  };
  const currentBucket = ROUND_TIME_BUCKETS[nextRound] || "白天某个时段";

  const mustBeLater =
    latestMins > 0
      ? `必须晚于 ${formatTime(latestMins)}（上回合时间），且 "time" 必须落在 **${currentBucket}**`
      : `这是第 1 回合 · 5/20 当天的起点。\n"time" 必须落在 **${currentBucket}**`;

  // ⭐ 第 10 回合特殊处理：要让用户感觉这是"决定的一刻"
  const fatedMomentBlock = isFinalRound
    ? `\n# ⭐ 终局回合（第 ${total} 回合 · ${keyDateLine} 深夜）
这是 5/20 一天结束前的最后一刻。
- time 必须落在 23:00 - 23:59 之间
- eventText 要有"一天最后一刻"的重量感
- 这一回合的 delta 会直接决定主预言卡的结论（会 / 还差一步 / 不会）
- 不要凑某个特定分钟，由你根据剧本推演自然决定（23:14 / 23:36 / 23:47 / 23:58 都行）\n`
    : "";

  const recap =
    prevRounds.length > 0
      ? prevRounds
          .slice(-3)
          .map((r) => {
            const beatsBrief = r.beats
              .filter(
                (b) => b.kind === "message" || b.kind === "typing_revoked"
              )
              .slice(0, 4)
              .map((b) => {
                const speaker = b.role === "user-agent" ? "你" : "ta";
                const tag = b.kind === "typing_revoked" ? "（删）" : "";
                return `${speaker}${tag}: ${b.content}`;
              })
              .join(" / ");
            return `[Round ${r.round} · ${r.time}] ${r.eventText}\n  你→ ${r.userAction} ｜ ta→ ${r.taAction}\n  对话: ${beatsBrief}\n  Δ: closeness ${signed(r.delta.closeness)} affection ${signed(r.delta.taAffection)} (${r.delta.reason})`;
          })
          .join("\n\n")
      : "（无）";

  const baziLine = bazi?.available
    ? `${bazi.dayPillar}日生（${bazi.narrative.slice(0, 50)}）`
    : "（未填生日）";

  return `# 关系基底
- 用户：${base.name || "你"}（${base.mbti || "?"}） | 八字：${baziLine}
- ta：${base.taName || taAgent.name || "Ta"}
- 用户 traits：${userAgent.traits.slice(0, 8).join("、") || "无"}
- ta traits：${taAgent.traits.slice(0, 8).join("、") || "无"}

# 当前关系状态（4 维 0-100）
- closeness 亲密度：${state.closeness}
- userMood 你的状态：${state.userMood}
- taAffection ta 隐藏好感：${state.taAffection} ⚠️ 对用户隐藏
- taMood ta 隐藏心情：${state.taMood} ⚠️ 对用户隐藏

# 最近几回合
${recap}

# 这一回合（第 ${nextRound} / ${total} 回）
${mustBeLater}
${hint ? `💡 hint：${hint}` : ""}
${scenarioBlock}${scenePrefsBlock}${fatedMomentBlock}${archetypeBlock}${beatBlock}${
    replayN > 0
      ? `\n# ⚠️ 重玩扰动 (replay #${replayN})\n这是同一对 agent 的第 ${replayN + 1} 次推演。请让本回合走向和过去几次不同（事件起点 / 谁先动 / delta 方向都可换）。种子: ${Date.now() % 100000}\n`
      : ""
  }
输出严格 JSON：{ time, eventText, userAction, taAction, beats[], delta }`;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
