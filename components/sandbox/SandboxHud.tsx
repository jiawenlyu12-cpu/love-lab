"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import QAvatar from "@/components/avatar/QAvatar";
import type { AgentForm, RelationshipState } from "@/lib/types";

// 紧凑版沙盘 HUD：单行布局，把垂直空间让给下面的对话
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
    <div className="glass border-b border-rose-300/10 px-3 py-2">
      {/* 时间锚（小） */}
      <div className="text-center text-rose-200/45 text-[9px] tracking-[0.3em] mb-1.5">
        5/20 · {currentTime || "起点"}
      </div>

      {/* 主行：头像 + 心动条 + 亲密度（一行） */}
      <div className="flex items-center gap-2">
        {/* 左：用户头像 */}
        <div className="shrink-0">
          <QAvatar
            name={userName}
            hue={userAgent.hue}
            traits={[]}        /* 不展示 traits chip，腾空间 */
            side="left"
            size={42}
          />
        </div>

        {/* 你的心动值 - 紧贴头像右侧 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-rose-200/60 tracking-wider whitespace-nowrap">
              <span className="text-rose-300 animate-heartPulse inline-block">♥</span> 你
            </span>
            <span className="text-[9.5px] text-rose-100/75 tabular-nums">
              {Math.round(userHeartPct)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${userHeartPct}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 24 }}
              className="h-full bg-gradient-to-r from-rose-300 to-rose-400/80 rounded-full"
            />
          </div>
        </div>

        {/* 中间：亲密度（compact 圆形指标）*/}
        <div className="shrink-0 flex flex-col items-center w-12">
          <div className="text-[8px] text-rose-200/55 tracking-[0.2em]">亲密</div>
          <div className="text-rose-100 text-[13px] font-medium tabular-nums leading-tight">
            {closenessPct}
          </div>
          <div className="w-10 h-1 rounded-full bg-white/8 overflow-hidden mt-0.5">
            <motion.div
              initial={false}
              animate={{ width: `${closenessPct}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 24 }}
              className="h-full bg-gradient-to-r from-rose-300/80 to-rose-400/80 rounded-full"
            />
          </div>
        </div>

        {/* ta 的心动值 - 紧贴 ta 头像左侧 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9.5px] text-rose-200/45 tabular-nums">??</span>
            <span className="text-[9px] text-rose-200/60 tracking-wider whitespace-nowrap">
              <span className="text-rose-200/50 inline-block">♥</span> {taName.slice(0, 4)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden relative">
            <div className="absolute inset-0 flex items-center justify-center text-[7px] tracking-[0.4em] text-rose-200/35">
              ?????
            </div>
          </div>
        </div>

        {/* 右：ta 头像 */}
        <div className="shrink-0">
          <QAvatar
            name={taName}
            hue={taAgent.hue}
            traits={[]}
            side="right"
            size={42}
          />
        </div>
      </div>
    </div>
  );
}
