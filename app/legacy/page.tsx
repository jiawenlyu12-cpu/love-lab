"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

// 5/20 倒计时：以 2026-05-20 00:00:00（本地时区）为目标
const TARGET = new Date("2026-05-20T00:00:00").getTime();

function formatCountdown(ms: number): {
  d: number;
  h: number;
  m: number;
  s: number;
  past: boolean;
} {
  if (ms <= 0) {
    return { d: 0, h: 0, m: 0, s: 0, past: true };
  }
  const total = Math.floor(ms / 1000);
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
    past: false,
  };
}

function CountdownCell({
  value,
  label,
  padding = 2,
}: {
  value: number | null;
  label: string;
  padding?: number;
}) {
  const text =
    value == null ? "—".repeat(padding) : String(value).padStart(padding, "0");
  return (
    <div className="flex flex-col items-center min-w-[3.25rem] sm:min-w-[5rem]">
      <div className="relative h-[2.6rem] sm:h-[3.8rem] overflow-hidden w-full flex items-center justify-center">
        <span
          key={text}
          className="font-serif-cn text-rose-100 text-[2.2rem] sm:text-[3.2rem] leading-none tabular-nums flip-num"
        >
          {text}
        </span>
      </div>
      <span className="caps text-rose-200/45 text-[9px] sm:text-[10px] mt-2">
        {label}
      </span>
    </div>
  );
}

function Divider({ char = "·" }: { char?: string }) {
  return (
    <span
      aria-hidden
      className="serif-italic text-rose-200/30 text-2xl sm:text-3xl mx-1 sm:mx-2 select-none"
    >
      {char}
    </span>
  );
}

