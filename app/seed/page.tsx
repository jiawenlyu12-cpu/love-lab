"use client";

// /seed?demo=1 — preset entry that drops a visitor straight into the sandbox
// without sitting through the 12-question onboarding flow.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QUIZ_QUESTIONS } from "@/lib/quiz";
import { useSimStore, type SimPreset } from "@/lib/store/simulation-store";

const PRESET_DEMO_1: SimPreset = {
  base: { name: "周声", birthday: "1996-08-12", mbti: "INFJ", taName: "林深" },
  userTraits: [
    "在等一个确认",
    "观察派",
    "嘴硬偷瞄",
    "克制表达",
    "复盘强迫症",
    "在意细节",
    "容易共情",
  ],
  taTraits: [
    "也在等一个确认",
    "话少但在线",
    "节奏稳定",
    "温度感强",
    "回复间隔不稳定",
    "界限模糊",
    "擅长制造氛围",
  ],
  quizAnswers: [
    {
      questionId: QUIZ_QUESTIONS[0].id,
      optionKey: "B",
      optionText: QUIZ_QUESTIONS[0].options[1].text,
      userTrait: QUIZ_QUESTIONS[0].options[1].userTrait,
      taTrait: QUIZ_QUESTIONS[0].options[1].taTrait,
    },
  ],
};

const PRESETS: Record<string, SimPreset> = {
  "1": PRESET_DEMO_1,
};

export default function SeedPage() {
  const router = useRouter();
  const applyPreset = useSimStore((s) => s.applyPreset);
  // Guard against re-firing (back button → wipes simulator progress otherwise).
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    const demo = new URLSearchParams(window.location.search).get("demo") ?? "";
    const preset = PRESETS[demo];
    if (!preset) {
      router.replace("/");
      return;
    }
    applyPreset(preset);
    router.replace("/simulator");
  }, [applyPreset, router]);

  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-rose-100 font-serif-cn text-lg mb-2">
        正在把你送进沙盘 …
      </div>
      <div className="text-rose-200/55 text-xs tracking-wider">
        预填：周声 · INFJ · 林深 · 高度暧昧期
      </div>
    </main>
  );
}
