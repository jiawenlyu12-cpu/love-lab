"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { RoundEvent } from "@/lib/types";

// 一回合压缩卡：时间 + 事件 + 双方动作 + 状态 delta；点击展开看完整对话
export default function RoundDigest({
  round,
  userName,
  taName,
  defaultOpen = false,
  highlight = false,
  onReroll,
}: {
  round: RoundEvent;
  userName: string;
  taName: string;
  defaultOpen?: boolean;
  highlight?: boolean;
  onReroll?: () => void;     // 仅当该 round 是最后一个时传入；点击重玩本回合
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border transition-colors relative",
        round.intervened &&
          "border-amber-300/55 bg-gradient-to-br from-amber-300/8 to-transparent shadow-[inset_3px_0_0_0_rgba(212,184,126,0.7)]",
        !round.intervened && highlight
          ? "border-rose-300/55 bg-rose-300/5"
          : !round.intervened &&
              "border-rose-300/15 bg-white/[0.03]"
      )}
    >
      {/* 头部：时间 + 事件 */}
      <div className="px-4 py-3">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-rose-200/55 text-[11px] tracking-[0.25em]">
            5/20 · {round.time}
            <span className="text-rose-200/35 ml-2 text-[10px]">
              · 第 {round.round} 刻
            </span>
          </span>
          {round.intervened && (
            <span className="text-amber-200/90 text-[10px] tracking-wider font-medium bg-amber-300/15 px-2 py-0.5 rounded-full border border-amber-300/30">
              ✎ 你的介入
            </span>
          )}
        </div>
        <p className="font-serif-cn text-rose-100/95 text-[13.5px] leading-relaxed">
          {round.eventText}
        </p>

        {/* 双方动作摘要 */}
        <div className="mt-3 space-y-1 text-[12.5px]">
          <div className="flex items-baseline gap-2">
            <span className="text-rose-300/75 text-[11px] tracking-wider shrink-0 w-6">
              你
            </span>
            <span className="text-rose-100/85">{round.userAction}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-blue-200/75 text-[11px] tracking-wider shrink-0 w-6">
              ta
            </span>
            <span className="text-rose-100/85">{round.taAction}</span>
          </div>
        </div>

        {/* state delta */}
        <div className="mt-3 pt-2 border-t border-rose-300/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <DeltaTag label="亲密" v={round.delta.closeness} />
          <DeltaTag label="你的状态" v={round.delta.userMood} />
          <span className="text-rose-200/45 italic font-serif-cn">
            {round.delta.reason}
          </span>
        </div>
      </div>

      {/* 重玩本回合（仅最后一回合显示）*/}
      {onReroll && (
        <button
          onClick={onReroll}
          className="w-full px-4 py-2 text-[11px] text-rose-200/65 hover:text-rose-100 border-t border-rose-300/10 transition active:scale-[0.98]"
        >
          🔄 不满意？重玩本回合
        </button>
      )}

      {/* 折叠展开对话 */}
      {round.beats.length > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full px-4 py-2 text-[11px] text-rose-200/55 hover:text-rose-200 border-t border-rose-300/10 transition"
          >
            {open ? "▲ 收起对话" : `▾ 展开对话（${round.beats.length}）`}
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 pt-1 border-t border-rose-300/10">
                  {round.beats.map((b) => (
                    <BeatLine
                      key={b.id}
                      beat={b}
                      userName={userName}
                      taName={taName}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

function DeltaTag({ label, v }: { label: string; v: number }) {
  if (v === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-rose-200/45">
        <span>{label}</span>
        <span>±0</span>
      </span>
    );
  }
  const positive = v > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        positive ? "text-rose-200" : "text-rose-300/65"
      )}
    >
      <span className="text-rose-200/45">{label}</span>
      <span className={positive ? "text-emerald-200" : "text-orange-300"}>
        {positive ? `+${v}` : v}
      </span>
    </span>
  );
}

function BeatLine({
  beat,
  userName,
  taName,
}: {
  beat: { role: string; kind: string; content: string };
  userName: string;
  taName: string;
}) {
  if (beat.kind === "inner_flash") {
    return (
      <div className="flex justify-end my-1.5">
        <span className="max-w-[80%] text-[11px] text-rose-200/50 italic leading-relaxed text-right">
          ※ {beat.content}
        </span>
      </div>
    );
  }
  if (beat.kind === "typing_revoked") {
    const isUser = beat.role === "user-agent";
    return (
      <div
        className={cn(
          "my-1.5 flex",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        <div className="max-w-[78%] flex flex-col gap-0.5">
          <span
            className={cn(
              "text-[10px] text-rose-200/35",
              isUser ? "text-right" : "text-left"
            )}
          >
            {isUser ? userName : taName} 撤回
          </span>
          <div
            className={cn(
              "px-3 py-1 rounded-xl text-[11.5px] italic line-through opacity-40",
              isUser
                ? "bg-blue-300/10 text-blue-100/60 border border-blue-300/20"
                : "bg-white/8 text-rose-100/50 border border-rose-300/15"
            )}
          >
            {beat.content}
          </div>
        </div>
      </div>
    );
  }
  // message
  const isUser = beat.role === "user-agent";
  return (
    <div
      className={cn(
        "my-1.5 flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className="max-w-[80%] flex flex-col gap-0.5">
        {!isUser && (
          <span className="text-[10px] text-rose-200/45 ml-1">{taName}</span>
        )}
        <div
          className={cn(
            "px-3 py-1.5 rounded-xl text-[12.5px] leading-relaxed whitespace-pre-wrap",
            isUser
              ? "bubble-user rounded-br-sm"
              : "bubble-crush rounded-bl-sm"
          )}
        >
          {beat.content}
        </div>
      </div>
    </div>
  );
}