export default function LandingPage() {
  const [now, setNow] = useState<number | null>(null);
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 数字递增到 2,847（缓动）
  useEffect(() => {
    const target = 2847;
    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setUsageCount(Math.floor(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const countdown = now != null ? formatCountdown(TARGET - now) : null;

  const stagger = useMemo(
    () => ({
      hidden: {},
      show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
    }),
    []
  );
  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] as const },
    },
  };

  return (
    <main className="relative min-h-[100svh] flex flex-col items-center px-5 py-10 sm:py-14 overflow-hidden bg-grain">
      {/* 柔和的 rose 光晕 —— 替代原来的 50 颗散点 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(232,180,160,0.18) 0%, rgba(232,180,160,0.06) 30%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-15%] right-[-10%] w-[80vw] h-[60vh] opacity-30"
        style={{
          background:
            "radial-gradient(circle at 70% 70%, rgba(246,164,135,0.14), transparent 60%)",
        }}
      />

      {/* === 顶部 editorial header === */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative w-full max-w-2xl flex items-center justify-between text-rose-200/40 text-[10px] sm:text-[11px]"
      >
        <span className="caps">Vol. 01 — 心动推演</span>
        <span className="serif-italic">2026 / 05 / 20</span>
      </motion.div>
      <div className="relative w-full max-w-2xl rule-line mt-3 mb-10 sm:mb-14" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-2xl text-center"
      >
        {/* === 倒计时 === */}
        <motion.p
          variants={fadeUp}
          className="caps text-rose-200/40 text-[10px] sm:text-[11px] mb-5"
        >
          离 那 一 天 还 剩
        </motion.p>

        <motion.div variants={fadeUp} className="mb-3 sm:mb-4">
          {countdown && !countdown.past ? (
            <div className="flex items-end justify-center">
              <CountdownCell value={countdown.d} label="Days" padding={3} />
              <Divider char="│" />
              <CountdownCell value={countdown.h} label="Hours" />
              <Divider char="│" />
              <CountdownCell value={countdown.m} label="Minutes" />
              <Divider char="│" />
              <CountdownCell value={countdown.s} label="Seconds" />
            </div>
          ) : countdown?.past ? (
            <div className="font-serif-cn text-rose-100 text-3xl sm:text-4xl">
              5/20 已经在进行中
            </div>
          ) : (
            <div className="flex items-end justify-center">
              <CountdownCell value={null} label="Days" padding={3} />
              <Divider char="│" />
              <CountdownCell value={null} label="Hours" />
              <Divider char="│" />
              <CountdownCell value={null} label="Minutes" />
              <Divider char="│" />
              <CountdownCell value={null} label="Seconds" />
            </div>
          )}
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="flex items-center justify-center gap-3 mb-12 sm:mb-16 text-rose-200/35"
        >
          <span className="h-px w-10 bg-rose-200/25" />
          <span className="serif-italic text-sm">☉</span>
          <span className="h-px w-10 bg-rose-200/25" />
        </motion.div>

        {/* === 主标题 === */}
        <motion.h1
          variants={fadeUp}
          className="font-serif-cn text-[2rem] leading-[1.18] sm:text-5xl md:text-[3.4rem] text-rose-100 mb-5 sm:mb-7"
        >
          AI 替你提前演一遍
          <br />
          5/20 那{" "}
          <span className="serif-italic text-rose-200">24 小时</span>
        </motion.h1>

        <motion.div
          variants={fadeUp}
          className="rule-line-solid mx-auto w-16 my-6 sm:my-7"
        />

        <motion.p
          variants={fadeUp}
          className="font-serif-cn text-base sm:text-lg text-rose-100/90 leading-relaxed mb-1.5"
        >
          告诉你 —— 你 和 ta
        </motion.p>
        <motion.p
          variants={fadeUp}
          className="font-serif-cn text-2xl sm:text-3xl md:text-[2.4rem] text-rose-200 leading-relaxed mb-10 sm:mb-12 tracking-[0.18em]"
        >
          会 不 会 在 一 起
        </motion.p>

        {/* === CTA === */}
        <motion.div variants={fadeUp}>
          <Link
            href="/setup"
            className="group inline-flex items-center justify-center gap-3 px-10 sm:px-14 py-4 sm:py-5 border border-rose-200/40 text-rose-100 hover:bg-rose-200/[0.04] active:scale-[0.98] transition-all"
          >
            <span className="font-serif-cn text-lg sm:text-xl cta-underline tracking-[0.25em]">
              推 演 我 的 5/20
            </span>
            <span className="cta-arrow serif-italic text-xl text-rose-200">
              →
            </span>
          </Link>
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="text-[11px] sm:text-xs text-rose-200/45 mt-5 tracking-wider"
        >
          90 秒 · 不写血型 · 不算姓名笔画
        </motion.p>
        <motion.p
          variants={fadeUp}
          className="text-[11px] sm:text-xs text-rose-200/35 mt-2"
        >
          已有{" "}
          <span className="serif-italic text-rose-200 text-base tabular-nums">
            {usageCount.toLocaleString()}
          </span>{" "}
          人推演过 ta 的 5/20
        </motion.p>
      </motion.div>

      {/* === 三段 editorial 卡片 === */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
        className="relative w-full max-w-3xl mt-20 sm:mt-28"
      >
        <div className="rule-line-solid mb-10" />
        <div className="grid grid-cols-3 gap-4 sm:gap-10 text-center">
          {[
            {
              n: "01",
              t: "三 件 事",
              d: "名字 · 生日",
              d2: "ta 的 代 称",
            },
            {
              n: "02",
              t: "十 个 时 刻",
              d: "AI 演 ta 的",
              d2: "那 24 小时",
            },
            {
              n: "03",
              t: "直 球 结 论",
              d: "会 / 不 会",
              d2: "或 差 一 步",
            },
          ].map((item) => (
            <div key={item.n} className="flex flex-col items-center">
              <span className="serif-italic text-rose-200/50 text-[11px] sm:text-xs mb-3">
                {item.n}
              </span>
              <h3 className="font-serif-cn text-rose-100 text-base sm:text-xl mb-3 tracking-[0.15em]">
                {item.t}
              </h3>
              <span className="h-px w-6 bg-rose-200/25 mb-3" />
              <p className="font-serif-cn text-rose-200/65 text-[11px] sm:text-sm leading-relaxed">
                {item.d}
                <br />
                {item.d2}
              </p>
            </div>
          ))}
        </div>
        <div className="rule-line-solid mt-10" />
      </motion.section>

      {/* === Editorial quote === */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1 }}
        className="relative w-full max-w-2xl mt-20 sm:mt-28 text-center"
      >
        <p className="serif-italic text-rose-200/55 text-[10px] sm:text-[11px] tracking-[0.35em] mb-5">
          AN EXCERPT
        </p>
        <blockquote className="font-serif-cn text-rose-100/90 text-xl sm:text-2xl md:text-3xl leading-relaxed">
          <span className="serif-italic text-rose-200/40 text-3xl align-top mr-1">
            &ldquo;
          </span>
          那 天 我 真 的 等 到 了。
          <span className="serif-italic text-rose-200/40 text-3xl align-bottom ml-1">
            &rdquo;
          </span>
        </blockquote>
        <p className="serif-italic text-rose-200/40 text-xs sm:text-sm mt-5">
          — 一 个 推 演 过 的 人
        </p>
      </motion.section>

      {/* === Footer === */}
      <footer className="relative w-full max-w-2xl mt-24 sm:mt-32 mb-2">
        <div className="rule-line mb-6" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] sm:text-[11px] text-rose-200/35">
          <span className="caps">AI · For Fun · Not Real Analysis</span>
          <div className="flex items-center gap-4">
            <a
              href="/legal/terms"
              className="hover:text-rose-200/70 underline-offset-4 hover:underline transition"
            >
              用户协议
            </a>
            <span className="text-rose-200/20">·</span>
            <a
              href="/legal/privacy"
              className="hover:text-rose-200/70 underline-offset-4 hover:underline transition"
            >
              隐私声明
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
