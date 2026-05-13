// 智能 mock：基于姓名、traits、关系状态、回合编号挑选合适模板并填名字
// 用于无 API key 时提供"看起来像真的"快速响应

import type {
  AgentForm,
  BaseProfile,
  RelationshipState,
  RoundEvent,
} from "../types";
import type { BaziInfo } from "../bazi";

// ============================================================
// 模板类型
// ============================================================
type BeatTemplate = {
  role: "user-agent" | "ta-agent";
  kind: "message" | "typing_revoked" | "inner_flash";
  content: string;
};

type RoundTemplate = {
  time: string;
  eventText: string; // 含 {U} {T} 占位符
  userAction: string;
  taActionCold: string; // affection 低用
  taActionWarm: string; // affection 高用
  beats: BeatTemplate[]; // 含 {U} {T}, ta 消息用 [COLD]xxx[WARM]yyy 区分
  deltaBase: {
    closeness: number;
    userMood: number;
    taAffection: number;
    taMood: number;
  };
  reason: string;
};

// 10 个回合模板，每个 ~10 beats（5 轮对话）
// 总回合上限 10，每个模板正好用一次
const ROUND_TEMPLATES: RoundTemplate[] = [
  // -------- 凌晨 --------
  {
    time: "00:08",
    eventText: "你刚熄灯躺下，屏幕亮起一下——{T} 朋友圈：「失眠」，没配图，没 @。",
    userAction: "点了赞，对话框打开又关掉",
    taActionCold: "回得简短，没接你的话",
    taActionWarm: "聊到凌晨一点多，话比平时长",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "0 点。520 了。{T}也醒着。" },
      { role: "user-agent", kind: "typing_revoked", content: "今天 520 哎" },
      { role: "user-agent", kind: "message", content: "失眠？" },
      { role: "ta-agent", kind: "message", content: "[COLD]嗯。[WARM]嗯，你也是？" },
      { role: "user-agent", kind: "message", content: "[COLD]看到你那条朋友圈。[WARM]在想事情。" },
      { role: "ta-agent", kind: "typing_revoked", content: "你看到那条了" },
      { role: "ta-agent", kind: "message", content: "[COLD]没什么。[WARM]今天有点过不去。" },
      { role: "user-agent", kind: "message", content: "[COLD]早点睡吧。[WARM]想聊聊吗？" },
      { role: "ta-agent", kind: "message", content: "[COLD]嗯，晚安。[WARM]你陪我说说话吧。" },
      { role: "user-agent", kind: "message", content: "[COLD]那我先睡了。[WARM]说吧，我在。" },
      { role: "ta-agent", kind: "message", content: "[COLD]晚安。[WARM]其实今天没人记得是 520。" },
      { role: "user-agent", kind: "message", content: "[COLD][没回][WARM]我记得。" },
      { role: "ta-agent", kind: "typing_revoked", content: "你是不是" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]谢谢你还在。" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]还是隔了一层。[WARM]今晚 ta 没有躲。" },
    ],
    deltaBase: { closeness: 4, userMood: 3, taAffection: 4, taMood: 2 },
    reason: "凌晨失眠暴露了 ta 平时藏起来的一面",
  },

  // -------- 早晨 --------
  {
    time: "07:23",
    eventText: "通勤路上，地铁刚进隧道。群里有人发 520 表情包刷屏，{T} 头像在最近联系人第一行。",
    userAction: "犹豫了一下还是发了「早」",
    taActionCold: "回了「早」一个字",
    taActionWarm: "回完早就开始聊昨晚的事",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "今天要不要主动一点。" },
      { role: "user-agent", kind: "typing_revoked", content: "早，今天 520" },
      { role: "user-agent", kind: "message", content: "早。" },
      { role: "ta-agent", kind: "message", content: "[COLD]早。[WARM]早。昨晚睡得好吗？" },
      { role: "user-agent", kind: "message", content: "[COLD]今天有点堵。[WARM]凌晨那条，看到了。" },
      { role: "ta-agent", kind: "message", content: "[COLD]我也是。[WARM]别介意。" },
      { role: "user-agent", kind: "message", content: "[COLD]地铁里。[WARM]不介意。你今天怎么样。" },
      { role: "ta-agent", kind: "message", content: "[COLD]嗯。[WARM]比昨晚好。" },
      { role: "user-agent", kind: "typing_revoked", content: "今天 520，要不要约一下" },
      { role: "user-agent", kind: "message", content: "[COLD]那到公司见。[WARM]那中午一起吃饭？" },
      { role: "ta-agent", kind: "message", content: "[COLD]嗯。[WARM]好。我等你来叫我。" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]还是隔着工位。[WARM]今天 ta 没有兜圈子。" },
    ],
    deltaBase: { closeness: 3, userMood: 2, taAffection: 3, taMood: 1 },
    reason: "你主动开早安，ta 接的方式暴露了距离",
  },

  // -------- 上午 --------
  {
    time: "09:47",
    eventText: "工作群里 @全员。{T} 在群里发了一个问题，但消息后面只 @ 了你。",
    userAction: "工作角度回了答案，多发了一行表情",
    taActionCold: "公事公办，说完就退场",
    taActionWarm: "工作问完留住你聊了下别的",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "为什么是 @ 我。" },
      { role: "ta-agent", kind: "message", content: "这个文档你之前对接过吧？" },
      { role: "user-agent", kind: "message", content: "嗯，我发你看看。" },
      { role: "ta-agent", kind: "message", content: "[COLD]收到，谢。[WARM]看了，谢。" },
      { role: "user-agent", kind: "message", content: "[COLD]有问题再问。[WARM]没事，举手之劳。" },
      { role: "ta-agent", kind: "typing_revoked", content: "中午一起吃" },
      { role: "ta-agent", kind: "message", content: "[COLD]嗯。[WARM]中午吃什么？" },
      { role: "user-agent", kind: "message", content: "[COLD][已读][WARM]还没想，你定？" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]那我去找你。下楼那家可以？" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]行。12 点见。" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]好。" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]只是工作。[WARM]这是 ta 用工作借口约我。" },
    ],
    deltaBase: { closeness: 4, userMood: 3, taAffection: 4, taMood: 2 },
    reason: "工作借口下藏着私下的接近",
  },

  // -------- 中午 --------
  {
    time: "12:24",
    eventText: "公司茶水间。你接完水转身，{T} 也来了，站在你侧后方半步。微波炉嗡嗡声很满。",
    userAction: "主动开口问「你也来打水？」",
    taActionCold: "礼貌但拘谨地聊了几句",
    taActionWarm: "聊到一起去吃饭",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "今天第一次面对面说话。" },
      { role: "user-agent", kind: "message", content: "你也来打水？" },
      { role: "ta-agent", kind: "message", content: "[COLD]嗯，刚开完会。[WARM]嗯。看你今天心情还行。" },
      { role: "user-agent", kind: "message", content: "[COLD]最近忙吧。[WARM]你才是吧，看你这两天加班。" },
      { role: "ta-agent", kind: "message", content: "[COLD]还好。你呢？[WARM]还好，今天事少。" },
      { role: "user-agent", kind: "message", content: "[COLD]我也还行。[WARM]那今天能正常下班？" },
      { role: "ta-agent", kind: "typing_revoked", content: "今天 520" },
      { role: "ta-agent", kind: "message", content: "[COLD]看情况吧。[WARM]能。你呢？" },
      { role: "user-agent", kind: "message", content: "[COLD]那不打扰了。[WARM]我也能。" },
      { role: "ta-agent", kind: "message", content: "[COLD]那先这样。[WARM]那等会儿一起走？" },
      { role: "user-agent", kind: "message", content: "[COLD]嗯，去忙吧。[WARM]好啊。" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]ta 没把那句说完整。[WARM]今天 ta 把删掉的那句又写了一遍。" },
    ],
    deltaBase: { closeness: 6, userMood: 3, taAffection: 5, taMood: 3 },
    reason: "你先开口，ta 接住但删掉了更直接的一句",
  },

  // -------- 午休 --------
  {
    time: "13:15",
    eventText: "午休。{T} 朋友圈刚刷出一条：「想吃焦糖玛奇朵」配自拍。点赞数 1，是你。",
    userAction: "点完赞把评论框打开又关上",
    taActionCold: "没单独找你",
    taActionWarm: "几分钟后给你单发同一张照片",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "ta 这是发给谁看的？" },
      { role: "user-agent", kind: "typing_revoked", content: "我可以给你买一杯" },
      { role: "user-agent", kind: "message", content: "[COLD][没发][WARM]这家咖啡好喝？" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]嗯。新发现的，你要试试吗。" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]在哪儿？" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM][定位] 下班可以一起去。" },
      { role: "user-agent", kind: "typing_revoked", content: "为什么是下班一起去" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]好。" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]那说定了。" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]需要带杯子吗。" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]不用，第一杯送杯。" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]ta 在敷衍闲聊。[WARM]ta 在把我留住。" },
    ],
    deltaBase: { closeness: 3, userMood: 1, taAffection: 3, taMood: 1 },
    reason: "ta 朋友圈试水，你接住后 ta 顺势把暗示挑明",
  },

  // -------- 下午 --------
  {
    time: "15:30",
    eventText: "你下午会议困得睁不开眼，给 {T} 发了「我快不行了」。",
    userAction: "卖了个惨试探下 ta",
    taActionCold: "敷衍地回了表情",
    taActionWarm: "停了手上的事专门和你聊",
    beats: [
      { role: "user-agent", kind: "message", content: "我快不行了" },
      { role: "ta-agent", kind: "message", content: "[COLD][抱抱][WARM]怎么了？" },
      { role: "user-agent", kind: "message", content: "[COLD]会议拖了俩小时。[WARM]困死了，午休没睡。" },
      { role: "ta-agent", kind: "message", content: "[COLD]我也是。[WARM]中午是我害的吧。" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]ta 没接我的话头。[WARM]ta 还记得中午那杯咖啡。" },
      { role: "user-agent", kind: "message", content: "[COLD]嗯。[WARM]没事。要谢的话晚上请我。" },
      { role: "ta-agent", kind: "typing_revoked", content: "晚上有空" },
      { role: "ta-agent", kind: "message", content: "[COLD]加油。[WARM]那你想吃什么？" },
      { role: "user-agent", kind: "message", content: "[COLD][没回][WARM]看你方便。" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]下班来叫我。" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]好。继续撑会议了。" },
    ],
    deltaBase: { closeness: 3, userMood: 2, taAffection: 2, taMood: 0 },
    reason: "你示弱试探，ta 接的方式暴露了温度",
  },

  // -------- 傍晚 --------
  {
    time: "17:12",
    eventText: "快下班。你在工位刷手机，{T} 经过你工位但没停。",
    userAction: "假装专注屏幕",
    taActionCold: "走过去就没回头",
    taActionWarm: "走过去后又折回来",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "ta 经过我。我装作看手机。" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]诶，今天还加班吗？" },
      { role: "user-agent", kind: "typing_revoked", content: "你今晚有事吗" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]不加，6 点准时跑。" },
      { role: "ta-agent", kind: "message", content: "[COLD]那行，我也走。[WARM]那我等你。" },
      { role: "user-agent", kind: "message", content: "[COLD]路上小心。[WARM]去哪？" },
      { role: "ta-agent", kind: "message", content: "[COLD][没回][WARM]你说去哪吧。" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]中午说的那家咖啡？" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]嗯，那就那家。" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]那一会儿在楼下见。" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]好。带伞了吗？" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]ta 没追上来。[WARM]ta 在管细节。" },
    ],
    deltaBase: { closeness: 4, userMood: 2, taAffection: 3, taMood: 2 },
    reason: "线下擦肩 ta 主动开口，比你预期更近半格",
  },

  // -------- 黄昏 --------
  {
    time: "18:48",
    eventText: "下班地铁上。{T} 朋友圈刚出一条：「今天的云很好看」，没 @ 你，配图天空。",
    userAction: "点了赞没评论",
    taActionCold: "12 分钟后简单问「你在哪」",
    taActionWarm: "几分钟后单发你「这条是发给你看的」",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "ta 没 @ 我。但发在今天。" },
      { role: "user-agent", kind: "typing_revoked", content: "这是发给我看的吗" },
      { role: "ta-agent", kind: "message", content: "[COLD]你在哪。[WARM]刚那条你看到了？" },
      { role: "user-agent", kind: "message", content: "[COLD]地铁里，刚下班。[WARM]看到了。是给我的？" },
      { role: "ta-agent", kind: "message", content: "[COLD]嗯。[WARM]嗯。今天太忙没发文字。" },
      { role: "user-agent", kind: "message", content: "[COLD]累了一天吧。[WARM]那条云比你说出口好。" },
      { role: "ta-agent", kind: "message", content: "[COLD]嗯。[WARM]能让你看到就行。" },
      { role: "user-agent", kind: "message", content: "[COLD]那好好休息。[WARM]今天的咖啡你还记得吧。" },
      { role: "ta-agent", kind: "typing_revoked", content: "其实我一直" },
      { role: "ta-agent", kind: "message", content: "[COLD]早。[WARM]当然。改天再去。" },
      { role: "user-agent", kind: "message", content: "[COLD][没回][WARM]改天是什么时候？" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]这周末？" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]ta 没接我的话。[WARM]那句没发完的我替 ta 补全了。" },
    ],
    deltaBase: { closeness: 5, userMood: 1, taAffection: 4, taMood: 2 },
    reason: "ta 用朋友圈隐喻试探，你接住了一半",
  },

  // -------- 晚上 --------
  {
    time: "20:30",
    eventText: "晚饭后。{T} 突然发来一段 4 秒语音，没附文字。",
    userAction: "听了三遍",
    taActionCold: "说是按错了",
    taActionWarm: "承认是想发但又删了一半",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "这是不小心还是故意？" },
      { role: "user-agent", kind: "typing_revoked", content: "你是想说什么吗" },
      { role: "user-agent", kind: "message", content: "[COLD]你刚发了段语音？[WARM]听到了。是想说什么吗？" },
      { role: "ta-agent", kind: "message", content: "[COLD]按错了。[WARM]想发，但发出去又觉得太重。" },
      { role: "user-agent", kind: "message", content: "[COLD]嗯。[WARM]那就发文字试试。" },
      { role: "ta-agent", kind: "typing_revoked", content: "今天的咖啡" },
      { role: "ta-agent", kind: "message", content: "[COLD]没事，下次注意。[WARM]今天和你聊得我有点上头。" },
      { role: "user-agent", kind: "message", content: "[COLD]晚安。[WARM]我也是。挺开心的。" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]那明天还见。" },
      { role: "user-agent", kind: "message", content: "[COLD][没回][WARM]这周末呢？" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]周末有空。你说去哪。" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]ta 圆了过去。[WARM]ta 第一次承认「上头」。" },
    ],
    deltaBase: { closeness: 4, userMood: 1, taAffection: 5, taMood: 2 },
    reason: "ta 一个手抖暴露了她想发又没敢发的话",
  },

  // -------- 深夜 --------
  {
    time: "23:47",
    eventText: "你躺床上，台灯早关了。手机屏幕亮了一下又黑。对话框停在晚上 8 点的「明天还见」。",
    userAction: "撑着不主动",
    taActionCold: "也没主动",
    taActionWarm: "13 分钟后发来「在吗」",
    beats: [
      { role: "user-agent", kind: "inner_flash", content: "520 就这样过去了。" },
      { role: "user-agent", kind: "typing_revoked", content: "你知道今天是什么日子吗" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]在吗" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]在。" },
      { role: "ta-agent", kind: "message", content: "[COLD]睡了吗？[WARM]今天有句话一直没说。" },
      { role: "user-agent", kind: "message", content: "[COLD]差不多。[WARM]说吧，我在听。" },
      { role: "ta-agent", kind: "typing_revoked", content: "我喜欢你" },
      { role: "ta-agent", kind: "message", content: "[COLD]那早点睡。[WARM]今天的我比平时近你一点。" },
      { role: "user-agent", kind: "message", content: "[COLD]晚安。[WARM]我注意到了。" },
      { role: "ta-agent", kind: "message", content: "[COLD][没回][WARM]那我能不能问你一件事。" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]你说。" },
      { role: "ta-agent", kind: "message", content: "[COLD][WARM]周末那个咖啡，算是约会吗。" },
      { role: "user-agent", kind: "message", content: "[COLD][WARM]你想让它算就算。" },
      { role: "user-agent", kind: "inner_flash", content: "[COLD]ta 又退回去了。[WARM]这一刻 ta 是我的。" },
    ],
    deltaBase: { closeness: 5, userMood: 4, taAffection: 6, taMood: 3 },
    reason: "ta 在最后 13 分钟主动找你，是 ta 一整天最不像 ta 的瞬间",
  },
];

