"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useSimStore } from "@/lib/store/simulation-store";
import {
  callRoundEngine,
  callPeekMind,
  callIntervene,
  callRelationshipSummary,
  type PeekMindResult,
  type RoundEngineResult,
} from "@/lib/engine";
import type { Beat, BeatKind, RoundEvent, StateDelta } from "@/lib/types";
import SandboxHud from "@/components/sandbox/SandboxHud";
import RoundDigest from "@/components/sandbox/RoundDigest";
import PeekMindModal from "@/components/sandbox/PeekMindModal";
import InterveneModal from "@/components/sandbox/InterveneModal";
import ScenarioPicker from "@/components/sandbox/ScenarioPicker";
import { buildOpeningProphecy } from "@/lib/opening-prophecy";
import { cn, uid } from "@/lib/utils";
import { track } from "@/lib/analytics";

type LocalPhase =
  | "idle"
  | "advancing"
  | "intervening"
  | "peeking"
  | "final_loading";

// 回合数硬上限
const MAX_ROUNDS = 10;

export default function SimulatorPage() {
  const router = useRouter();
  const {
    base,
    userAgent,
    taAgent,
    rounds,
    relationship,
    peeksRemaining,
    quizAnswers,
    finalSummary,
    replayCount,
    archetype,
    chatScreenshots,
    setBase,
    initRelationship,
    appendRound,
    applyDelta,
    popLastRound,
    consumePeek,
    setFinalSummary,
    setPhase: setStorePhase,
  } = useSimStore();

  const [phase, setPhase] = useState<LocalPhase>("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [showIntervene, setShowIntervene] = useState(false);
  const [peekResult, setPeekResult] = useState<PeekMindResult | null>(null);

  // 翻页状态
  const [currentPage, setCurrentPage] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  // 下一回合的 prefetch 缓存（用户读当前回合时后台跑）
  const prefetchRef = useRef<{
    result: RoundEngineResult;
    basedOn: number; // 基于 rounds.length 为此值时的状态
  } | null>(null);

  // 守卫 + 初始化
  useEffect(() => {
    if (!base.name || !base.taName) {
      router.replace("/setup");
      return;
    }
    if (userAgent.traits.length === 0 && taAgent.traits.length === 0) {
      router.replace("/builder");
      return;
    }
    track("simulator_opened");
    if (rounds.length === 0 && quizAnswers.length > 0) {
      initRelationship();
      track("prophecy_viewed");
    } else if (rounds.length > 0) {
      setCurrentPage(rounds.length - 1);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);


  // 当用户翻到最后一页 + 还能推进 + 没在 busy + 没已缓存 → 偷偷 prefetch
  useEffect(() => {
    const canPrefetch =
      rounds.length > 0 &&
      rounds.length < MAX_ROUNDS &&
      currentPage === rounds.length - 1 &&
      !busy &&
      !prefetchRef.current;
    if (canPrefetch) {
      void prefetchNextRound();
    }
  }, [currentPage, rounds.length, phase]); // eslint-disable-line

  // 介入 / 撤销 后立即失效 prefetch
  function invalidatePrefetch() {
    prefetchRef.current = null;
  }

  function consumeRoundResult(r: RoundEngineResult, intervened = false) {
    const allowed: BeatKind[] = ["message", "typing_revoked", "inner_flash"];
    const beats: Beat[] = (r.beats || [])
      .filter((b: any) => b && allowed.includes(b.kind as BeatKind))
      .map((b: any) => {
        let role: Beat["role"] = (b.role as any) || "user-agent";
        if (role === "ta-agent" && b.kind === "inner_flash") role = "user-agent";
        return {
          id: uid(),
          role,
          kind: b.kind as BeatKind,
          content: (b.content || "").trim() || "（沉默了一会）",
        };
      });

    const delta: StateDelta = {
      closeness: clampDelta(r.delta.closeness),
      userMood: clampDelta(r.delta.userMood),
      taAffection: clampDelta(r.delta.taAffection),
      taMood: clampDelta(r.delta.taMood),
      reason: r.delta.reason || "",
    };
    const stateAfter = applyDelta(delta);

    const round: RoundEvent = {
      id: uid(),
      round: rounds.length + 1,
      time: r.time,
      eventText: r.eventText,
      userAction: r.userAction,
      taAction: r.taAction,
      beats,
      delta,
      stateAfter,
      intervened,
    };
    appendRound(round);
    // 新回合产生后自动翻到最新页
    setSlideDir(1);
    setCurrentPage(useSimStore.getState().rounds.length - 1);
  }

  async function advance() {
    if (rounds.length >= MAX_ROUNDS) {
      setToast("已经 10 个回合，可以看主预言了");
      return;
    }
    track("round_advance");
    if (rounds.length === 0 && (chatScreenshots?.length ?? 0) > 0) {
      track("round_first_with_screenshots");
    }
    setPhase("advancing");
    try {
      // ⚡ 优先用 prefetched 缓存（仅当基于的回合数仍匹配，即用户没介入 / 没撤销）
      if (
        prefetchRef.current &&
        prefetchRef.current.basedOn === rounds.length
      ) {
        const cached = prefetchRef.current.result;
        prefetchRef.current = null;
        consumeRoundResult(cached, false);
        return;
      }
      const r = await callRoundEngine({
        base,
        userAgent,
        taAgent,
        state: relationship,
        prevRounds: rounds,
        replayCount,
        archetype,
        scenarioHint: base.scenarioHint,
        quizAnswers,
        images: chatScreenshots,
        keyDate: prophecy.keyDay.date,
      });
      consumeRoundResult(r, false);
    } catch (e) {
      console.error(e);
      setToast("推进失败，请重试");
    } finally {
      setPhase("idle");
    }
  }

  // 后台 prefetch 下一回合：用户读当前回合期间偷偷跑 LLM
  async function prefetchNextRound() {
    const basedOn = rounds.length;
    if (basedOn >= MAX_ROUNDS) return;
    try {
      const r = await callRoundEngine({
        base,
        userAgent,
        taAgent,
        state: relationship,
        prevRounds: rounds,
        replayCount,
        archetype,
        scenarioHint: base.scenarioHint,
        quizAnswers,
        images: chatScreenshots,
        keyDate: prophecy.keyDay.date,
      });
      // 拿到结果时如果 state 已经变了（用户介入 / 撤销 / 再推进），就不采用
      if (useSimStore.getState().rounds.length === basedOn) {
        prefetchRef.current = { result: r, basedOn };
      }
    } catch {
      /* 静默失败 — advance() 会再 fetch */
    }
  }

  // 重玩本回合：撤销最后一个 round（反向 delta），再 advance 一次
  async function rerollLastRound() {
    if (rounds.length === 0 || busy) return;
    track("round_reroll");
    const popped = popLastRound();
    if (!popped) return;
    invalidatePrefetch();
    setCurrentPage((p) => Math.max(0, p - 1));
    setToast("已撤销，重新推算中…");
    await new Promise((r) => setTimeout(r, 400));
    void advance();
  }

  async function handleIntervene(
    type: "message" | "post" | "wait",
    content: string
  ) {
    setShowIntervene(false);
    if (rounds.length >= MAX_ROUNDS) {
      setToast("已经 10 个回合，可以看主预言了");
      return;
    }
    track("intervene_submit");
    invalidatePrefetch(); // 介入会改变状态，prefetched 失效
    setPhase("intervening");
    try {
      const r = await callIntervene({
        base,
        userAgent,
        taAgent,
        state: relationship,
        prevRounds: rounds,
        userInputType: type,
        userInputContent: content,
        replayCount,
        archetype,
        scenarioHint: base.scenarioHint,
        quizAnswers,
        images: chatScreenshots,
        keyDate: prophecy.keyDay.date,
      });
      consumeRoundResult(r, true);
    } catch (e) {
      console.error(e);
      setToast("介入失败，请重试");
    } finally {
      setPhase("idle");
    }
  }

  async function handlePeek() {
    if (peeksRemaining <= 0) {
      setToast("读心次数已用完");
      return;
    }
    if (!consumePeek()) return;
    track("peek_used");
    setPhase("peeking");
    try {
      const r = await callPeekMind({
        base,
        userAgent,
        taAgent,
        state: relationship,
        prevRounds: rounds,
      });
      setPeekResult(r);
    } catch (e) {
      console.error(e);
      setToast("读心失败，请重试");
    } finally {
      setPhase("idle");
    }
  }

  async function runFinal() {
    setPhase("final_loading");
    try {
      const r = await callRelationshipSummary({
        base,
        userAgent,
        taAgent,
        rounds,
        finalState: relationship,
        replayCount,
        archetype,
        scenarioHint: base.scenarioHint,
        keyDate: prophecy.keyDay.date,
      });
      setFinalSummary({
        shareCard: r.shareCard,
        fiveTwenty: (r as any).fiveTwenty,
        analysis: r.analysis,
        keyMoments: r.keyMoments,
      });
      setStorePhase("report");
      router.push("/report");
    } catch (e) {
      console.error(e);
      setToast("终局生成失败");
      setPhase("idle");
    }
  }

  const userName = userAgent.name || base.name || "你";
  const taName = taAgent.name || base.taName || "Ta";

  const prophecy = useMemo(
    () =>
      buildOpeningProphecy({
        base,
        quizAnswers,
        chatScreenshotsCount: chatScreenshots?.length ?? 0,
      }),
    [base, quizAnswers, chatScreenshots]
  );

  const busy =
    phase === "advancing" ||
    phase === "intervening" ||
    phase === "peeking" ||
    phase === "final_loading";

  const totalPages = rounds.length;
  const isFirstPage = currentPage <= 0;
  const isLastPage = currentPage >= totalPages - 1;
  const atRoundCap = rounds.length >= MAX_ROUNDS;
  const currentRound = rounds[currentPage];

  // 下一页 / 推进 / 看主预言 的统一行为
  function goNext() {
    if (busy) return;
    if (!isLastPage) {
      setSlideDir(1);
      setCurrentPage((p) => p + 1);
    } else if (atRoundCap) {
      void runFinal();
    } else {
      void advance();
    }
  }

  function goPrev() {
    if (busy) return;
    if (isFirstPage) return;
    setSlideDir(-1);
    setCurrentPage((p) => p - 1);
  }

  function handleDragEnd(_: any, info: PanInfo) {
    if (busy) return;
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (offset < -60 || velocity < -400) goNext();
    else if (offset > 60 || velocity > 400) goPrev();
  }

  const nextLabel = !isLastPage
    ? "下一回合"
    : atRoundCap
    ? "看主预言卡"
    : "推进时间";

  return (
    <main className="min-h-[100svh] flex flex-col">
      {/* 顶部导航 */}
      <header className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 glass border-b border-rose-300/5 sticky top-0 z-20">
        <Link
          href="/builder"
          className="text-rose-200/60 text-sm hover:text-rose-100 py-1 px-1 -mx-1"
        >
          ←
        </Link>
        <div className="text-rose-200/55 text-[10px] sm:text-[11px] tracking-wider truncate">
          Step 3 / 3 · 关系沙盘
        </div>
        <div className="text-rose-200/55 text-[10px] sm:text-[11px] tabular-nums whitespace-nowrap">
          {rounds.length} / {MAX_ROUNDS}
        </div>
      </header>

      {/* HUD */}
      <SandboxHud
        userAgent={userAgent}
        taAgent={taAgent}
        userName={userName}
        taName={taName}
        state={relationship}
        currentTime={currentRound?.time || "—"}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* === 空态：开局预言 === */}
        {rounds.length === 0 && phase !== "advancing" && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center text-rose-200/55 text-[9.5px] tracking-[0.4em] uppercase mb-1.5">
                ✦ 开 局 预 言 ✦
              </div>
              <h2 className="font-serif-cn text-rose-100 text-xl text-center mb-1 leading-snug">
                {prophecy.headline}
              </h2>
              {prophecy.headlineEvidence && (
                <p className="text-center text-rose-200/50 text-[10px] leading-snug mb-3">
                  {prophecy.headlineEvidence}
                </p>
              )}

              {/* === 双人命盘速览 === */}
              <PairChart
                user={prophecy.user}
                ta={prophecy.ta}
                compatibility={prophecy.compatibility}
              />

              {/* 3 题 → 剧本（一行紧凑版） */}
              {prophecy.archetypeReveal && (
                <div className="mt-3 rounded-xl border border-rose-300/18 bg-white/[0.03] px-3 py-2">
                  <p className="text-rose-100/85 text-[11.5px] leading-snug font-serif-cn">
                    <span className="text-rose-300/80 mr-1.5">
                      ▍{(chatScreenshots?.length ?? 0) > 0 ? "3题+聊天推算" : "3题推算"}
                    </span>
                    {prophecy.archetypeReveal}
                  </p>
                </div>
              )}

              {/* 聊天截图接入提示（仅当用户上传了至少 1 张） */}
              {prophecy.screenshotsLine && (
                <div className="mt-2 rounded-xl border border-rose-300/30 bg-rose-300/[0.06] px-3 py-2">
                  <p className="text-rose-100/95 text-[11.5px] leading-snug">
                    {prophecy.screenshotsLine}
                  </p>
                </div>
              )}

              {/* 关键日（紧凑） */}
              <div className="mt-3 rounded-2xl border border-rose-300/22 bg-rose-300/5 px-3 py-2">
                <p className="text-rose-100/90 text-[12px] leading-snug font-serif-cn">
                  <span className="text-rose-300/85 mr-1.5">⌛ 关键日</span>
                  {prophecy.keyDay.sentence}
                </p>
                {prophecy.keyDay.evidenceLine && (
                  <p className="mt-1 text-rose-200/45 text-[10px] leading-snug">
                    {prophecy.keyDay.evidenceLine}
                  </p>
                )}
              </div>

              {/* 场景选择 */}
              <div className="mt-3">
                <ScenarioPicker
                  value={base.scenarioHint || ""}
                  onChange={(v) => {
                    setBase({ scenarioHint: v });
                    if (v) track("scenario_picked");
                  }}
                />
              </div>

              <button
                onClick={() => void advance()}
                disabled={busy}
                className={cn(
                  "mt-4 w-full py-3 rounded-full text-sm font-medium transition active:scale-95",
                  busy
                    ? "bg-white/5 text-rose-200/30 cursor-not-allowed"
                    : "bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 hover:scale-[1.02] shadow-lg shadow-rose-500/30"
                )}
              >
                翻 开 第 一 页 ⟫
              </button>
            </motion.div>
          </div>
        )}

        {/* === 推算中（首回合 loading）=== */}
        {rounds.length === 0 && phase === "advancing" && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="font-serif-cn text-rose-100/85 text-base">
              沙盘推算中
              <span className="typing-dots" />
            </div>
          </div>
        )}

        {/* === 翻页卡片区 === */}
        {rounds.length > 0 && (
          <>
            {/* 分页指示器 */}
            <div className="flex justify-center items-center gap-1.5 pt-3 pb-1 px-4">
              {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
                const filled = i < rounds.length;
                const active = i === currentPage;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (!filled || busy) return;
                      setSlideDir(i > currentPage ? 1 : -1);
                      setCurrentPage(i);
                    }}
                    aria-label={`回合 ${i + 1}`}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      active
                        ? "w-6 bg-rose-300"
                        : filled
                        ? "w-1.5 bg-rose-300/40 hover:bg-rose-300/70"
                        : "w-1.5 bg-white/10"
                    )}
                  />
                );
              })}
            </div>

            {/* 卡片 */}
            <div className="flex-1 px-4 py-3 relative overflow-hidden">
              <AnimatePresence mode="wait" custom={slideDir}>
                {currentRound && (
                  <motion.div
                    key={currentRound.id}
                    custom={slideDir}
                    variants={{
                      enter: (d: number) => ({
                        x: d > 0 ? 300 : -300,
                        opacity: 0,
                      }),
                      center: { x: 0, opacity: 1 },
                      exit: (d: number) => ({
                        x: d > 0 ? -300 : 300,
                        opacity: 0,
                      }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      type: "spring",
                      stiffness: 280,
                      damping: 30,
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.18}
                    onDragEnd={handleDragEnd}
                    className="absolute inset-0 px-4 py-3 overflow-y-auto"
                  >
                    <RoundDigest
                      round={currentRound}
                      userName={userName}
                      taName={taName}
                      defaultOpen={true}
                      highlight={false}
                      onReroll={
                        isLastPage && !busy && rounds.length > 0 && !atRoundCap
                          ? rerollLastRound
                          : undefined
                      }
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 翻页底部行：箭头 + 当前页 + 推进 */}
            <div
              className="px-4 pt-2 pb-3 border-t border-rose-300/10"
              style={{
                paddingBottom:
                  "calc(env(safe-area-inset-bottom) + 12px)",
              }}
            >
              <div className="max-w-xl mx-auto flex items-center gap-2 mb-2">
                <button
                  onClick={goPrev}
                  disabled={busy || isFirstPage}
                  className={cn(
                    "py-2.5 px-4 rounded-full text-sm transition border active:scale-95",
                    busy || isFirstPage
                      ? "border-white/8 text-rose-200/20 cursor-not-allowed"
                      : "border-rose-300/30 text-rose-200/75 hover:bg-rose-300/5"
                  )}
                >
                  ←
                </button>

                <div className="flex-1 text-center text-rose-200/60 text-[12px] tabular-nums">
                  回合 {currentPage + 1} / {rounds.length}
                  {busy && phase === "advancing" && (
                    <>
                      {" · "}
                      <span className="text-rose-300/85">
                        推算中<span className="typing-dots" />
                      </span>
                    </>
                  )}
                  {busy && phase === "intervening" && (
                    <>
                      {" · "}
                      <span className="text-rose-300/85">
                        {taName} 正在回应<span className="typing-dots" />
                      </span>
                    </>
                  )}
                  {!busy && atRoundCap && !finalSummary && (
                    <>
                      {" · "}
                      <span className="text-rose-300/85">
                        已达 10 回合上限，准备好就点"看主预言卡"
                      </span>
                    </>
                  )}
                </div>

                <button
                  onClick={goNext}
                  disabled={busy}
                  className={cn(
                    "py-2.5 px-4 rounded-full text-sm transition border active:scale-95 whitespace-nowrap",
                    busy
                      ? "border-white/8 text-rose-200/30 cursor-not-allowed"
                      : isLastPage
                      ? "bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 border-transparent shadow-lg shadow-rose-500/25"
                      : "border-rose-300/30 text-rose-200/75 hover:bg-rose-300/5"
                  )}
                >
                  {nextLabel} →
                </button>
              </div>

              {/* 介入 / 读心 (icon-only on mobile) */}
              <div className="max-w-xl mx-auto flex items-center justify-center gap-3">
                <button
                  disabled={busy || atRoundCap}
                  onClick={() => setShowIntervene(true)}
                  className={cn(
                    "py-2 px-4 rounded-full text-[12px] transition border active:scale-95",
                    busy || atRoundCap
                      ? "border-white/8 text-rose-200/25 cursor-not-allowed"
                      : "border-rose-300/30 text-rose-200/75 hover:bg-rose-300/5"
                  )}
                >
                  ✎ 介入
                </button>
                <button
                  disabled={busy || peeksRemaining <= 0 || atRoundCap}
                  onClick={() => void handlePeek()}
                  className={cn(
                    "py-2 px-4 rounded-full text-[12px] transition border active:scale-95 tabular-nums",
                    busy || peeksRemaining <= 0 || atRoundCap
                      ? "border-white/8 text-rose-200/25 cursor-not-allowed"
                      : "border-rose-300/30 text-rose-200/75 hover:bg-rose-300/5"
                  )}
                >
                  👁 读心 · {peeksRemaining}
                </button>
                {rounds.length >= 3 && !atRoundCap && (
                  <button
                    onClick={() => void runFinal()}
                    disabled={busy}
                    className="py-2 px-3 text-[11px] text-rose-200/50 hover:text-rose-100 underline-offset-2 hover:underline"
                  >
                    够了 · 看主预言
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* === 终局 loading === */}
        {phase === "final_loading" && rounds.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-midnight-900/85 backdrop-blur-sm z-40">
            <div className="font-serif-cn text-rose-100 text-lg text-center px-6">
              AI 正在为这段关系写主预言
              <span className="typing-dots" />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {peekResult && (
          <PeekMindModal
            data={peekResult}
            taName={taName}
            remaining={peeksRemaining}
            onClose={() => setPeekResult(null)}
            onPeekAgain={async () => {
              setPeekResult(null);
              await new Promise((r) => setTimeout(r, 200));
              void handlePeek();
            }}
          />
        )}
        {showIntervene && (
          <InterveneModal
            taName={taName}
            onSubmit={handleIntervene}
            onClose={() => setShowIntervene(false)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 110px)" }}
            className="fixed left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-midnight-700 border border-rose-300/30 text-rose-100 text-sm shadow-lg z-50 max-w-[90vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function clampDelta(v: number): number {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return Math.max(-10, Math.min(10, Math.round(v)));
}

// ====== 双人命盘速览：两个圆 + 中间相位连线 ======
const ELEMENT_COLOR: Record<string, string> = {
  火: "from-orange-300/35 to-red-400/35 border-orange-300/55",
  土: "from-amber-300/30 to-yellow-700/30 border-amber-300/50",
  风: "from-cyan-200/30 to-blue-300/30 border-cyan-200/55",
  水: "from-blue-300/30 to-indigo-400/30 border-blue-300/55",
};

const ENERGY_COLOR: Record<string, string> = {
  同频: "text-emerald-200",
  和谐: "text-emerald-200",
  互补: "text-cyan-200",
  张力: "text-amber-200",
  互照: "text-violet-200",
  中性: "text-rose-200/60",
};

function PairChart({
  user,
  ta,
  compatibility,
}: {
  user: import("@/lib/types").AstroBeing;
  ta: import("@/lib/types").AstroBeing;
  compatibility: NonNullable<
    import("@/lib/types").OpeningProphecy["compatibility"]
  > | null;
}) {
  return (
    <div className="rounded-2xl border border-rose-300/15 bg-white/[0.02] px-3 py-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <AstroOrb being={user} side="left" />
        <div className="flex flex-col items-center min-w-[90px]">
          {compatibility ? (
            <>
              <div
                className={cn(
                  "font-serif-cn text-[13px] tracking-wider",
                  ENERGY_COLOR[compatibility.sign.energy] || "text-rose-100"
                )}
              >
                {compatibility.sign.energy}
              </div>
              <div className="my-1.5 w-full h-px bg-gradient-to-r from-rose-300/10 via-rose-300/55 to-rose-300/10" />
              <div className="text-rose-200/55 text-[10px] tabular-nums">
                相距 {compatibility.distance} 宫
              </div>
              <div className="text-rose-200/45 text-[9.5px] mt-0.5">
                {aspectShortLabel(compatibility.sign.kind)}
              </div>
            </>
          ) : (
            <>
              <div className="text-rose-200/35 text-[11px]">—</div>
              <div className="my-1.5 w-full h-px bg-rose-300/10" />
              <div className="text-rose-200/40 text-[9.5px] text-center leading-tight">
                填了 ta 生日
                <br />
                才能算合盘
              </div>
            </>
          )}
        </div>
        <AstroOrb being={ta} side="right" />
      </div>
    </div>
  );
}

function aspectShortLabel(kind: string): string {
  switch (kind) {
    case "conjunction":
      return "合相";
    case "trine":
      return "三分相";
    case "sextile":
      return "六分相";
    case "square":
      return "四分相";
    case "opposition":
      return "对分相";
    default:
      return "中性位";
  }
}

function AstroOrb({
  being,
  side,
}: {
  being: import("@/lib/types").AstroBeing;
  side: "left" | "right";
}) {
  const elementClass =
    (being.element && ELEMENT_COLOR[being.element]) ||
    "from-white/5 to-white/0 border-white/15";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "w-16 h-16 rounded-full border bg-gradient-to-br flex flex-col items-center justify-center text-center",
          elementClass
        )}
      >
        {being.sign ? (
          <>
            <div className="font-serif-cn text-rose-50 text-[15px] leading-none">
              {being.sign}
            </div>
            <div className="text-rose-100/65 text-[10px] mt-0.5">
              {being.element}象
            </div>
          </>
        ) : (
          <div className="text-rose-100/45 text-[10px] leading-tight px-2">
            未填生日
          </div>
        )}
      </div>
      <div className="text-rose-100/80 text-[11px] font-medium truncate max-w-[96px]">
        {being.name}
      </div>
      <div className="flex flex-col items-center gap-0.5 text-[9.5px] text-rose-200/60 leading-tight">
        {being.mbti && <span>{being.mbti}</span>}
        {being.attachmentTypeZh && (
          <span className="truncate max-w-[110px]">
            {being.attachmentTypeZh.split("（")[0]}
          </span>
        )}
        {being.scriptZh && side === "left" && (
          <span className="text-rose-300/65">{being.scriptZh}</span>
        )}
      </div>
    </div>
  );
}
