"use client";

import type {
  AgentForm,
  BaseProfile,
  RelationshipState,
  RoundEvent,
} from "./types";

async function callAgent<T>(agent: string, payload: any): Promise<T> {
  const r = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, payload }),
  });
  if (!r.ok) throw new Error(`agent ${agent} failed: ${r.status}`);
  return (await r.json()) as T;
}

// ============================================
// Round-Engine · 推进时间一回合
// ============================================
export interface RoundEngineResult {
  time: string;
  eventText: string;
  userAction: string;
  taAction: string;
  beats: Array<{ role: string; kind: string; content: string }>;
  delta: {
    closeness: number;
    userMood: number;
    taAffection: number;
    taMood: number;
    reason: string;
  };
}

export async function callRoundEngine(args: {
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  state: RelationshipState;
  prevRounds: RoundEvent[];
  hint?: string;
  images?: string[];
}) {
  return callAgent<RoundEngineResult>("round-engine", args);
}

// ============================================
// Peek-Mind · 读心
// ============================================
export interface PeekMindResult {
  taMoodLabel: string;
  taAttitude: string;
  innerMonologue: string;
  userBlindSpot: string;
}

export async function callPeekMind(args: {
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  state: RelationshipState;
  prevRounds: RoundEvent[];
}) {
  return callAgent<PeekMindResult>("peek-mind", args);
}

// ============================================
// Intervene · 用户介入
// ============================================
export async function callIntervene(args: {
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  state: RelationshipState;
  prevRounds: RoundEvent[];
  userInputType: "message" | "post" | "wait";
  userInputContent: string;
}) {
  return callAgent<RoundEngineResult>("intervene", args);
}

// ============================================
// Relationship-Summary · 终局报告
// ============================================
export async function callRelationshipSummary(args: {
  base: BaseProfile;
  userAgent: AgentForm;
  taAgent: AgentForm;
  rounds: RoundEvent[];
  finalState: RelationshipState;
}) {
  return callAgent<{
    shareCard: {
      title: string;
      prophecyLine: string;
      punchline: string;
    };
    analysis: {
      yourProjection: string;
      yourPosition: string;
      yourBlindSpot: string;
    };
    keyMoments?: Array<{
      time: string;
      label: string;
      impact: string;
      note: string;
    }>;
  }>("relationship-summary", args);
}
