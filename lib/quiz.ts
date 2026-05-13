import type { QuizQuestion } from "./types";

// 12 道养成题 = 6 道分类题 + 6 道场景题
// 场景题在真实情境里测用户和 ta 的反应，给模型分析关系动态的素材
// 每题答案 → 给"你的 agent"或"ta 的 agent"加 trait chip

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ===== 分类题 1：关系定位 =====
  {
    id: "q1_stage",
    subject: "relationship",
    prompt: "你和 ta 现在的关系阶段最像哪个？",
    options: [
      { key: "A", text: "破冰期 · 还在彼此试探", userTrait: "新鲜的好奇", taTrait: "保持着距离" },
      { key: "B", text: "高度暧昧期 · 心照不宣", userTrait: "在等一个确认", taTrait: "也在等一个确认" },
      { key: "C", text: "冷战期 · 最近有点僵", userTrait: "嘴硬但心软", taTrait: "用沉默说话" },
      { key: "D", text: "断联期 · 想重新连上", userTrait: "想再试一次", taTrait: "没把门关死" },
    ],
  },

  // ===== 分类题 2：ta 第一印象 =====
  {
    id: "q2_ta_impression",
    subject: "ta",
    prompt: "ta 给你的第一印象更接近？",
    options: [
      { key: "A", text: "高冷克制，不轻易表态", taTrait: "高冷边界感" },
      { key: "B", text: "热心外向，话很多", taTrait: "热心话多" },
      { key: "C", text: "话不多但回得快", taTrait: "话少但在线" },
      { key: "D", text: "犹豫不定，常常欲言又止", taTrait: "犹豫的善意" },
    ],
  },

  // ===== 场景题 1：朋友圈点赞 =====
  {
    id: "q3_zan_scene",
    subject: "user",
    prompt:
      "情境：周五晚 22:14，你刚发了一条没什么意思的朋友圈。15 秒后看到 ta 点了赞，没评论。你最可能：",
    options: [
      { key: "A", text: "立刻私聊「在吗」", userTrait: "见缝就钻" },
      { key: "B", text: "等着看 ta 接下来会不会再做点什么", userTrait: "观察派" },
      { key: "C", text: "也去 ta 最近一条朋友圈点个赞回去", userTrait: "用动作还动作" },
      { key: "D", text: "装作没看到，但每隔 5 分钟看一次手机", userTrait: "嘴硬偷瞄" },
    ],
  },

  // ===== 场景题 2：回复速度 =====
  {
    id: "q4_reply_speed",
    subject: "ta",
    prompt:
      "情境：你下午 3 点给 ta 发一句「在干嘛」，ta 通常多久会回？",
    options: [
      { key: "A", text: "几秒内秒回", taTrait: "秒回型" },
      { key: "B", text: "10-30 分钟回，一句话", taTrait: "节奏稳定" },
      { key: "C", text: "半天才回，常常隔到晚上", taTrait: "慢半拍" },
      { key: "D", text: "通常不回，直到下次 ta 主动找你", taTrait: "异步派" },
    ],
  },

  // ===== 分类题 3：谁主动（关系动态）=====
  {
    id: "q5_initiative",
    subject: "relationship",
    prompt: "你们最近一周，谁更主动？",
    options: [
      { key: "A", text: "总是我先开口", userTrait: "总是先动", taTrait: "习惯被动" },
      { key: "B", text: "总是 ta 先开口", userTrait: "在等待", taTrait: "主动者" },
      { key: "C", text: "差不多，势均力敌", userTrait: "节奏对得上", taTrait: "节奏对得上" },
      { key: "D", text: "几乎没主动联系", userTrait: "在观望", taTrait: "也在观望" },
    ],
  },

  // ===== 场景题 3：分别时刻 =====
  {
    id: "q6_farewell",
    subject: "ta",
    prompt:
      "情境：你和 ta 上次见面时，分别那一刻 ta 的最后一句话/动作是？",
    options: [
      { key: "A", text: "主动说「下次再约」+ 笑了一下", taTrait: "明示型告别" },
      { key: "B", text: "含糊地说「拜拜」就转身走了", taTrait: "克制告别" },
      { key: "C", text: "让你先走，ta 站着没动看了几秒", taTrait: "目送派" },
      { key: "D", text: "其实没说什么，各自就散了", taTrait: "无形告别" },
    ],
  },

  // ===== 场景题 4：你说累了 ta 怎么回 =====
  {
    id: "q7_tired_reply",
    subject: "relationship",
    prompt:
      "情境：你给 ta 发了一句「我最近有点累」，按你的预感 ta 最可能怎么回？",
    options: [
      { key: "A", text: "立刻问「怎么了，发生什么了？」", taTrait: "情绪在场" },
      { key: "B", text: "发个抱抱表情或表情包", userTrait: "想被接住", taTrait: "用表情避正面" },
      { key: "C", text: "「嗯，注意休息」一句话", taTrait: "礼貌但远" },
      { key: "D", text: "不回，但第二天主动找你说别的", taTrait: "曲线回应" },
    ],
  },

  // ===== 分类题 4：用户雷区 =====
  {
    id: "q8_user_redline",
    subject: "user",
    prompt: "你最怕在 ta 那里遇到的是？",
    options: [
      { key: "A", text: "被忽略 / 已读不回", userTrait: "怕被忽略" },
      { key: "B", text: "被敷衍 / 应付式回复", userTrait: "怕被敷衍" },
      { key: "C", text: "被误会 / 解释也没用", userTrait: "怕被误会" },
      { key: "D", text: "被推开 / 越靠近越远", userTrait: "怕被推开" },
    ],
  },

  // ===== 场景题 5：520 前夜 =====
  {
    id: "q9_520_eve",
    subject: "relationship",
    prompt:
      "情境：5 月 19 日 周二晚上 22:30，朋友圈已经开始刷 520 礼物预告。你和 ta 的对话框停留在 3 天前的「嗯」。此刻你最可能：",
    options: [
      { key: "A", text: "主动发一句「明天 520，记得吗」", userTrait: "想要明示" },
      { key: "B", text: "什么都不发，等着看 ta 会不会动", userTrait: "想要 ta 先动" },
      { key: "C", text: "在自己朋友圈发条「不属于今晚的话」", userTrait: "广播不召唤" },
      { key: "D", text: "把对话框打开看一会，又关掉", userTrait: "想说但不敢" },
    ],
  },

  // ===== 场景题 6：520 当天期待 =====
  {
    id: "q10_520_wish",
    subject: "user",
    prompt:
      "情境：5 月 20 日凌晨 0:00，如果手机会响一下，你最希望那是 ta 的什么？",
    options: [
      { key: "A", text: "一句完整的话：「520 快乐」或类似", userTrait: "想要被直接说" },
      { key: "B", text: "一个没头没尾的「在吗」", userTrait: "宁可暧昧不要无" },
      { key: "C", text: "一条朋友圈，@ 了你或暗指你", userTrait: "想要被公开看见" },
      { key: "D", text: "什么都不需要，期待就会失望", userTrait: "把期待藏起来" },
    ],
  },

  // ===== 分类题 5：ta 心里在想 =====
  {
    id: "q11_ta_inner",
    subject: "ta",
    prompt: "你直觉 ta 心里现在最在想什么？",
    options: [
      { key: "A", text: "想我，但不知道怎么说", taTrait: "在想你但说不出" },
      { key: "B", text: "在等我先开口", taTrait: "在等你先开口" },
      { key: "C", text: "不确定我对 ta 是什么意思", taTrait: "不确定你的意思" },
      { key: "D", text: "可能没把我当回事", taTrait: "心思不全在你这" },
    ],
  },

  // ===== 分类题 6：想搞清楚的事 =====
  {
    id: "q12_wonder",
    subject: "relationship",
    prompt: "你最想搞清楚的事？",
    options: [
      { key: "A", text: "ta 是不是真的在意我", userTrait: "想验证真心", taTrait: "真心待验证" },
      { key: "B", text: "我们 520 这天会不会有突破", userTrait: "想看到那一刻", taTrait: "可能在准备" },
      { key: "C", text: "ta 为什么是现在这个样子", userTrait: "想读懂 ta", taTrait: "等待被读懂" },
      { key: "D", text: "我到底要不要继续", userTrait: "在重新衡量", taTrait: "可能在被衡量" },
    ],
  },
];
