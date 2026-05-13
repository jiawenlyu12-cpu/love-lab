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
  ScenarioMode,
  SimPhase,
  SimulationState,
  StateDelta,
} from "../types";

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

// 根据 Q1 关系阶段答案推导初始 RelationshipState
function deriveInitialRelationship(answers: QuizAnswer[]): RelationshipState {
  const q1 = answers.find((a) => a.questionId === "q1_stage");
  switch (q1?.optionKey) {
    case "A": // 破冰期
      return { closeness: 22, userMood: 60, taAffection: 18, taMood: 52 };
    case "B": // 高度暧昧
      return { closeness: 58, userMood: 55, taAffection: 62, taMood: 55 };
    case "C": // 冷战
      return { closeness: 38, userMood: 32, taAffection: 50, taMood: 28 };
    case "D": // 断联
      return { closeness: 14, userMood: 42, taAffection: 30, taMood: 45 };
    default:
      return DEFAULT_RELATIONSHIP;
  }
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

interface SimStore extends SimulationState {
  setBase: (p: Partial<BaseProfile>) => void;
  initAgentsFromBase: () => void;

  addQuizAnswer: (a: QuizAnswer) => void;
  pushUserTrait: (t: string) => void;
  pushTaTrait: (t: string) => void;
  shiftUserHue: (delta: number) => void;
  shiftTaHue: (delta: number) => void;

  // ⭐ 沙盘新 actions
  initRelationship: () => void;
  appendRound: (r: RoundEvent) => void;
  applyDelta: (d: StateDelta) => RelationshipState;
  // 撤销最后一个回合（重玩）：丢弃 round 并反向 delta
  popLastRound: () => RoundEvent | null;
  consumePeek: () => boolean; // 返回是否扣成功（剩余 > 0）

  setFinalSummary: (s: FinalSummary) => void;

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
  scenes: [] as PlayScene[],
  prefetched: [] as PlayScene[],
  finalSummary: null as FinalSummary | null,
  phase: "setup" as SimPhase,
  scenarioMode: null as ScenarioMode | null,
};

const initialState: SimulationState = {
  base: DEFAULT_BASE,
  ...initialGame,
};

export const useSimStore = create<SimStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setBase: (p) => set({ base: { ...get().base, ...p } }),

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

      // ⭐ 沙盘 actions
      initRelationship: () => {
        const r = deriveInitialRelationship(get().quizAnswers);
        set({ relationship: r, rounds: [], peeksRemaining: 3 });
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
      resetAll: () => set({ ...initialState }),
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
