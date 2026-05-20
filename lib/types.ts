// ====== Page 1 · 基础信息 ======
export type MBTI =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP"
  | "不知道";

export const MBTI_CHOICES: MBTI[] = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
  "不知道",
];

// 出生时辰下拉选项（用户和 ta 共用同一组 label）
export const BIRTH_TIME_RANGES = [
  "凌晨 (00:00-06:00)",
  "上午 (06:00-12:00)",
  "中午 (12:00-14:00)",
  "下午 (14:00-18:00)",
  "晚上 (18:00-24:00)",
  "不知道",
] as const;
export type BirthTimeRange = typeof BIRTH_TIME_RANGES[number];

export interface BaseProfile {
  name: string;                 // 你的姓名 / 昵称
  birthday: string;             // 你的生日 YYYY-MM-DD（必填）
  birthTimeRange?: string;      // 你的出生时辰（选填）
  mbti: MBTI | "";
  taName: string;               // ta 的代称
  // ⭐ ta 的生日 + 时辰（都选填；填得越细，预言越准）
  taBirthday?: string;          // YYYY-MM-DD
  taBirthTimeRange?: string;
  // ⭐ 关系发生的主场景（选填；空 = 让 AI 自己选）
  scenarioHint?: string;
}

// 关系主场景预设
export const SCENARIO_PRESETS = [
  { key: "school", label: "校园同学", hint: "教室 / 食堂 / 图书馆 / 校园同社团" },
  { key: "office", label: "同公司", hint: "工位 / 会议 / 下班路上 / 茶水间" },
  { key: "online", label: "网友互联网", hint: "豆瓣 / 小红书 / 游戏 / 远距离纯靠消息" },
  { key: "intro", label: "朋友介绍", hint: "共同朋友牵线 / 三人局慢慢熟" },
  { key: "gym", label: "健身房 / 兴趣班", hint: "Crossfit / 跳舞 / 陶艺课 等固定时段相遇" },
  { key: "neighbor", label: "邻居 / 偶遇", hint: "同小区 / 同一家咖啡店 / 通勤路线偶遇" },
  { key: "ex", label: "前任 / 旧关系", hint: "分手后又联系 / 多年没见的同学" },
  { key: "custom", label: "自定义", hint: "" },
] as const;
export type ScenarioPresetKey = typeof SCENARIO_PRESETS[number]["key"];

// ====== Page 2 · Agent 养成（10 题） ======
export interface QuizOption {
  key: "A" | "B" | "C" | "D";
  text: string;
  // 答案对两个 agent 各自添加的特征 chip
  userTrait?: string;
  taTrait?: string;
}

export type QuizSubject = "user" | "ta" | "relationship";

export interface QuizQuestion {
  id: string;
  subject: QuizSubject;       // 主要关于谁
  prompt: string;
  options: QuizOption[];
}

export interface QuizAnswer {
  questionId: string;
  optionKey: "A" | "B" | "C" | "D";
  optionText: string;
  userTrait?: string;
  taTrait?: string;
}

export interface AgentForm {
  // 用户 / ta 各自的 agent 当前形态
  name: string;
  // 头像视觉种子（emoji 主体由 seed 派生）
  avatarSeed: string;
  // 已积累的特征 chips（按答题进度增长）
  traits: string[];
  // 累积的"情绪色"（hue 0-360），影响光晕颜色
  hue: number;
}

// ====== Page 3 · 关系沙盘（上帝视角 · 状态推演） ======

// 一条对话原子（保留兼容，但在新沙盘中"对话"默认折叠）
export type BeatKind =
  | "message"
  | "typing_revoked"
  | "inner_flash"
  | "scene"          // 兼容老数据
  | "time_skip";     // 兼容老数据

export interface BeatMeta {
  timestamp?: string;
  skipDuration?: string;
}

export interface Beat {
  id: string;
  role: "user-agent" | "ta-agent" | "narration";
  kind: BeatKind;
  content: string;
  meta?: BeatMeta;
}

// ====== 关系状态（核心新增） ======
// 4 个 0-100 维度。前两个对用户可见，后两个对用户隐藏（黑盒）
export interface RelationshipState {
  closeness: number;     // 亲密度 0-100，越高越靠近（可见）
  userMood: number;      // 你的此刻状态 0-100，越高越放松/在场（可见）
  taAffection: number;   // ta 对你的隐藏好感 0-100（隐藏）
  taMood: number;        // ta 此刻隐藏心情 0-100（隐藏）
}