// ============================================================
// 工具：占位符替换 + 冷暖支线选择
// ============================================================
function fillTemplate(s: string, userName: string, taName: string, isWarm: boolean): string {
  // [COLD]xxx[WARM]yyy → 根据 isWarm 选择
  s = s.replace(/\[COLD\](.*?)\[WARM\](.*)$/s, isWarm ? "$2" : "$1");
  // 处理单分支 [COLD]xxx 或 [WARM]yyy
  if (isWarm) {
    s = s.replace(/\[COLD\].*$/s, "");
    s = s.replace(/\[WARM\]/g, "");
  } else {
    s = s.replace(/\[WARM\].*$/s, "");
    s = s.replace(/\[COLD\]/g, "");
  }
  s = s.replace(/\{U\}/g, userName).replace(/\{T\}/g, taName);
  return s.trim();
}

function jitter(v: number, magnitude = 1): number {
  const delta = Math.floor(Math.random() * (magnitude * 2 + 1)) - magnitude;
  return v + delta;
}

// ============================================================
// mockRoundEngine
// ============================================================
export function mockRoundEngine(
  base: BaseProfile,
  userAgent: AgentForm,
  taAgent: AgentForm,
  prevRounds: RoundEvent[] = [],
  state?: RelationshipState
) {
  const userName = base.name || userAgent.name || "你";
  const taName = base.taName || taAgent.name || "Ta";
  const isWarm = (state?.taAffection ?? 50) >= 50;
  const idx = prevRounds.length % ROUND_TEMPLATES.length;
  const t = ROUND_TEMPLATES[idx];

  return {
    time: t.time,
    eventText: fillTemplate(t.eventText, userName, taName, isWarm),
    userAction: fillTemplate(t.userAction, userName, taName, isWarm),
    taAction: fillTemplate(isWarm ? t.taActionWarm : t.taActionCold, userName, taName, isWarm),
    beats: t.beats
      .map((b) => ({
        role: b.role,
        kind: b.kind,
        content: fillTemplate(b.content, userName, taName, isWarm),
      }))
      .filter((b) => b.content.length > 0),
    delta: {
      closeness: jitter(t.deltaBase.closeness),
      userMood: jitter(t.deltaBase.userMood),
      taAffection: jitter(t.deltaBase.taAffection),
      taMood: jitter(t.deltaBase.taMood),
      reason: t.reason,
    },
  };
}

