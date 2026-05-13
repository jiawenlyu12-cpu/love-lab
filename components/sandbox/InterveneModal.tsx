"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type InterveneType = "message" | "post" | "wait";

export default function InterveneModal({
  taName,
  onSubmit,
  onClose,
}: {
  taName: string;
  onSubmit: (type: InterveneType, content: string) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<InterveneType>("message");
  const [content, setContent] = useState("");

  const placeholder =
    type === "message"
      ? `给 ${taName} 发什么？`
      : type === "post"
      ? "在朋友圈写点什么，让 ta 可能看见..."
      : "（不动作，就让这一刻过去）";

  const canSubmit =
    type === "wait" || content.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(type, type === "wait" ? "" : content.trim());
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 24 }}
        className="relative max-w-md w-full glass rounded-3xl p-5 sm:p-7 border border-rose-300/30 shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="text-rose-300/80 text-[10px] tracking-[0.4em] uppercase mb-1">
            Intervene · 介入
          </div>
          <h2 className="font-serif-cn text-rose-100 text-lg">你想做什么？</h2>
          <p className="text-rose-200/50 text-xs mt-1">
            你的动作会成为这一回合的输入，AI 演 ta 的反应
          </p>
        </div>

        {/* 类型选择 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(
            [
              { v: "message", label: "私聊" },
              { v: "post", label: "朋友圈" },
              { v: "wait", label: "不动" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setType(opt.v)}
              className={cn(
                "py-2.5 rounded-2xl text-sm transition border",
                type === opt.v
                  ? "bg-rose-300/20 border-rose-300/60 text-rose-100"
                  : "bg-white/5 border-rose-300/15 text-rose-200/70 hover:border-rose-300/40"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 内容输入 */}
        {type !== "wait" && (
          <>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 80))}
              placeholder={placeholder}
              rows={3}
              maxLength={80}
              className="w-full bg-white/5 border border-rose-300/20 rounded-2xl px-4 py-3 text-rose-50 placeholder:text-rose-200/30 focus:outline-none focus:border-rose-300/60 text-sm leading-relaxed resize-none"
            />
            <div className="mt-1 text-right text-[10.5px] text-rose-200/45 tabular-nums">
              {content.length} / 80
            </div>
          </>
        )}
        {type === "wait" && (
          <div className="rounded-2xl p-4 bg-white/5 border border-rose-300/15 text-rose-200/65 text-sm text-center">
            你选择什么都不做。
            <br />
            这也是一种动作。
          </div>
        )}

        {/* 操作 */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-rose-200/55 text-sm hover:text-rose-200 py-2.5 px-2"
          >
            取消
          </button>
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={cn(
              "px-6 py-3 rounded-full text-sm font-medium transition flex-1 active:scale-95",
              canSubmit
                ? "bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 hover:scale-[1.02] shadow-lg shadow-rose-500/30"
                : "bg-white/5 text-rose-200/30 cursor-not-allowed"
            )}
          >
            {type === "wait" ? "就这样过去" : "发出 →"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
