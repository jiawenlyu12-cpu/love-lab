"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSimStore } from "@/lib/store/simulation-store";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  const mo = Math.floor(d / 30);
  return `${mo} 个月前`;
}

export default function AgentsPage() {
  const router = useRouter();
  const { agentLibrary, loadFromLibrary, deleteFromLibrary, resetGame } =
    useSimStore();

  const [confirmId, setConfirmId] = useState<string | null>(null);

  const items = [...(agentLibrary || [])].sort(
    (a, b) => b.lastUsedAt - a.lastUsedAt
  );

  function onLoad(id: string) {
    track("agent_loaded");
    loadFromLibrary(id);
    router.push("/simulator");
  }

  function onDelete(id: string) {
    deleteFromLibrary(id);
    setConfirmId(null);
  }

  return (
    <main className="min-h-[100svh] px-4 sm:px-6 py-6 sm:py-8 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="text-rose-200/55 text-sm hover:text-rose-100 py-2 px-1 -mx-1"
        >
          ← 回首页
        </Link>
        <div className="text-rose-200/45 text-[11px] tracking-wider">
          {items.length} / 10
        </div>
      </div>

      <h1 className="font-serif-cn text-2xl sm:text-3xl text-rose-100 mb-2 leading-snug">
        我的人设库
      </h1>
      <p className="text-rose-200/55 text-xs mb-7 sm:mb-8 leading-relaxed">
        每完成一对 agent 自动入库 · 点击载入即可再次推演
      </p>

      {items.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <div className="font-serif-cn text-rose-100/70 text-base mb-2">
            还没有存档的人设
          </div>
          <p className="text-rose-200/40 text-xs mb-8 leading-relaxed">
            完成 12 题养成后会自动保存
          </p>
          <button
            onClick={() => {
              resetGame();
              router.push("/setup");
            }}
            className="px-10 py-3.5 rounded-full bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 font-medium text-sm tracking-wider shadow-lg shadow-rose-500/30 active:scale-95 transition"
          >
            捏第一对 →
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence>
              {items.map((item) => {
                const userName =
                  item.base.name || item.userAgent.name || "你";
                const taName =
                  item.base.taName || item.taAgent.name || "Ta";
                const isConfirming = confirmId === item.id;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "glass rounded-2xl border border-rose-300/15 overflow-hidden",
                      isConfirming && "ring-1 ring-rose-300/40"
                    )}
                  >
                    <div className="flex items-stretch">
                      {/* 主区域 · 点击载入 */}
                      <button
                        onClick={() => onLoad(item.id)}
                        className="flex-1 text-left px-4 py-3.5 hover:bg-rose-300/5 active:bg-rose-300/8 transition"
                      >
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-serif-cn text-rose-100 text-base sm:text-[17px]">
                            {userName}
                          </span>
                          <span className="text-rose-200/35 text-sm">×</span>
                          <span className="font-serif-cn text-rose-100 text-base sm:text-[17px]">
                            {taName}
                          </span>
                        </div>
                        <div className="text-rose-200/50 text-[11px] tracking-wider">
                          {item.base.mbti && (
                            <span className="mr-2">{item.base.mbti}</span>
                          )}
                          {item.base.birthday && (
                            <span className="mr-2 opacity-70">
                              {item.base.birthday}
                            </span>
                          )}
                          <span>
                            推演 {item.playCount} 次 · {timeAgo(item.lastUsedAt)}
                          </span>
                        </div>
                      </button>

                      {/* 删除区 */}
                      {isConfirming ? (
                        <div className="flex items-stretch">
                          <button
                            onClick={() => onDelete(item.id)}
                            className="px-4 bg-rose-400/20 text-rose-300 text-xs hover:bg-rose-400/30 transition"
                          >
                            确认删除
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-4 text-rose-200/55 text-xs hover:text-rose-100 transition"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(item.id)}
                          className="px-4 text-rose-200/35 hover:text-rose-300 text-xs transition"
                          aria-label="删除"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <button
            onClick={() => {
              resetGame();
              router.push("/setup");
            }}
            className="mt-6 w-full py-3 rounded-full border border-rose-300/30 text-rose-100/70 text-sm hover:bg-rose-300/10 transition tracking-wider"
          >
            + 捏一对新的人设
          </button>
        </>
      )}

      <p className="text-rose-200/30 text-[10px] text-center mt-10 leading-relaxed px-4">
        最多保存 10 套 · 超出时自动淘汰最久未用的
      </p>
    </main>
  );
}