// ============================================================
// mockPeekMind（依赖 taAffection 给不同读心）
// ============================================================
const PEEK_BY_AFFECTION = [
  // 0-25 低
  {
    taMoodLabel: "在抽离",
    taAttitude: "{T} 在你这里花的心思比你以为的少",
    innerMonologue: "今天有点累。等周末。",
    userBlindSpot: "你给 {T} 加了滤镜。ta 这两天的疏远不是「在试探你」，可能就是「没在想你」。",
  },
  // 26-50 中低
  {
    taMoodLabel: "想退一步",
    taAttitude: "{T} 在保持距离，但不想完全切断",
    innerMonologue: "今天 ta 怎么这么主动。我得稳住，别让 ta 太确定。",
    userBlindSpot: "你把 {T} 的短回复读成「冷漠」。但同样的短回复，也可能只是「今天的容量就这么多」。",
  },
  // 51-75 中高
  {
    taMoodLabel: "想靠近 + 怕暴露",
    taAttitude: "{T} 在主动靠近，但很怕被你看出来",
    innerMonologue: "刚才那个赞...是不是太敷衍了？要不要再发一条。算了，太刻意。",
    userBlindSpot: "你以为 {T} 在等你先开口。但 {T} 也在等你的反应——这是双方都在等。",
  },
  // 76-100 高
  {
    taMoodLabel: "已经在等你",
    taAttitude: "{T} 心里已经走了三步，但只在表面上走半步",
    innerMonologue: "今天必须找个机会跟 {U} 说一句。不能再装下去了。",
    userBlindSpot: "你以为这一切都是你的主动推动的。但 {T} 心里那条线，早就比你想象的更近一格。",
  },
];

