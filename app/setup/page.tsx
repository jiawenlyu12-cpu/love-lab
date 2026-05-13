"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSimStore } from "@/lib/store/simulation-store";
import { MBTI_CHOICES, type MBTI } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SetupPage() {
  const router = useRouter();
  const { base, setBase, resetGame } = useSimStore();

  useEffect(() => {
    resetGame();
  }, []); // eslint-disable-line

  const canNext =
    base.name.trim().length > 0 &&
    base.birthday.length > 0 &&
    base.taName.trim().length > 0;

  return (
    <main className="min-h-[100svh] px-5 sm:px-6 py-8 max-w-xl mx-auto">
      <Link href="/" className="text-rose-200/60 text-sm hover:text-rose-100 inline-block py-2 -my-2">
        ← 返回首页
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 sm:mt-10"
      >
        <div className="text-rose-200/55 text-[10px] tracking-[0.4em] uppercase mb-2">
          Step 1 / 3
        </div>
        <h1 className="font-serif-cn text-2xl sm:text-3xl text-rose-100 mb-2 leading-snug">
          先告诉 AI 一些基础信息
        </h1>
        <p className="text-rose-200/60 text-sm mb-6 sm:mb-8 leading-relaxed">
          下一步我们会一起把 ta 和你的 agent 形态捏出来。
        </p>

        <div className="glass rounded-3xl p-5 sm:p-7 space-y-5">
          <Field label="你的姓名 / 昵称" required>
            <input
              autoFocus
              value={base.name}
              onChange={(e) => setBase({ name: e.target.value })}
              placeholder="例：小满"
              className="w-full bg-white/5 border border-rose-300/20 rounded-xl px-4 py-2.5 text-rose-50 placeholder:text-rose-200/30 focus:outline-none focus:border-rose-300/60"
            />
          </Field>

          <Field
            label="你的生日"
            required
            hint="AI 会用生日推演你的八字日柱，作为分析的底色"
          >
            <input
              type="date"
              value={base.birthday}
              onChange={(e) => setBase({ birthday: e.target.value })}
              className="w-full bg-white/5 border border-rose-300/20 rounded-xl px-4 py-2.5 text-rose-50 focus:outline-none focus:border-rose-300/60"
            />
          </Field>

          <Field label="你的 MBTI" hint="选填，但填了 agent 形态会更准">
            <select
              value={base.mbti}
              onChange={(e) => setBase({ mbti: e.target.value as MBTI | "" })}
              className="w-full bg-white/5 border border-rose-300/20 rounded-xl px-4 py-2.5 text-rose-50 focus:outline-none focus:border-rose-300/60"
            >
              <option value="">— 选一个 —</option>
              {MBTI_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="ta 的代称"
            required
            hint="⚠️ 请用代称，勿填真名 / 电话 / 工作单位"
          >
            <input
              value={base.taName}
              onChange={(e) => setBase({ taName: e.target.value })}
              placeholder="ta 在你心里叫什么"
              className="w-full bg-white/5 border border-rose-300/20 rounded-xl px-4 py-2.5 text-rose-50 placeholder:text-rose-200/30 focus:outline-none focus:border-rose-300/60"
            />
          </Field>
        </div>

        <button
          disabled={!canNext}
          onClick={() => router.push("/builder")}
          className={cn(
            "mt-8 w-full py-3.5 rounded-full text-sm font-medium transition active:scale-95",
            canNext
              ? "bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 hover:scale-[1.02] shadow-lg shadow-rose-500/30"
              : "bg-white/5 text-rose-200/30 cursor-not-allowed"
          )}
        >
          下一步：捏 agent →
        </button>
      </motion.div>
    </main>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-rose-200/80 text-xs mb-2 tracking-wider">
        {label}{" "}
        {required && <span className="text-rose-300">*</span>}
        {hint && (
          <span className="text-rose-200/45 ml-2 normal-case">（{hint}）</span>
        )}
      </label>
      {children}
    </div>
  );
}
