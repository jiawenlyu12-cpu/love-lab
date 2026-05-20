"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AgentForm,
  BaseProfile,
  FinalSummary,
  PlayScene,
  QuizAnswer,
  RelationshipState,
  RoundEvent,
  SavedAgentSet,
  ScenarioMode,
  SimPhase,
  SimulationState,
  StateDelta,
} from "../types";
import { deriveArchetype } from "../relationship-archetype";

const DEFAULT_BASE: BaseProfile = {
  name: "",
  birthday: "",
  mbti: "",
  taName: "",
};

const DEFAULT_USER_AGENT: AgentForm = {
  name: "",
  avatarSeed: "user",
  traits: [],
  hue: 350,
};

const DEFAULT_TA_AGENT: AgentForm = {
  name: "Ta",
  avatarSeed: "ta",
  traits: [],
  hue: 210,
};

// 默认关系状态（4 维都 0-100）— 兜底
const DEFAULT_RELATIONSHIP: RelationshipState = {
  closeness: 40,
  userMood: 50,
  taAffection: 40,
  taMood: 50,
};

// 根据 Q1 关系阶段答案推导初始 RelationshipState（新 4 选项语义）
function deriveInitialRelationship(answers: QuizAnswer[]): RelationshipState {
  const q1 = answers.find((a) => a.questionId === "q1_stage");
  switch (q1?.optionKey) {
    case "A": // 暗恋期（ta 还不知道）— 用户单方面情绪高、ta 隐藏好感很低
      return { closeness: 12, userMood: 65, taAffection: 15, taMood: 52 };
    case "B": // 暧昧期（双向心照）— 高 all
      return { closeness: 58, userMood: 55, taAffection: 62, taMood: 55 };
    case "C": // 在一起了（恋爱中）— 已建立的暖
      return { closeness: 70, userMood: 60, taAffection: 68, taMood: 58 };
    case "D": // 关系卡住了（冷战 / 断联 / 想重连）— 低暖、用户焦虑、ta 情绪低
      return { closeness: 28, userMood: 35, taAffection: 42, taMood: 32 };
    default:
      return DEFAULT_RELATIONSHIP;
  }
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface SimPreset {
  base: BaseProfile;
  userTraits: string[];
  taTraits: string[];
  quizAnswers: QuizAnswer[];
}

interface SimStore extends SimulationState {
  setBase: (p: Partial<BaseProfile>) => void;
  setChatScreenshots: (imgs: string[]) => void;
  addChatScreenshot: (img: string) => void;
  removeChatScreenshot: (idx: number) => void;
  initAgentsFromBase: () => void;

  addQuizAnswer: (a: QuizAnswer) => void;
  pushUserTrait: (t: string) => void;
  pushTaTrait: (t: string) => void;
  shiftUserHue: (delta: number) => void;
  shiftTaHue: (delta: number) => void;

  // Atomic one-shot seed: collapses resetAll → setBase → initAgentsFromBase →
  // addQuizAnswer × N → pushUserTrait × N → pushTaTrait × N → initRelationship
  // → setPhase("play") into a single set() so subscribers re-render once.
  applyPreset: (p: SimPreset) => void;

  initRelationship: () => void;
  appendRound: (r: RoundEvent) => void;
  applyDelta: (d: StateDelta) => RelationshipState;
  // 撤销最后一个回合（重玩）：丢弃 round 并反向 delta
  popLastRound: () => RoundEvent | null;
  consumePeek: () => boolean; // 返回是否扣成功（剩余 > 0）

  setFinalSummary: (s: FinalSummary) => void;

  // ⭐ 保留 agent 人设，只清沙盘 → 直接进 /simulator 重推一次
  // replayCount 自增，prompt 层据此让剧情走不同方向
  keepAgentsResetRounds: () => void;

  // ⭐ 人设库 actions
  saveCurrentToLibrary: () => string;      // 返回 id（空字符串 = 没存：人设不完整）
  loadFromLibrary: (id: string) => void;   // 载入到 current + 清沙盘 + 跳 simulator
  deleteFromLibrary: (id: string) => void;

  // 老字段（兼容）
  pushPrefetched: (s: PlayScene) => void;
  popPrefetched: () => PlayScene | null;
  clearPrefetched: () => void;
  appendScene: (s: PlayScene) => void;
  setScenarioMode: (m: ScenarioMode | null) => void;

  setPhase: (p: SimPhase) => void;

  resetGame: () => void;
  resetAll: () => void;
}

const initialGame = {
  quizAnswers: [] as QuizAnswer[],
  userAgent: DEFAULT_USER_AGENT,
  taAgent: DEFAULT_TA_AGENT,
  rounds: [] as RoundEvent[],
  relationship: DEFAULT_RELATIONSHIP,
  peeksRemaining: 3,
  replayCount: 0,
  archetype: null as SimulationState["archetype"],
  chatScreenshots: [] as string[],
  scenes: [] as PlayScene[],
  prefetched: [] as PlayScene[],
  finalSummary: null as FinalSummary | null,
  phase: "setup" as SimPhase,
  scenarioMode: null as ScenarioMode | null,
};

const initialState: SimulationState = {
  base: DEFAULT_BASE,
  ...initialGame,
  agentLibrary: [] as SavedAgentSet[],
};

// 人设库去重签名：name + taName + birthday + mbti
// 同一组身份再次保存 → 更新时间戳而不是新增
function libSignature(base: BaseProfile): string {
  return [base.name, base.taName, base.birthday, base.mbti].join("::");
}

const LIBRARY_MAX = 10;

export const useSimStore = create<SimStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setBase: (p) => set({ base: { ...get().base, ...p } }),
      setChatScreenshots: (imgs) => set({ chatScreenshots: imgs.slice(0, 5) }),
      addChatScreenshot: (img) => {
        const cur = get().chatScreenshots || [];
        if (cur.length >= 5) return;
        set({ chatScreenshots: [...cur, img] });
      },
      removeChatScreenshot: (idx) => {
        const cur = get().chatScreenshots || [];
        set({ chatScreenshots: cur.filter((_, i) => i !== idx) });
      },

      initAgentsFromBase: () => {
        const b = get().base;
        set({
          userAgent: {
            ...DEFAULT_USER_AGENT,
            name: b.name || "你",
            avatarSeed: b.name || "user",
          },
          taAgent: {
            ...DEFAULT_TA_AGENT,
            name: b.taName || "Ta",
            avatarSeed: b.taName || "ta",
          },
        });
      },

      addQuizAnswer: (a) => set({ quizAnswers: [...get().quizAnswers, a] }),

      pushUserTrait: (t) => {
        const cur = get().userAgent;
        if (cur.traits.includes(t)) return;
        set({ userAgent: { ...cur, traits: [...cur.traits, t] } });
      },
      pushTaTrait: (t) => {
        const cur = get().taAgent;
        if (cur.traits.includes(t)) return;
        set({ taAgent: { ...cur, traits: [...cur.traits, t] } });
      },
      shiftUserHue: (delta) => {
        const cur = get().userAgent;
        set({ userAgent: { ...cur, hue: (cur.hue + delta + 360) % 360 } });
      },
      shiftTaHue: (delta) => {
        const cur = get().taAgent;
        set({ taAgent: { ...cur, hue: (cur.hue + delta + 360) % 360 } });
      },

      applyPreset: (p) => {
        const dedupe = (xs: string[]) => Array.from(new Set(xs));
        const curLib = get().agentLibrary || [];
        const archetype = p.quizAnswers.length > 0
          ? deriveArchetype(p.quizAnswers)
          : null;
        set({
          ...initialState,
          agentLibrary: curLib, // 保留人设库不被 preset 清掉
          base: { ...DEFAULT_BASE, ...p.base },
          userAgent: {
            ...DEFAULT_USER_AGENT,
            name: p.base.name || "你",
            avatarSeed: p.base.name || "user",
            traits: dedupe(p.userTraits),
          },
          taAgent: {
            ...DEFAULT_TA_AGENT,
            name: p.base.taName || "Ta",
            avatarSeed: p.base.taName || "ta",
            traits: dedupe(p.taTraits),
          },
          quizAnswers: p.quizAnswers,
          relationship: deriveInitialRelationship(p.quizAnswers),
          archetype,
          phase: "play",
        });
      },

      // ⭐ 沙盘 actions
      initRelationship: () => {
        const ans = get().quizAnswers;
        const r = deriveInitialRelationship(ans);
        // 同步推导关系剧本类型（注入 LLM 用）
        const archetype = ans.length > 0 ? deriveArchetype(ans) : null;
        set({
          relationship: r,
          rounds: [],
          peeksRemaining: 3,
          archetype,
        });
      },

      appendRound: (r) => set({ rounds: [...get().rounds, r] }),

      popLastRound: () => {
        const cur = get();
        const rs = cur.rounds;
        if (rs.length === 0) return null;
        const last = rs[rs.length - 1];
        const rel = cur.relationship;
        const reverted: RelationshipState = {
          closeness: clamp(rel.closeness - last.delta.closeness),
          userMood: clamp(rel.userMood - last.delta.userMood),
          taAffection: clamp(rel.taAffection - last.delta.taAffection),
          taMood: clamp(rel.taMood - last.delta.taMood),
        };
        set({ rounds: rs.slice(0, -1), relationship: reverted });
        return last;
      },

      applyDelta: (d) => {
        const cur = get().relationship;
        const next: RelationshipState = {
          closeness: clamp(cur.closeness + d.closeness),
          userMood: clamp(cur.userMood + d.userMood),
          taAffection: clamp(cur.taAffection + d.taAffection),
          taMood: clamp(cur.taMood + d.taMood),
        };
        set({ relationship: next });
        return next;
      },

      consumePeek: () => {
        const cur = get().peeksRemaining;
        if (cur <= 0) return false;
        set({ peeksRemaining: cur - 1 });
        return true;
      },

      setFinalSummary: (s) => set({ finalSummary: s }),

      keepAgentsResetRounds: () => {
        const cur = get();
        const r = deriveInitialRelationship(cur.quizAnswers);
        const sig = libSignature(cur.base);
        // 顺手在 library 里更新 lastUsedAt / playCount
        const updatedLib = (cur.agentLibrary || []).map((s) =>
          libSignature(s.base) === sig
            ? { ...s, lastUsedAt: Date.now(), playCount: s.playCount + 1 }
            : s
        );
        set({
          rounds: [],
          relationship: r,
          peeksRemaining: 3,
          finalSummary: null,
          scenes: [],
          prefetched: [],
          phase: "play",
          replayCount: (cur.replayCount || 0) + 1,
          agentLibrary: updatedLib,
        });
      },

      saveCurrentToLibrary: () => {
        const cur = get();
        // 人设没捏完不存
        if (!cur.base.name?.trim() || cur.userAgent.traits.length === 0) {
          return "";
        }
        const sig = libSignature(cur.base);
        const existing = (cur.agentLibrary || []).find(
          (s) => libSignature(s.base) === sig
        );
        if (existing) {
          // 已存在 → 更新内容快照 + lastUsedAt + playCount++
          const next: SavedAgentSet = {
            ...existing,
            base: cur.base,
            userAgent: cur.userAgent,
            taAgent: cur.taAgent,
            quizAnswers: cur.quizAnswers,
            lastUsedAt: Date.now(),
            playCount: existing.playCount + 1,
          };
          set({
            agentLibrary: cur.agentLibrary.map((s) =>
              s.id === existing.id ? next : s
            ),
          });
          return existing.id;
        }
        // 新增
        const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const item: SavedAgentSet = {
          id,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          playCount: 1,
          base: cur.base,
          userAgent: cur.userAgent,
          taAgent: cur.taAgent,
          quizAnswers: cur.quizAnswers,
        };
        let lib = [...(cur.agentLibrary || []), item];
        // 超过上限 → 按 lastUsedAt 倒序保留 LIBRARY_MAX 条
        if (lib.length > LIBRARY_MAX) {
          lib = lib
            .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
            .slice(0, LIBRARY_MAX);
        }
        set({ agentLibrary: lib });
        return id;
      },

      loadFromLibrary: (id) => {
        const cur = get();
        const entry = (cur.agentLibrary || []).find((s) => s.id === id);
        if (!entry) return;
        const rel = deriveInitialRelationship(entry.quizAnswers);
        const archetype = entry.quizAnswers.length > 0
          ? deriveArchetype(entry.quizAnswers)
          : null;
        set({
          base: entry.base,
          userAgent: entry.userAgent,
          taAgent: entry.taAgent,
          quizAnswers: entry.quizAnswers,
          rounds: [],
          relationship: rel,
          peeksRemaining: 3,
          finalSummary: null,
          scenes: [],
          prefetched: [],
          phase: "play",
          replayCount: 0,
          archetype,
          agentLibrary: (cur.agentLibrary || []).map((s) =>
            s.id === id
              ? { ...s, lastUsedAt: Date.now(), playCount: s.playCount + 1 }
              : s
          ),
        });
      },

      deleteFromLibrary: (id) => {
        set({
          agentLibrary: (get().agentLibrary || []).filter((s) => s.id !== id),
        });
      },

      // 老字段（兼容）
      pushPrefetched: (s) =>
        set({ prefetched: [...get().prefetched, s] }),
      popPrefetched: () => {
        const cur = get().prefetched;
        if (cur.length === 0) return null;
        const [first, ...rest] = cur;
        set({ prefetched: rest });
        return first;
      },
      clearPrefetched: () => set({ prefetched: [] }),
      appendScene: (s) => set({ scenes: [...get().scenes, s] }),
      setScenarioMode: (m) => set({ scenarioMode: m }),

      setPhase: (p) => set({ phase: p }),

      resetGame: () => set({ ...initialGame }),
      resetAll: () =>
        set({ ...initialState, agentLibrary: get().agentLibrary || [] }),
    }),
    {
      name: "ai-love-lab-sim",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as never)
      ),
      // ⚠️ 版本升到 9：清空老缓存（数据结构大改）
      version: 9,
    }
  )
);