export interface StateDelta {
  closeness: number;     // 本回合变化（带正负号）
  userMood: number;
  taAffection: number;
  taMood: number;
  reason: string;        // 一句话因果，例如"你点了赞但没评论，ta 读出了你的犹豫"
}

// 一个回合的完整记录
export interface RoundEvent {
  id: string;
  round: number;          // 1-based
  time: string;           // "06:30"
  eventText: string;      // 30-60 字带氛围的事件描述
  userAction: string;     // 一句话用户做了什么（第三人称简写，如"点了赞，没评论"）
  taAction: string;       // 一句话 ta 做了什么（如"3 分钟后又发了一条"）
  beats: Beat[];          // 完整对话内容（默认折叠）
  delta: StateDelta;
  stateAfter: RelationshipState;
  // 是否由用户介入产生（区别于自动推进）
  intervened?: boolean;
}

// ====== 兼容老 PlayScene 类型（仅用于读老缓存 / 老 prefetch；新代码不要再用） ======
export interface PlayScene {
  id: string;
  title: string;
  scene: string;
  beats: Beat[];
  takeaway: string;
}

// 3 维度自我投射分析（重写：从"分析 ta"换成"分析你对 ta 的投射"）
export interface RelationshipAnalysis {
  yourProjection: string;     // 你的投射：这次推演暴露了你对 ta 怎样的想象
  yourPosition: string;       // 你的位置：结合八字 + 答题，你在亲密关系里的本能站位
  yourBlindSpot: string;      // 你的盲点：你最容易在 ta 那里自欺 / 看不见的一面
}

// 关键转折点（终局曲线下方）
export interface KeyMoment {
  time: string;          // "12:24"
  label: string;         // 短标题，例如"茶水间偶遇"
  impact: string;        // 简短状态影响，例如"亲密度 +8 / 心情 -2"
  note: string;          // 一句话点评（不超过 30 字）
}

// ====== 开局预言（规则生成，同输入同输出） ======

// 西方十二星座
export const ZODIAC_SIGNS = [
  "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
  "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼",
] as const;
export type ZodiacSign = typeof ZODIAC_SIGNS[number];

// 4 元素
export type SignElement = "火" | "土" | "风" | "水";

// 5 种主要相位（合相 / 三分 / 六分 / 四分 / 对分）
export type SignAspectKind =
  | "conjunction"   // 合相：同星座
  | "trine"         // 三分相：同元素、相距 4 宫
  | "sextile"       // 六分相：火↔风 / 土↔水、相距 2 宫
  | "square"        // 四分相：相距 3 宫、张力
  | "opposition"    // 对分相：相距 6 宫、互照
  | "neutral";      // 无明显相位

// 用更柔和的能量分类（不带"冲克害"这类词）
export type SignEnergy = "同频" | "和谐" | "互补" | "张力" | "互照" | "中性";

export interface SignCompatibility {
  kind: SignAspectKind;
  userSign: ZodiacSign;
  taSign: ZodiacSign;
  userElement: SignElement;
  taElement: SignElement;
  label: string;        // "双子 × 水瓶 · 风风同频"
  energy: SignEnergy;
  descriptor: string;   // ≤30 字一句话
}

export type StreamDayKind =
  | "self_strong"       // 比肩
  | "self_yin_yang"     // 劫财
  | "generates_me"      // 印星
  | "i_generate"        // 食伤
  | "controls_me"       // 官杀
  | "i_control";        // 财星

export type StreamDayEnergy = "强" | "助" | "泄" | "克" | "用";

export interface StreamDayRelation {
  kind: StreamDayKind;
  label: string;        // "癸丑日 · 财星日"
  energy: StreamDayEnergy;
  descriptor: string;   // ≤30 字一句话
}

// ⭐ 双人命盘速览 · 给前端"双圆+连线"视觉用
export interface AstroBeing {
  name: string;                  // 用户姓名 / ta 代称
  sign: ZodiacSign | null;       // 太阳星座
  element: SignElement | null;
  mbti?: string;                 // 仅用户有
  attachmentTypeZh?: string;     // 仅用户有（来自 archetype）
  scriptZh?: string;             // 仅用户有（来自 archetype.script）
  trait: string;                 // ≤30 字白描
}

export interface OpeningProphecy {
  // ===== 双人命盘速览（视觉核心）=====
  user: AstroBeing;
  ta: AstroBeing;

  // ===== 主标题 =====
  headline: string;              // ≤24 字
  headlineEvidence: string;      // 「依据：xxx」一行小字