export function mockPeekMind(
  base: BaseProfile,
  state: RelationshipState,
  _prevRounds: RoundEvent[] = []
) {
  const userName = base.name || "你";
  const taName = base.taName || "Ta";
  const aff = state.taAffection;
  let band = 0;
  if (aff > 75) band = 3;
  else if (aff > 50) band = 2;
  else if (aff > 25) band = 1;
  const tmpl = PEEK_BY_AFFECTION[band];
  return {
    taMoodLabel: tmpl.taMoodLabel.replace(/\{T\}/g, taName).replace(/\{U\}/g, userName),
    taAttitude: tmpl.taAttitude.replace(/\{T\}/g, taName).replace(/\{U\}/g, userName),
    innerMonologue: tmpl.innerMonologue.replace(/\{T\}/g, taName).replace(/\{U\}/g, userName),
    userBlindSpot: tmpl.userBlindSpot.replace(/\{T\}/g, taName).replace(/\{U\}/g, userName),
  };
}

// ============================================================
// mockIntervene（基于用户动作和 ta 当前 affection 选反应）
// ============================================================
export function mockIntervene(
  base: BaseProfile,
  userInputType: "message" | "post" | "wait",
  userInputContent: string,
  prevRounds: RoundEvent[] = [],
  state?: RelationshipState
) {
  const userName = base.name || "你";
  const taName = base.taName || "Ta";
  const isWarm = (state?.taAffection ?? 50) >= 50;
  const lastTime = prevRounds[prevRounds.length - 1]?.time || "12:00";
  const m = lastTime.match(/(\d{1,2}):(\d{2})/);
  const lastMins = m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 720;
  const newMins = Math.min(lastMins + 12, 23 * 60 + 55);
  const newTime = `${String(Math.floor(newMins / 60)).padStart(2, "0")}:${String(newMins % 60).padStart(2, "0")}`;

  if (userInputType === "wait") {
    return {
      time: newTime,
      eventText: "你看了眼手机，没动。",
      userAction: "选择了不动",
      taAction: isWarm ? `${taName} 几分钟后主动找了你` : "没动",
      beats: [
        { role: "user-agent" as const, kind: "inner_flash" as const, content: "等一下吧。" },
        ...(isWarm
          ? [{ role: "ta-agent" as const, kind: "message" as const, content: "在吗" }]
          : []),
      ],
      delta: {
        closeness: isWarm ? 2 : -1,
        userMood: -1,
        taAffection: isWarm ? 2 : 0,
        taMood: 0,
        reason: isWarm ? "你没动，ta 反而先动了" : "你没动，时间就这样过去",
      },
    };
  }

  if (userInputType === "post") {
    // 朋友圈是"广播"：ta 看到也不愿意太直接反应
    // - 冷状态：可能只是点赞、或者根本没看到、或者隔很久才看到
    // - 暖状态：点赞 + 私下截图发给你 / 隔了一会评论一个不相干的细节
    return {
      time: newTime,
      eventText: "你发完朋友圈，等待。",
      userAction: `朋友圈：${userInputContent.slice(0, 22)}`,
      taAction: isWarm
        ? "几小时后，单独发你那条朋友圈的截图"
        : "晚上才点了赞，没评论",
      beats: [
        {
          role: "user-agent" as const,
          kind: "inner_flash" as const,
          content: "看 ta 会不会动。",
        },
        // 朋友圈反应天然延迟感
        ...(isWarm
          ? [
              {
                role: "user-agent" as const,
                kind: "inner_flash" as const,
                content: "ta 居然单独发来了，不是在朋友圈下面。",
              },
              {
                role: "ta-agent" as const,
                kind: "message" as const,
                content: "[你的朋友圈截图]",
              },
              {
                role: "ta-agent" as const,
                kind: "message" as const,
                content: "这条我看好几遍了。",
              },
              {
                role: "user-agent" as const,
                kind: "message" as const,
                content: "你看出来啥了。",
              },
              {
                role: "ta-agent" as const,
                kind: "message" as const,
                content: "不告诉你。",
              },
            ]
          : [
              {
                role: "user-agent" as const,
                kind: "inner_flash" as const,
                content: "一个赞 + 没评论。比私聊更冷。",
              },
              {
                role: "ta-agent" as const,
                kind: "message" as const,
                content: "[已点赞]",
              },
            ]),
      ],
      delta: {
        closeness: isWarm ? 2 : 0,
        userMood: isWarm ? 1 : -1,
        taAffection: isWarm ? 3 : 0,
        taMood: 0,
        reason: isWarm
          ? "ta 看到你的朋友圈，选了更隐秘的方式回应——只发给你"
          : "广播触到了 ta，但 ta 不愿意公开回应",
      },
    };
  }

  // message
  return {
    time: newTime,
    eventText: "你打开 ta 的对话框，停了几秒。",
    userAction: "主动发了消息",
    taAction: isWarm ? "秒回，话比平时多" : "回了一句，留着余地",
    beats: [
      { role: "user-agent" as const, kind: "message" as const, content: userInputContent },
      {
        role: "ta-agent" as const,
        kind: "typing_revoked" as const,
        content: isWarm ? "刚想跟你说" : "嗯",
      },
      {
        role: "ta-agent" as const,
        kind: "message" as const,
        content: isWarm ? "嗯，刚好想找你。" : "怎么了？",
      },
      {
        role: "user-agent" as const,
        kind: "message" as const,
        content: isWarm ? "你也想到我了？" : "就是想说一下。",
      },
      {
        role: "ta-agent" as const,
        kind: "message" as const,
        content: isWarm ? "今天好几次都想找你。" : "嗯，我知道了。",
      },
      {
        role: "user-agent" as const,
        kind: "message" as const,
        content: isWarm ? "那就别想了，直接发。" : "那就不打扰你了。",
      },
      {
        role: "ta-agent" as const,
        kind: "message" as const,
        content: isWarm ? "好。" : "嗯。早点休息。",
      },
      {
        role: "user-agent" as const,
        kind: "inner_flash" as const,
        content: isWarm ? "今天我先开口，ta 接得这么稳。" : "ta 没接住我递的话。",
      },
    ],
    delta: {
      closeness: isWarm ? 5 : 2,
      userMood: isWarm ? 3 : 1,
      taAffection: isWarm ? 4 : 1,
      taMood: isWarm ? 2 : 0,
      reason: isWarm
        ? "你主动正好戳到 ta 想被找的心情"
        : "你开了头，ta 接住但没多余动作",
    },
  };
}

