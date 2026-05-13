"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import QAvatar from "@/components/avatar/QAvatar";
import type { AgentForm, RelationshipState } from "@/lib/types";

// 沙盘顶部 HUD：两个 agent 卡（含心动值）+ 中间亲密度条 + 当前时间
export default function SandboxHud({
  userAgent,
  taAgent,
  userName,
  taName,
  state,
  currentTime,
}: {
  userAgent: AgentForm;
  taAgent: AgentForm;
  userName: string;
  taName: string;
  state: RelationshipState;
  currentTime: string;
}) {
  const closenessPct = Math.max(0, Math.min(100, state.closeness));
  const userHeartPct = Math.max(0, Math.min(100, state.userMood));

  return (
    <div className="glass border-b border-rose-300/10 pt-3 pb-3 px-3 sm:px-4">
      {/* 时间锚 */}
      <div className="text-center text-rose-200/55 text-[9px] sm:text-[10px] tracking-[0.3em] mb-2 sm:mb-3">
        5/20 当前 · {currentTime || "起点"}
      </div>

      {/* 双 Agent + 中间亲密度 */}
      <div className="flex items-start gap-2 sm:gap-3">
        {/* 左：用户 agent + 心动值（可见） */}
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <QAvatar
            name={userName}
            hue={userAgent.hue}
            traits={userAgent.traits}
            side="left"
            size={54}
          />
          <HeartBeat
            label="你的心动值"
            value={userHeartPct}
            hidden={false}
            tone="user"
          />
        </div>

        {/* 中：亲密度 */}
        <div className="flex-[1.6] min-w-0 flex flex-col items-center pt-3">
          <div className="text-rose-200/55 text-[9px] sm:text-[10px] tracking-[0.3em] uppercase mb-2">
            亲密度
          </div>
          <div className="w-full relative h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${closenessPct}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 24 }}
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-rose-300/80 to-rose-400/80 rounded-full"
            />
          </div>
          <div className="mt-1 text-rose-100/80 text-[10px] sm:text-[11px] tracking-wider tabular-nums">
            {closenessPct}/100
          </div>
        </div>

        {/* 右：ta agent + 心动值（隐藏） */}
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <QAvatar
            name={taName}
            hue={taAgent.hue}
            traits={taAgent.traits}
            side="right"
            size={54}
          />
          <HeartBeat
            label={`${taName} 的心动值`}
            value={0}
            hidden={true}
            tone="ta"
          />
        </div>
      </div>
    </div>
  );
}

// 心动值组件：💗 图标 + 渐变 bar / 隐藏时显示 ?????
function HeartBeat({
  label,
  value,
  hidden,
  tone,
}: {
  label: string;
  value: number;
  hidden: boolean;
  tone: "user" | "ta";
}) {
  return (
    <div className="w-full mt-2 flex flex-col items-center">
      <div className="flex items-center gap-1 text-[9.5px] tracking-[0.15em] text-rose-200/65 mb-1 whitespace-nowrap">
        <span
          className={cn(
            "inline-block",
            !hidden && tone === "user" && "animate-heartPulse text-rose-300"
          )}
        >
          ♥
        </span>
        <span className="truncate max-w-[80px]">{label}</span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden relative">
        {hidden ? (
          <div className="absolute inset-0 flex items-center justify-center text-[8.5px] tracking-[0.3em] text-rose-200/45">
            ? ? ? ? ?
          </div>
        ) : (
          <motion.div
            initial={false}
            animate={{ width: `${value}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 24 }}
            className={cn(
              "absolute left-0 top-0 h-full rounded-full",
              tone === "user"
                ? "bg-gradient-to-r from-rose-300 to-rose-400/80"
                : "bg-gradient-to-r from-blue-200/70 to-blue-300/70"
            )}
          />
        )}
      </div>

      {!hidden && (
        <div className="mt-0.5 text-rose-100/70 text-[10px] tabular-nums tracking-wider">
          {Math.round(value)}
        </div>
      )}
      {hidden && (
        <div className="mt-0.5 text-rose-200/40 text-[10px] tabular-nums tracking-wider">
          ??
        </div>
      )}
    </div>
  );
}