  // ===== 文本段落 =====
  userBackdrop: string;
  taBackdrop: string;            // 与 userBackdrop 对称
  compatibility: {
    sign: SignCompatibility;
    sentence: string;
    distance: number;            // 黄道相距宫位数 (0-6)
    evidenceLine: string;        // 「水瓶 11 宫 ↔ 狮子 5 宫 · 相距 6 宫」
  } | null;
  stageBackdrop: string;
  archetypeReveal: string;       // 「12 题 → 焦虑型 · 拉扯剧本」，无 archetype 时空
  screenshotsLine?: string;      // 有聊天截图时的低噪提示行：「📷 AI 已读 N 张聊天，ta 会更像真实的 ta」

  // ===== 关键日 + 时刻 =====
  keyDay: {
    date: string;
    streamDay: StreamDayRelation | null;
    sentence: string;
    evidenceLine: string;        // 依据小字（可选展开）
  };
  fatedMoment: string;
  fatedMomentEvidence: string;   // 「⌛ 锚定：xxx」

  fullText: string;              // 整段拼接（导出 / share 用）
}

// 单张主分享卡（合并原"主预言"+"金句"）
export interface ShareCard {
  title: string;         // 4-8 字大标题
  prophecyLine: string;  // 30-60 字，一句具体到分钟的画面感预言
  punchline: string;     // 30-60 字，普适诗化金句（不含 ta 真名，可分行）
}

// ⭐ 5/20 推演结论三档
export type Verdict = "will" | "maybe" | "wont";

// 服务端规则化判定后的结论（不让 LLM 自由发挥）
export interface FiveTwentyVerdict {
  verdict: Verdict;                   // 会 / 差一步 / 不会
  verdictLabel: string;               // "会" / "还差一步" / "不会"
  keyMomentTime: string;              // 5/20 当天关键时刻 "23:47"
  keyMomentAction: string;            // ≤30 字，关键时刻的关键动作
  nextChanceDate?: string;            // wont 时给：下一次机会日 "2026-07-07"
  nextChanceReason?: string;          // ≤30 字，为什么那天
}

// ====== 终局 ======
export interface FinalSummary {
  shareCard: ShareCard;                 // ⭐ 一张可截图分享的合并卡
  fiveTwenty?: FiveTwentyVerdict;       // ⭐ 5/20 三档结论（新）
  analysis?: RelationshipAnalysis;      // 3 维自我投射分析（默认折叠）
  keyMoments?: KeyMoment[];             // 关键转折点（折叠）
  // 兼容老字段（不再主用）
  title?: string;
  body?: string;
}

// ====== 演化模式 ======
export type ScenarioMode = "auto" | "custom";

// ====== 全局 Sim 状态 ======
export type SimPhase =
  | "setup"
  | "builder"
  | "play"
  | "report";

export interface SimulationState {
  base: BaseProfile;
  quizAnswers: QuizAnswer[];
  userAgent: AgentForm;
  taAgent: AgentForm;
  // ⭐ 用户上传的聊天截图 base64 dataURL 数组（最多 5 张）
  chatScreenshots: string[];
  // ⭐ 新沙盘：回合历史 + 当前状态
  rounds: RoundEvent[];
  relationship: RelationshipState;
  // 读心剩余次数（默认 3）
  peeksRemaining: number;
  // 同一对 agent 已重复推演的次数（0 = 首次）
  replayCount: number;
  // ⭐ 关系剧本类型（由 12 题规则化推导）— 注入到所有 LLM prompt
  archetype: import("./relationship-archetype").RelationshipArchetype | null;
  // ⭐ 人设库（最多 10 套）
  agentLibrary: SavedAgentSet[];
  // ====== 老字段（保留兼容） ======
  scenes: PlayScene[];
  prefetched: PlayScene[];
  scenarioMode: ScenarioMode | null;
  // ======
  finalSummary: FinalSummary | null;
  phase: SimPhase;
}

// 保存到本地的一套完整人设
export interface SavedAgentSet {
  id: string;                 // lib_xxx 本地唯一
  createdAt: number;          // 首次保存时间
  lastUsedAt: number;         // 最近一次推演时间
  playCount: number;          // 累计推演次数（首演 + 重玩 + 重新载入）
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  quizAnswers: QuizAnswer[];
}

// ====== Agent 调用契约 ======
export type AgentName =
  | "round-engine"
  | "peek-mind"
  | "intervene"
  | "relationship-summary"
  // 老 agent，保留路由别名兼容
  | "scenario-player";

export interface AgentRequest {
  agent: AgentName;
  payload: Record<string, unknown>;
}

// 兼容：旧 ScenarioPlayerInput 用的
export interface BeatDraft {
  role: "user-agent" | "ta-agent" | "narration";
  kind: BeatKind;
  content: string;
}
