import type { QuizQuestion } from "./types";

// ⭐ 5/20 专属精简版：3 题
// Q1 关系阶段 → 决定 initial RelationshipState 的 preset
// Q9 5/19 今晚的状态 → 影响 round-engine 第 1 回合（凌晨那一刻）
// Q10 5/20 凌晨期待 → 影响 ta 的隐藏好感初始值 + 后续 ta 的反应

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ===== Q1 关系阶段 =====
  {
    id: "q1_stage",
    subject: "relationship",
    prompt: "你和 ta 现在的关系最像哪种？",
    options: [
      {
        key: "A",
        text: "暗恋期 · ta 可能还不知道我喜欢",
        userTrait: "藏起来的心动",
        taTrait: "暂时无感知",
      },
      {
        key: "B",
        text: "暧昧期 · 互相有感觉但没说破",
        userTrait: "在等一个确认",
        taTrait: "也在等一个确认",
      },
      {
        key: "C",
        text: "在一起了 · 想看看 520 会怎样",
        userTrait: "想要被珍惜",
        taTrait: "正式关系",
      },
      {
        key: "D",
        text: "关系卡住了 · 冷战 / 断联 / 想重新连",
        userTrait: "嘴硬但心软",
        taTrait: "用沉默说话",
      },
    ],
  },

  // ===== Q9 今晚（5/19）你最想做什么 =====
  {
    id: "q9_520_eve",
    subject: "relationship",
    prompt:
      "今晚 5/19，朋友圈开始刷 520。你想到 ta，此刻最可能：",
    options: [
      {
        key: "A",
        text: "鼓起勇气，给 ta 发一句试探的话",
        userTrait: "想要明示",
      },
      {
        key: "B",
        text: "什么都不发，等着看 ta 会不会动",
        userTrait: "想要 ta 先动",
      },
      {
        key: "C",
        text: "在自己朋友圈发条「不属于今晚的话」",
        userTrait: "广播不召唤",
      },
      {
        key: "D",
        text: "把对话框打开看一会，又关掉",
        userTrait: "想说但不敢",
      },
    ],
  },

  // ===== Q10 5/20 凌晨期待 =====
  {
    id: "q10_520_wish",
    subject: "user",
    prompt:
      "明天 5/20 凌晨 0:00，如果手机响一下，你最希望那是 ta 的什么？",
    options: [
      { key: "A", text: "一句完整的话：「520 快乐」或类似", userTrait: "想要被直接说" },
      { key: "B", text: "一个没头没尾的「在吗」", userTrait: "宁可暧昧不要无" },
      { key: "C", text: "一条朋友圈，@ 了你或暗指你", userTrait: "想要被公开看见" },
      { key: "D", text: "什么都不需要，期待就会失望", userTrait: "把期待藏起来" },
    ],
  },
];
