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

export interface BaseProfile {
  name: string;           // 你的姓名 / 昵称
  birthday: string;       // YYYY-MM-DD
  mbti: MBTI | "";
  taName: string;         // ta 的代称
}

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

// 单张主分享卡（合并原"主预言"+"金句"）
export interface ShareCard {
  title: string;         // 4-8 字大标题
  prophecyLine: string;  // 30-60 字，一句具体到分钟的画面感预言
  punchline: string;     // 30-60 字，普适诗化金句（不含 ta 真名，可分行）
}

// ====== 终局 ======
export interface FinalSummary {
  shareCard: ShareCard;                 // ⭐ 一张可截图分享的合并卡
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
  // ⭐ 新沙盘：回合历史 + 当前状态
  rounds: RoundEvent[];
  relationship: RelationshipState;
  // 读心剩余次数（默认 3）
  peeksRemaining: number;
  // ====== 老字段（保留兼容） ======
  scenes: PlayScene[];
  prefetched: PlayScene[];
  scenarioMode: ScenarioMode | null;
  // ======
  finalSummary: FinalSummary | null;
  phase: SimPhase;
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
