"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSimStore } from "@/lib/store/simulation-store";
import { QUIZ_QUESTIONS } from "@/lib/quiz";
import QAvatar from "@/components/avatar/QAvatar";
import { cn } from "@/lib/utils";
import type { QuizAnswer, QuizOption } from "@/lib/types";

export default function BuilderPage() {
  const router = useRouter();
  const {
    base,
    userAgent,
    taAgent,
    quizAnswers,
    initAgentsFromBase,
    addQuizAnswer,
    pushUserTrait,
    pushTaTrait,
    shiftUserHue,
    shiftTaHue,
    setPhase,
    initRelationship,
  } = useSimStore();

  const [qIndex, setQIndex] = useState(0);
  const [highlightUser, setHighlightUser] = useState(false);
  const [highlightTa, setHighlightTa] = useState(false);
  const [locked, setLocked] = useState(false);

  // 进入页面时确保 agent 已初始化
  useEffect(() => {
    if (!base.name || !base.taName) {
      router.replace("/setup");
      return;
    }
    if (userAgent.traits.length === 0 && taAgent.traits.length === 0) {
      initAgentsFromBase();
    }
    setPhase("builder");
  }, []); // eslint-disable-line

  const totalQ = QUIZ_QUESTIONS.length;
  const done = qIndex >= totalQ;
  const currentQ = !done ? QUIZ_QUESTIONS[qIndex] : null;

  function pick(opt: QuizOption) {
    if (locked || !currentQ) return;
    setLocked(true);
    const answer: QuizAnswer = {
      questionId: currentQ.id,
      optionKey: opt.key,
      optionText: opt.text,
      userTrait: opt.userTrait,
      taTrait: opt.taTrait,
    };
    addQuizAnswer(answer);

    if (opt.userTrait) {
      pushUserTrait(opt.userTrait);
      setHighlightUser(true);
      shiftUserHue(8);
    }
    if (opt.taTrait) {
      pushTaTrait(opt.taTrait);
      setHighlightTa(true);
      shiftTaHue(-8);
    }

    setTimeout(() => {
      setHighlightUser(false);
      setHighlightTa(false);
      setLocked(false);
      setQIndex((i) => i + 1);
    }, 1100);
  }

  function startPlay() {
    // 进入沙盘前：根据 Q1 关系阶段初始化 RelationshipState
    initRelationship();
    setPhase("play");
    router.push("/simulator");
  }

  const progress = (qIndex / totalQ) * 100;

  return (
    <main className="min-h-[100svh] flex flex-col">
      {/* Header */}
      <header className="glass border-b border-rose-300/10 sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/setup"
            className="text-rose-200/60 text-sm hover:text-rose-100 py-1 px-1 -mx-1"
          >
            ←
          </Link>
          <div className="text-rose-200/55 text-[10px] sm:text-[11px] tracking-wider truncate">
            Step 2 / 3 · 捏 agent
          </div>
          <div className="text-rose-200/55 text-[10px] sm:text-[11px] tabular-nums">
            {Math.min(qIndex, totalQ)} / {totalQ}
          </div>
        </div>
        <div className="mt-2 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
            className="h-full bg-gradient-to-r from-rose-300 to-rose-400"
          />
        </div>
      </header>

      {/* 双 q 版头像 — 小屏缩小 */}
      <section className="pt-6 sm:pt-8 pb-4 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 sm:gap-4 items-start">
          <div className="flex justify-center">
            <QAvatar
              name={userAgent.name || base.name || "你"}
              hue={userAgent.hue}
              traits={userAgent.traits}
              side="left"
              highlight={highlightUser}
              size={110}
            />
          </div>
          <div className="flex justify-center">
            <QAvatar
              name={taAgent.name || base.taName || "Ta"}
              hue={taAgent.hue}
              traits={taAgent.traits}
              side="right"
              highlight={highlightTa}
              size={110}
            />
          </div>
        </div>
      </section>

      {/* 题目区 */}
      <section className="flex-1 px-4 sm:px-6 pb-10">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {currentQ && (
              <motion.div
                key={currentQ.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="glass rounded-3xl p-5 sm:p-6"
              >
                <div className="text-rose-200/50 text-[10px] tracking-[0.3em] uppercase mb-3">
                  {labelFor(currentQ.subject)} · 第 {qIndex + 1} 题
                </div>
                <h2 className="font-serif-cn text-rose-100 text-[16px] sm:text-lg leading-relaxed mb-4 sm:mb-5">
                  {currentQ.prompt}
                </h2>

                <div className="space-y-2">
                  {currentQ.options.map((opt) => (
                    <button
                      key={opt.key}
                      disabled={locked}
                      onClick={() => pick(opt)}
                      className={cn(
                        "w-full text-left rounded-2xl px-4 py-3.5 border transition active:scale-[0.98]",
                        "border-rose-300/20 text-rose-200/85 hover:border-rose-300/55 hover:bg-rose-300/5",
                        locked && "opacity-50 pointer-events-none"
                      )}
                    >
                      <div className="text-[14px] sm:text-sm font-medium leading-relaxed">
                        {opt.text}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {done && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mt-8"
              >
                <h2 className="font-serif-cn text-rose-100 text-xl sm:text-2xl mb-3">
                  你们的 agent 已经成形
                </h2>
                <p className="text-rose-200/55 text-sm mb-6">
                  下一步 — 让这两个 agent 在 AI 里相遇
                </p>
                <button
                  onClick={startPlay}
                  className="w-full sm:w-auto px-10 py-3.5 rounded-full bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 font-medium hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-rose-500/30"
                >
                  开始推演 →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}

function labelFor(subject: string): string {
  if (subject === "user") return "关于你";
  if (subject === "ta") return "关于 ta";
  return "关于你们";
}