// ============================================================
// mockRelationshipSummary（基于最终 state 选 share card 调子）
// ============================================================
export function mockRelationshipSummary(
  base: BaseProfile,
  bazi?: BaziInfo | null,
  rounds: RoundEvent[] = [],
  finalState?: RelationshipState
) {
  const taName = base.taName || "Ta";
  const userName = base.name || "你";
  const dayPillar = bazi?.dayPillar || "未知日柱";
  const baziLine = bazi?.narrative || "（生日未填，跳过命理底色）";
  const closeness = finalState?.closeness ?? 50;
  const tone =
    closeness >= 65 ? "warm" : closeness >= 40 ? "neutral" : "cold";

  const SHARES = {
    warm: {
      title: "把话留到最后",
      prophecyLine: `23:47，${userName} 的手机会再亮一下。是一段没头没尾的「在吗」——这一句是 ${taName} 一整天攒到现在的勇气。`,
      punchline:
        "我们都是在最后一刻才肯伸手的人。\n但那一刻伸出去的手，握住了，就够了。",
    },
    neutral: {
      title: "先伸手又收回",
      prophecyLine: `23:47，${userName} 的手机会亮一下。可能是一条没头没尾的「在吗」，也可能什么都没有。`,
      punchline:
        "我们都是先伸手又收回的人。\n在 520 这一天，连影子都不敢伸长一点。",
    },
    cold: {
      title: "未发送",
      prophecyLine: `今晚 23:47，${userName} 的对话框会停在中午那句「嗯」。手机屏幕亮起来，是别人的消息。`,
      punchline: "未发送的草稿，会留在草稿箱里很久。\n久到某天打开，已经认不出当时的自己。",
    },
  } as const;

  const card = SHARES[tone];

  // 按 delta 戏剧性排序：|closeness| + |userMood| + |taAffection|
  const keyMoments = rounds
    .map((r) => ({
      time: r.time,
      label: r.eventText.replace(/[，。]/g, " ").slice(0, 12),
      impact: `亲密 ${r.delta.closeness >= 0 ? "+" : ""}${r.delta.closeness} / 心情 ${
        r.delta.userMood >= 0 ? "+" : ""
      }${r.delta.userMood}`,
      note: r.delta.reason.slice(0, 30),
      _magnitude:
        Math.abs(r.delta.closeness) +
        Math.abs(r.delta.userMood) +
        Math.abs(r.delta.taAffection),
    }))
    .sort((a, b) => b._magnitude - a._magnitude)
    .slice(0, 5)
    .map(({ _magnitude, ...rest }) => rest);

  return {
    shareCard: card,
    analysis: {
      yourProjection: `你在这次推演里反复让 ${taName}「打了字又删」、让 ${taName} 在最后关头主动一次。这不是 ${taName} 真在做什么，是你**希望** ${taName} 在做的。你的剧本暴露的是你的渴望：你需要对方先松一格，才敢承认自己已经松了三格。`,
      yourPosition: `${baziLine}。${dayPillar}日生 + 你答题里反复出现的"用台阶代替表白"倾向 —— 你在亲密关系里的本能站位是：把真心藏在借口后面，等对方主动揭开。这种站位让你吸引"愿意慢慢看你"的人，但也容易把不愿主动揭的人留下。`,
      yourBlindSpot: `你最容易把 ${taName} 的"短回复"解读成"在意得不敢多说"。但同样的短回复，也可能只是"今天有点累没多想"。你的剧本里每个"嗯"都被赋予多重含义 —— 这不是 ${taName} 的复杂，是你不愿接受 ${taName} 可能没那么复杂。`,
    },
    keyMoments,
  };
}

// ============================================================
// 向后兼容：旧的 mockRoundEngine 签名（4 参数）
// ============================================================
export function mockDmSystem(_base: BaseProfile, prevRounds: RoundEvent[] = []) {
  const idx = prevRounds.length % ROUND_TEMPLATES.length;
  const t = ROUND_TEMPLATES[idx];
  return { time: t.time, eventText: t.eventText };
}
export function mockUserMirror(_base: BaseProfile, _user: AgentForm) {
  return [{ kind: "message" as const, content: "嗯。" }];
}
export function mockCrushBot(_base: BaseProfile, _ta: AgentForm) {
  return [{ kind: "message" as const, content: "嗯。" }];
}
export function mockScenarioPlayer(...args: any[]) {
  return mockRoundEngine(args[0], args[1], args[2], args[3]);
}
