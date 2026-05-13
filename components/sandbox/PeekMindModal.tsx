"use client";

import { motion } from "framer-motion";
import type { PeekMindResult } from "@/lib/engine";

export default function PeekMindModal({
  data,
  taName,
  remaining,
  onClose,
  onPeekAgain,
}: {
  data: PeekMindResult;
  taName: string;
  remaining: number;
  onClose: () => void;
  onPeekAgain?: () => void;
}) {
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
        exit={{ scale: 0.94, y: 8 }}
        transition={{ type: "spring", stiffness: 240, damping: 24 }}
        className="relative max-w-md w-full glass rounded-3xl p-5 sm:p-7 border border-rose-300/30 shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-rose-300/80 text-[10px] tracking-[0.4em] uppercase mb-1">
            Peek · 读心
          </div>
          <h2 className="font-serif-cn text-rose-100 text-lg">
            此刻 {taName} 心里
          </h2>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <span className="inline-block px-3 py-1 rounded-full text-[12px] text-rose-100 bg-rose-300/15 border border-rose-300/30 tracking-wider">
              {data.taMoodLabel}
            </span>
          </div>

          <div className="border-l-2 border-rose-300/40 pl-3 py-1">
            <div className="text-rose-200/55 text-[10px] tracking-[0.25em] uppercase mb-1">
              态度
            </div>
            <p className="text-rose-100 text-sm leading-relaxed font-serif-cn">
              {data.taAttitude}
            </p>
          </div>

          <div className="border-l-2 border-rose-300/40 pl-3 py-1">
            <div className="text-rose-200/55 text-[10px] tracking-[0.25em] uppercase mb-1">
              ta 此刻心里
            </div>
            <p className="text-rose-100 text-sm leading-relaxed italic font-serif-cn">
              「{data.innerMonologue}」
            </p>
          </div>

          <div className="rounded-2xl p-3 bg-gradient-to-r from-rose-300/15 via-rose-300/5 to-transparent border-l-2 border-rose-300/60">
            <div className="text-rose-300/85 text-[10px] tracking-[0.25em] uppercase mb-1">
              🪞 你的盲点
            </div>
            <p className="text-rose-100 text-sm leading-relaxed font-serif-cn">
              {data.userBlindSpot}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="text-rose-200/45 text-[11px] shrink-0">
            剩 {remaining} 次
          </div>
          <div className="flex gap-2">
            {onPeekAgain && remaining > 0 && (
              <button
                onClick={onPeekAgain}
                className="px-4 py-2.5 rounded-full border border-rose-300/40 text-rose-100 text-sm hover:bg-rose-300/10 active:scale-95 transition"
              >
                👁 再读一次
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-rose-300/15 border border-rose-300/40 text-rose-100 text-sm hover:bg-rose-300/25 active:scale-95 transition"
            >
              回沙盘
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
