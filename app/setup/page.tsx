"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSimStore } from "@/lib/store/simulation-store";
import {
  BIRTH_TIME_RANGES,
  MBTI_CHOICES,
  type MBTI,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import ChatScreenshotUpload from "@/components/ChatScreenshotUpload";

export default function SetupPage() {
  const router = useRouter();
  const { base, setBase, resetGame, agentLibrary, chatScreenshots } = useSimStore();
  const [agreed, setAgreed] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const libCount = (agentLibrary || []).length;

  useEffect(() => {
    resetGame();
    track("setup_started");
  }, []); // eslint-disable-line

  const canNext =
    agreed &&
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
          Step 1 / 3 · 90 秒推演 5/20
        </div>
        <h1 className="font-serif-cn text-2xl sm:text-3xl text-rose-100 mb-2 leading-snug">
          告诉 AI 你和 ta
        </h1>
        <p className="text-rose-200/60 text-sm mb-6 sm:mb-8 leading-relaxed">
          只需要 3 件事。其它都可选，越填越准。
        </p>

        {libCount > 0 && (
          <Link
            href="/agents"
            className="mb-6 sm:mb-7 flex items-center justify-between glass rounded-2xl border border-rose-300/25 px-5 py-3.5 hover:bg-rose-300/5 active:scale-[0.99] transition group"
          >
            <div>
              <div className="text-rose-100 text-sm font-medium tracking-wide">
                用已存档的人设
              </div>
              <div className="text-rose-200/50 text-[11px] mt-0.5">
                你保存过 {libCount} 套，跳过这 3 步直接进沙盘
              </div>
            </div>
            <span className="text-rose-300 text-lg group-hover:translate-x-0.5 transition">
              →
            </span>
          </Link>
        )}

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
            hint="年月日；AI 会用它推演你的星座和命盘底色"
          >
            <input
              type="date"
              value={base.birthday}
              onChange={(e) => setBase({ birthday: e.target.value })}
              className="w-full bg-white/5 border border-rose-300/20 rounded-xl px-4 py-2.5 text-rose-50 focus:outline-none focus:border-rose-300/60"
            />
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

          {/* ⊕ 给 AI 更多线索（折叠选填区） */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="w-full flex items-center justify-between text-rose-200/70 text-[12px] py-1.5 hover:text-rose-100 transition"
            >
              <span className="tracking-wider">
                {showOptional ? "▾" : "⊕"} 给 AI 更多线索（推演更准）
              </span>
              <span className="text-rose-200/40 text-[10.5px]">
                {showOptional ? "" : "选填 · 4 项"}
              </span>
            </button>
            {showOptional && (
              <div className="mt-3 space-y-4 pt-3 border-t border-rose-300/10">
                <Field label="你的出生时辰" hint="能记起来就填">
                  <TimeRangeSelect
                    value={base.birthTimeRange || ""}
                    onChange={(v) => setBase({ birthTimeRange: v })}
                  />
                </Field>

                <Field label="你的 MBTI" hint="填了 agent 形态会更准">
                  <select
                    value={base.mbti}
                    onChange={(e) => setBase({ mbti: e.target.value as MBTI | "" })}
                    className="w-full bg-white/5 border border-rose-300/20 rounded-xl px-4 py-2.5 text-rose-50 focus:outline-none focus:border-rose-300/60 appearance-none"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23fda4af' d='M6 8 0 0h12z'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 1rem center",
                      paddingRight: "2.5rem",
                    }}
                  >
                    <option value="" style={{ background: "#1a1a2e", color: "#fff5f5" }}>
                      — 选一个 —
                    </option>
                    {MBTI_CHOICES.map((m) => (
                      <option key={m} value={m} style={{ background: "#1a1a2e", color: "#fff5f5" }}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="ta 的生日"
                  hint="年月日；填了能算两人星座合拍度"
                >
                  <input
                    type="date"
                    value={base.taBirthday || ""}
                    onChange={(e) => setBase({ taBirthday: e.target.value })}
                    className="w-full bg-white/5 border border-rose-300/20 rounded-xl px-4 py-2.5 text-rose-50 focus:outline-none focus:border-rose-300/60"
                  />
                </Field>

                <Field label="ta 的出生时辰" hint="选填">
                  <TimeRangeSelect
                    value={base.taBirthTimeRange || ""}
                    onChange={(v) => setBase({ taBirthTimeRange: v })}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <ChatScreenshotUpload />
        </div>

        <label className="mt-6 flex items-start gap-3 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-rose-400 cursor-pointer flex-shrink-0"
          />
          <span className="text-rose-200/70 text-xs leading-relaxed group-hover:text-rose-100/85 transition">
            我已年满 18 周岁，且已阅读并同意
            <Link
              href="/legal/terms"
              target="_blank"
              className="text-rose-300 underline-offset-2 hover:underline mx-0.5"
            >
              《用户协议》
            </Link>
            与
            <Link
              href="/legal/privacy"
              target="_blank"
              className="text-rose-300 underline-offset-2 hover:underline mx-0.5"
            >
              《隐私声明》
            </Link>
          </span>
        </label>

        <button
          disabled={!canNext}
          onClick={() => {
            track("setup_completed");
            const n = chatScreenshots?.length ?? 0;
            if (n > 0) {
              track("setup_with_screenshots");
              if (n >= 3) track("setup_with_screenshots_3plus");
            }
            router.push("/builder");
          }}
          className={cn(
            "mt-5 w-full py-3.5 rounded-full text-sm font-medium transition active:scale-95",
            canNext
              ? "bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 hover:scale-[1.02] shadow-lg shadow-rose-500/30"
              : "bg-white/5 text-rose-200/30 cursor-not-allowed"
          )}
        >
          下一步：3 题快测 →
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

function TimeRangeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white/5 border border-rose-300/20 rounded-xl px-4 py-2.5 text-rose-50 focus:outline-none focus:border-rose-300/60 appearance-none"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23fda4af' d='M6 8 0 0h12z'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 1rem center",
        paddingRight: "2.5rem",
      }}
    >
      <option value="" style={{ background: "#1a1a2e", color: "#fff5f5" }}>
        — 不填 / 跳过 —
      </option>
      {BIRTH_TIME_RANGES.filter((r) => r !== "不知道").map((r) => (
        <option key={r} value={r} style={{ background: "#1a1a2e", color: "#fff5f5" }}>
          {r}
        </option>
      ))}
    </select>
  );
}
