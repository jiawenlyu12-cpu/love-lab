"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSimStore } from "@/lib/store/simulation-store";
import type { RoundEvent } from "@/lib/types";

export default function ReportPage() {
  const router = useRouter();
  const {
    base,
    userAgent,
    taAgent,
    rounds,
    relationship,
    finalSummary,
    resetGame,
  } = useSimStore();

  useEffect(() => {
    if (!finalSummary) router.replace("/simulator");
  }, [finalSummary, router]);

  const [openAnalysis, setOpenAnalysis] = useState(false);
  const [openMoments, setOpenMoments] = useState(false);
  const [openTrajectory, setOpenTrajectory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const shareCardRef = useRef<HTMLElement>(null);

  if (!finalSummary || !finalSummary.shareCard) return null;

  const userName = userAgent.name || base.name || "你";
  const taName = taAgent.name || base.taName || "Ta";
  const { title, prophecyLine, punchline } = finalSummary.shareCard;

  function handleCopyText() {
    const text = `${title}\n\n${prophecyLine}\n\n${punchline}\n\n— ai-love-lab`;
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setSavedHint("已复制文案 ✓");
      setTimeout(() => setSavedHint(null), 2400);
    }
  }

  async function handleSaveImage() {
    if (!shareCardRef.current || saving) return;
    setSaving(true);
    setSavedHint(null);
    // ⭐ 关键修复：html-to-image 无法光栅化 backdrop-filter / filter:blur
    // 捕获时给卡片加 capturing 类，css 把所有 blur 切成纯色或 radial-gradient
    const card = shareCardRef.current;
    card.classList.add("capturing");
    // 等一帧让样式生效
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(card, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#1a1a2e",
        style: {
          transform: "none", // 关掉 motion 的 transform 防止裁切
        },
        // 过滤：跳过明确标记"不参与截图"的子节点（如 blur 装饰）
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return !node.dataset?.captureSkip;
        },
      });

      // 检测是否在微信内置浏览器（不能直接下载）
      const ua = navigator.userAgent.toLowerCase();
      const isWechat = ua.includes("micromessenger");

      if (isWechat) {
        // 微信内：把 dataURL 放到一个全屏 img 让用户长按保存
        showInWechatViewer(dataUrl);
        setSavedHint("长按上图保存到相册 →");
      } else {
        // 普通浏览器：直接下载
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `ai-love-lab-520-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setSavedHint("已保存到下载夹 ✓");
        setTimeout(() => setSavedHint(null), 2800);
      }
    } catch (e) {
      console.error("[save image] error", e);
      setSavedHint("保存失败，请长按卡片截图");
      setTimeout(() => setSavedHint(null), 3000);
    } finally {
      card.classList.remove("capturing");
      setSaving(false);
    }
  }

  function showInWechatViewer(dataUrl: string) {
    // 微信兜底：弹一个全屏 img，用户长按保存
    const wrap = document.createElement("div");
    wrap.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    `;
    wrap.onclick = () => document.body.removeChild(wrap);

    const img = document.createElement("img");
    img.src = dataUrl;
    img.style.cssText = `
      max-width: 100%; max-height: 80vh; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    `;

    const tip = document.createElement("div");
    tip.textContent = "长按图片 · 保存到相册";
    tip.style.cssText = `
      position: absolute; bottom: 40px; left: 0; right: 0; text-align: center;
      color: rgba(255,255,255,0.85); font-size: 14px; letter-spacing: 0.1em;
    `;

    const close = document.createElement("div");
    close.textContent = "点击空白处关闭";
    close.style.cssText = `
      position: absolute; top: 24px; right: 24px;
      color: rgba(255,255,255,0.55); font-size: 12px;
    `;

    wrap.appendChild(img);
    wrap.appendChild(tip);
    wrap.appendChild(close);
    document.body.appendChild(wrap);
  }

  return (
    <main className="min-h-[100svh] px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5 sm:mb-6">
        <Link
          href="/simulator"
          className="text-rose-200/55 text-sm hover:text-rose-100 py-2 px-1 -mx-1"
        >
          ← 回沙盘
        </Link>
        <div className="text-rose-200/45 text-[11px] tracking-wider">
          主预言卡
        </div>
        <div className="w-12" />
      </div>

      {/* ⭐ Share Card — 主分享卡（主预言 + 金句二合一） */}
      <motion.section
        ref={shareCardRef}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
        id="share-card"
        className="relative rounded-[28px] overflow-hidden bg-gradient-to-br from-rose-300/30 via-rose-400/12 to-amber-300/16 border border-rose-300/35 p-8 sm:p-10 shadow-2xl"
      >
        <div
          data-capture-skip
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-rose-300/20 blur-3xl pointer-events-none"
        />
        <div
          data-capture-skip
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-amber-300/15 blur-3xl pointer-events-none"
        />

        <div className="relative flex flex-col items-center text-center min-h-[420px] sm:min-h-[480px] justify-between">
          {/* 顶部水墨标 */}
          <div>
            <div className="text-rose-200/55 text-[10px] tracking-[0.4em] uppercase mb-3">
              5/20 · 主预言
            </div>
            <h1 className="font-serif-cn text-rose-50 text-3xl sm:text-4xl leading-tight tracking-wide">
              {title}
            </h1>
          </div>

          {/* 中段分隔 */}
          <div className="w-12 h-px bg-rose-300/60 my-6" />

          {/* 预言行（具象） */}
          <p className="font-serif-cn text-rose-50/95 text-base sm:text-lg leading-loose whitespace-pre-line max-w-md">
            {prophecyLine}
          </p>

          {/* 金句（普适 · 可截图） */}
          <p className="font-serif-cn italic text-rose-50 text-lg sm:text-xl leading-loose whitespace-pre-line max-w-md mt-6">
            {punchline}
          </p>

          {/* 水印 */}
          <div className="mt-8 text-rose-200/45 text-[10px] tracking-[0.35em]">
            · ai-love-lab ·
          </div>
        </div>
      </motion.section>

      {/* 分享操作 */}
      <div className="mt-5 flex gap-2">
        <button
          onClick={handleSaveImage}
          disabled={saving}
          className="flex-1 py-3 rounded-full bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 font-medium hover:scale-[1.01] active:scale-95 transition shadow-lg shadow-rose-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "⌛ 生成中..." : "📸 保存为图片"}
        </button>
        <button
          onClick={handleCopyText}
          className="flex-1 py-3 rounded-full border border-rose-300/40 text-rose-100 text-sm hover:bg-rose-300/10 active:scale-95 transition"
        >
          复制文案
        </button>
      </div>

      <div className="text-center mt-3 min-h-[18px]">
        {savedHint ? (
          <p className="text-rose-300 text-[11px] tracking-wider">{savedHint}</p>
        ) : (
          <p className="text-rose-200/40 text-[11px]">
            卡片不含 ta 真名，可放心分享
          </p>
        )}
      </div>

      {/* 下面是次级内容，全部折叠 */}
      <div className="mt-10 space-y-4">
        {/* 3 维投射分析 */}
        {finalSummary.analysis && (
          <FoldSection
            label="写给你的 3 张镜子（关于你自己）"
            open={openAnalysis}
            onToggle={() => setOpenAnalysis((v) => !v)}
          >
            <div className="space-y-3 pt-2">
              <AnalysisCard
                label="① 你的投射"
                body={finalSummary.analysis.yourProjection}
              />
              <AnalysisCard
                label="② 你的位置（八字 + 答题综合）"
                body={finalSummary.analysis.yourPosition}
                highlight
              />
              <AnalysisCard
                label="③ 你的盲点"
                body={finalSummary.analysis.yourBlindSpot}
                tone="blue"
              />
            </div>
          </FoldSection>
        )}

        {/* 关键转折点 */}
        {finalSummary.keyMoments && finalSummary.keyMoments.length > 0 && (
          <FoldSection
            label={`关键转折点（${finalSummary.keyMoments.length}）`}
            open={openMoments}
            onToggle={() => setOpenMoments((v) => !v)}
          >
            <div className="space-y-2 pt-2">
              {finalSummary.keyMoments.map((m, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3 bg-white/5 border border-rose-300/15"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-serif-cn text-rose-100 text-sm">
                      {m.label}
                    </span>
                    <span className="text-rose-200/45 text-[11px] tracking-wider">
                      {m.time}
                    </span>
                  </div>
                  <div className="text-rose-200/55 text-[11px] mb-1">
                    {m.impact}
                  </div>
                  <p className="text-rose-100/85 text-[12.5px] leading-relaxed font-serif-cn">
                    {m.note}
                  </p>
                </div>
              ))}
            </div>
          </FoldSection>
        )}

        {/* 状态轨迹 */}
        {rounds.length > 0 && (
          <FoldSection
            label={`${rounds.length} 个回合的状态轨迹`}
            open={openTrajectory}
            onToggle={() => setOpenTrajectory((v) => !v)}
          >
            <Trajectory rounds={rounds} />
          </FoldSection>
        )}
      </div>

      {/* 重玩 */}
      <div className="mt-10">
        <button
          onClick={() => {
            resetGame();
            router.push("/setup");
          }}
          className="w-full py-3 rounded-full border border-rose-300/30 text-rose-100/70 text-sm hover:bg-rose-300/10 transition"
        >
          ↺ 换一对 agent 再来一次
        </button>
      </div>

      <p className="text-rose-200/35 text-[11px] text-center mt-8 mb-4">
        AI 看到的不等于真实发生。这只是一种可能。
      </p>
    </main>
  );
}

function FoldSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-rose-300/15 overflow-hidden bg-white/[0.02]">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition"
      >
        <span className="text-rose-100/85 text-sm tracking-wider">{label}</span>
        <span className="text-rose-200/55 text-xs">{open ? "▲" : "▾"}</span>
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
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnalysisCard({
  label,
  body,
  tone = "rose",
  highlight,
}: {
  label: string;
  body: string;
  tone?: "rose" | "blue";
  highlight?: boolean;
}) {
  const accent =
    tone === "rose"
      ? "border-rose-300/55 from-rose-300/12"
      : "border-blue-300/50 from-blue-300/10";
  return (
    <div
      className={`px-5 py-4 rounded-2xl bg-gradient-to-r to-transparent border-l-2 ${accent} ${
        highlight ? "ring-1 ring-rose-300/25" : ""
      }`}
    >
      <div className="text-rose-200/55 text-[10px] tracking-[0.3em] uppercase mb-2">
        {label}
      </div>
      <p className="text-rose-100 text-[13px] leading-relaxed font-serif-cn whitespace-pre-line">
        {body}
      </p>
    </div>
  );
}

function Trajectory({ rounds }: { rounds: RoundEvent[] }) {
  if (rounds.length === 0) return null;

  // SVG sparkline：closeness（实线）/ userMood（虚线）/ taAffection（揭晓红线）
  const W = 320;
  const H = 100;
  const padding = 10;
  const xs = rounds.map(
    (_, i) =>
      padding + (i * (W - padding * 2)) / Math.max(1, rounds.length - 1)
  );
  const yOf = (v: number) =>
    padding + (1 - v / 100) * (H - padding * 2);

  const pathFor = (getter: (r: RoundEvent) => number) =>
    xs
      .map(
        (x, i) =>
          `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yOf(getter(rounds[i])).toFixed(1)}`
      )
      .join(" ");

  const closenessPath = pathFor((r) => r.stateAfter.closeness);
  const userMoodPath = pathFor((r) => r.stateAfter.userMood);
  const taAffectionPath = pathFor((r) => r.stateAfter.taAffection);

  return (
    <div className="pt-2">
      <div className="rounded-xl bg-white/5 p-4 border border-rose-300/10">
        <div className="text-[10px] tracking-[0.3em] text-rose-200/55 mb-2 uppercase">
          状态轨迹（3 维同步）
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-24"
          preserveAspectRatio="none"
        >
          {/* 50% 中线参考 */}
          <line
            x1={padding}
            x2={W - padding}
            y1={yOf(50)}
            y2={yOf(50)}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="2,3"
          />

          {/* taAffection — 揭晓的红线（最显眼） */}
          <path
            d={taAffectionPath}
            fill="none"
            stroke="rgb(220 38 38)"
            strokeOpacity="0.9"
            strokeWidth="1.8"
          />
          {xs.map((x, i) => (
            <circle
              key={`ta-${i}`}
              cx={x}
              cy={yOf(rounds[i].stateAfter.taAffection)}
              r="2.2"
              fill="rgb(220 38 38)"
            />
          ))}

          {/* closeness — 玫瑰金实线 */}
          <path
            d={closenessPath}
            fill="none"
            stroke="rgb(251 113 133)"
            strokeOpacity="0.95"
            strokeWidth="1.6"
          />
          {xs.map((x, i) => (
            <circle
              key={`c-${i}`}
              cx={x}
              cy={yOf(rounds[i].stateAfter.closeness)}
              r="2"
              fill="rgb(251 113 133)"
            />
          ))}

          {/* userMood — 紫色虚线 */}
          <path
            d={userMoodPath}
            fill="none"
            stroke="rgb(192 132 252)"
            strokeOpacity="0.85"
            strokeWidth="1.4"
            strokeDasharray="4,3"
          />
        </svg>

        {/* 图例 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10.5px]">
          <span className="inline-flex items-center gap-1.5 text-rose-200/85">
            <span className="w-3 h-0.5 bg-[rgb(251_113_133)]" /> 亲密度
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-200/85">
            <span
              className="w-3 h-0.5"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgb(192 132 252) 0 3px, transparent 3px 6px)",
              }}
            />{" "}
            你的状态
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-200/85">
            <span className="w-3 h-0.5 bg-[rgb(220_38_38)]" /> ta 的真实好感
            <span className="text-rose-200/45 text-[9.5px]">（终局揭晓）</span>
          </span>
        </div>

        <div className="flex justify-between text-[10px] text-rose-200/45 mt-2 pt-2 border-t border-rose-300/10">
          <span>{rounds[0]?.time}</span>
          <span>{rounds[rounds.length - 1]?.time}</span>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[11.5px]">
        {rounds.map((r) => (
          <div
            key={r.id}
            className="flex items-baseline gap-2 text-rose-200/75 font-serif-cn"
          >
            <span className="text-rose-200/45 tracking-wider w-12 shrink-0">
              {r.time}
            </span>
            <span className="flex-1 truncate">{r.eventText}</span>
            <span className="text-rose-300/70 text-[10.5px] shrink-0">
              {r.delta.closeness >= 0 ? "+" : ""}
              {r.delta.closeness}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
