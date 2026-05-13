"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Q 版头像 + 表情 + 周围浮动特征 chips
// 视觉特征会随 traits 增加 / hue 变化而丰富

export default function QAvatar({
  name,
  hue,
  traits,
  side = "left",
  size = 110,
  highlight = false,
}: {
  name: string;
  hue: number;            // 0-360
  traits: string[];       // 累积的特征
  side?: "left" | "right";
  size?: number;
  highlight?: boolean;    // 加 chip 时高亮一下
}) {
  const expression = expressionFor(traits);
  const mood = moodFor(traits);
  const accessory = accessoryFor(traits);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-start gap-2 select-none",
        side === "right" && "items-center"
      )}
    >
      {/* 头像主体 */}
      <div
        className="relative"
        style={{ width: size, height: size }}
      >
        {/* 光晕（hue 决定颜色） */}
        <motion.div
          aria-hidden
          animate={
            highlight
              ? {
                  boxShadow: [
                    `0 0 0 0 hsla(${hue}, 80%, 65%, 0.5)`,
                    `0 0 28px 8px hsla(${hue}, 80%, 65%, 0.7)`,
                    `0 0 0 0 hsla(${hue}, 80%, 65%, 0.5)`,
                  ],
                  scale: [1, 1.08, 1],
                }
              : {
                  boxShadow: [
                    `0 0 0 0 hsla(${hue}, 65%, 60%, 0.3)`,
                    `0 0 16px 4px hsla(${hue}, 65%, 60%, 0.4)`,
                    `0 0 0 0 hsla(${hue}, 65%, 60%, 0.3)`,
                  ],
                  scale: [1, 1.04, 1],
                }
          }
          transition={{
            duration: highlight ? 1 : 2.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, hsla(${hue}, 75%, 75%, 0.25), hsla(${hue}, 65%, 55%, 0.05))`,
          }}
        />

        {/* SVG Q 版人物 */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className="relative z-10"
        >
          {/* 头 */}
          <defs>
            <radialGradient id={`head-grad-${name}-${hue}`} cx="40%" cy="35%">
              <stop offset="0%" stopColor={`hsl(${hue}, 85%, 92%)`} />
              <stop offset="100%" stopColor={`hsl(${hue}, 55%, 78%)`} />
            </radialGradient>
            <radialGradient id={`hair-grad-${name}-${hue}`} cx="50%" cy="30%">
              <stop offset="0%" stopColor={`hsl(${(hue + 20) % 360}, 50%, 30%)`} />
              <stop offset="100%" stopColor={`hsl(${(hue + 10) % 360}, 60%, 18%)`} />
            </radialGradient>
          </defs>

          {/* 头发（顶部弧形） */}
          <path
            d="M 18 42 Q 50 8 82 42 Q 78 28 50 22 Q 22 28 18 42 Z"
            fill={`url(#hair-grad-${name}-${hue})`}
          />
          {/* 脸 */}
          <circle cx="50" cy="55" r="32" fill={`url(#head-grad-${name}-${hue})`} />
          {/* 腮红 */}
          {(mood === "warm" || mood === "shy") && (
            <>
              <ellipse
                cx="30"
                cy="62"
                rx="5"
                ry="3"
                fill={`hsla(${hue}, 80%, 65%, 0.6)`}
              />
              <ellipse
                cx="70"
                cy="62"
                rx="5"
                ry="3"
                fill={`hsla(${hue}, 80%, 65%, 0.6)`}
              />
            </>
          )}
          {/* 眼睛 */}
          {renderEyes(expression, mood)}
          {/* 嘴 */}
          {renderMouth(expression)}
          {/* 装饰 */}
          {accessory === "scarf" && (
            <path
              d="M 22 88 Q 50 78 78 88 L 78 100 L 22 100 Z"
              fill={`hsla(${(hue + 180) % 360}, 60%, 55%, 0.85)`}
            />
          )}
          {accessory === "headphone" && (
            <>
              <rect
                x="14"
                y="42"
                width="6"
                height="14"
                rx="3"
                fill={`hsl(${hue}, 30%, 35%)`}
              />
              <rect
                x="80"
                y="42"
                width="6"
                height="14"
                rx="3"
                fill={`hsl(${hue}, 30%, 35%)`}
              />
              <path
                d="M 18 42 Q 50 18 82 42"
                stroke={`hsl(${hue}, 30%, 35%)`}
                strokeWidth="2"
                fill="none"
              />
            </>
          )}
        </svg>

        {/* 状态浮动 emoji（情绪标记） */}
        <AnimatePresence>
          {highlight && (
            <motion.span
              key="sparkle"
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: 1, scale: 1.2, y: -10 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8 }}
              className="absolute -top-1 -right-1 text-xl"
            >
              ✨
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* 名字 */}
      <div className="text-rose-100 text-sm font-medium font-serif-cn">
        {name}
      </div>

      {/* 特征 chips */}
      <div className="flex flex-wrap gap-1 justify-center max-w-[200px] mt-1">
        <AnimatePresence>
          {traits.map((t, i) => (
            <motion.span
              key={t + i}
              initial={{ opacity: 0, scale: 0.5, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 250,
                damping: 18,
                delay: i === traits.length - 1 ? 0.15 : 0,
              }}
              className="px-2 py-0.5 rounded-full text-[10px] border"
              style={{
                background: `hsla(${hue}, 60%, 60%, 0.15)`,
                borderColor: `hsla(${hue}, 60%, 60%, 0.45)`,
                color: `hsl(${hue}, 50%, 88%)`,
              }}
            >
              {t}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// === helpers ===

type Expression = "neutral" | "smile" | "smirk" | "pout" | "blush";
type Mood = "cool" | "warm" | "shy" | "neutral";

function expressionFor(traits: string[]): Expression {
  const txt = traits.join(" ");
  if (/温柔|笑|主动|想你|靠近/.test(txt)) return "smile";
  if (/嘴硬|傲娇|无所谓|嘴上|表面/.test(txt)) return "smirk";
  if (/冷|沉默|高冷|边界|退/.test(txt)) return "pout";
  if (/在意|心动|害羞|脸红|羞/.test(txt)) return "blush";
  return "neutral";
}

function moodFor(traits: string[]): Mood {
  const txt = traits.join(" ");
  if (/高冷|沉默|冷|边界|退/.test(txt)) return "cool";
  if (/热|主动|温柔|靠近|想你/.test(txt)) return "warm";
  if (/在意|害羞|心动|羞|犹豫/.test(txt)) return "shy";
  return "neutral";
}

function accessoryFor(traits: string[]): "scarf" | "headphone" | null {
  const txt = traits.join(" ");
  if (/语音|表情包|话密|认真/.test(txt)) return "headphone";
  if (traits.length >= 4) return "scarf"; // 攒够 4 个 trait 解锁围巾
  return null;
}

function renderEyes(expression: Expression, mood: Mood) {
  // 默认眼睛
  if (expression === "smile" || mood === "warm") {
    return (
      <>
        <path
          d="M 32 50 Q 38 45 44 50"
          stroke="#2a1a14"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 56 50 Q 62 45 68 50"
          stroke="#2a1a14"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </>
    );
  }
  if (expression === "pout" || mood === "cool") {
    return (
      <>
        <line
          x1="32"
          y1="50"
          x2="44"
          y2="50"
          stroke="#2a1a14"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="56"
          y1="50"
          x2="68"
          y2="50"
          stroke="#2a1a14"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </>
    );
  }
  // 默认：圆点眼
  return (
    <>
      <circle cx="38" cy="50" r="3.5" fill="#2a1a14" />
      <circle cx="62" cy="50" r="3.5" fill="#2a1a14" />
      <circle cx="39" cy="49" r="1" fill="#fff" />
      <circle cx="63" cy="49" r="1" fill="#fff" />
    </>
  );
}

function renderMouth(expression: Expression) {
  if (expression === "smile") {
    return (
      <path
        d="M 42 70 Q 50 76 58 70"
        stroke="#2a1a14"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  if (expression === "smirk") {
    return (
      <path
        d="M 42 70 Q 50 73 56 68"
        stroke="#2a1a14"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  if (expression === "pout") {
    return (
      <line
        x1="44"
        y1="71"
        x2="56"
        y2="71"
        stroke="#2a1a14"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    );
  }
  if (expression === "blush") {
    return (
      <ellipse cx="50" cy="71" rx="3" ry="2.5" fill="#c44" />
    );
  }
  // neutral
  return (
    <path
      d="M 46 71 Q 50 73 54 71"
      stroke="#2a1a14"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  );
}
