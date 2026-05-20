"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSimStore } from "@/lib/store/simulation-store";
import { track } from "@/lib/analytics";

export default function ReportPage() {
  const router = useRouter();
  const {
    base,
    userAgent,
    taAgent,
    finalSummary,
    resetGame,
    keepAgentsResetRounds,
  } = useSimStore();

  useEffect(() => {
    if (!finalSummary) router.replace("/simulator");
    else track("final_summary_view");
  }, [finalSummary, router]);

  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const shareCardRef = useRef<HTMLElement>(null);

  if (!finalSummary || !finalSummary.shareCard) return null;

  const userName = userAgent.name || base.name || "你";
  const taName = taAgent.name || base.taName || "Ta";
  const { title, prophecyLine, punchline } = finalSummary.shareCard;
  const v = finalSummary.fiveTwenty;
  // 兜底：万一服务端没有 fiveTwenty 字段（老数据），给一个默认"还差一步"
  const verdict = v?.verdict || "maybe";
  const verdictLabel = v?.verdictLabel || "还差一步";
  const keyMomentTime = v?.keyMomentTime || "23:47";
  const keyMomentAction = v?.keyMomentAction || "那一刻你没说的话";
  const nextChanceDate = v?.nextChanceDate;
  const nextChanceReason = v?.nextChanceReason;

  // 三档 verdict 的视觉主题
  const verdictColor =
    verdict === "will"
      ? { glow: "from-emerald-300/35 via-rose-300/15 to-rose-200/15", border: "border-emerald-300/40", big: "text-emerald-100" }
      : verdict === "maybe"
        ? { glow: "from-amber-300/30 via-rose-300/20 to-rose-200/15", border: "border-amber-300/40", big: "text-amber-100" }
        : { glow: "from-blue-300/25 via-rose-300/15 to-indigo-300/15", border: "border-rose-300/40", big: "text-rose-100" };

  const conclusionLine =
    verdict === "will"
      ? `${userName}和${taName} **大概率会** 在 5/20 这一天确认关系。`
      : verdict === "maybe"
        ? `${userName}和${taName} **还差一步** 在 5/20 这一天确认关系。`
        : `${userName}和${taName} **大概率不会** 在 5/20 这一天确认关系。`;

  function handleCopyText() {
    const lines = [
      `2026 · 5 · 20 · ${verdictLabel}`,
      "",
      conclusionLine.replace(/\*\*/g, ""),
      "",
      `关键时刻：5/20 · ${keyMomentTime}`,
      `关键动作：${keyMomentAction}`,
    ];
    if (nextChanceDate) {
      lines.push("", `下一次机会：${nextChanceDate}`, `（${nextChanceReason || ""}）`);
    }
    lines.push("", "— 命盘恋语 · 5/20 推演 —");
    const text = lines.join("\n");
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
    const card = shareCardRef.current;
    card.classList.add("capturing");
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(card, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#1a1a2e",
        style: { transform: "none" },
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return !node.dataset?.captureSkip;
        },
      });
      const ua = navigator.userAgent.toLowerCase();
      const isWechat = ua.includes("micromessenger");
      if (isWechat) {
        showInWechatViewer(dataUrl);
        setSavedHint("长按上图保存到相册 →");
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `lovelab-520-${verdict}-${Date.now()}.png`;
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
    const wrap = document.createElement("div");
    wrap.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:16px;`;
    wrap.onclick = () => document.body.removeChild(wrap);
    const img = document.createElement("img");
    img.src = dataUrl;
    img.style.cssText = `max-width:100%;max-height:80vh;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.5);`;
    const tip = document.createElement("div");
    tip.textContent = "长按图片 · 保存到相册";
    tip.style.cssText = `position:absolute;bottom:40px;left:0;right:0;text-align:center;color:rgba(255,255,255,0.85);font-size:14px;letter-spacing:0.1em;`;
    wrap.appendChild(img);
    wrap.appendChild(tip);
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
          5/20 推演结果
        </div>
        <div className="w-12" />
      </div>

      {/* ⭐ 5/20 主结论卡（截图主体） */}
      <motion.section
        ref={shareCardRef}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
        id="share-card"
        className={`relative rounded-[28px] overflow-hidden bg-gradient-to-br ${verdictColor.glow} border ${verdictColor.border} p-8 sm:p-10 shadow-2xl`}
      >
        <div
          data-capture-skip
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-rose-300/20 blur-3xl pointer-events-none"
        />
        <div
          data-capture-skip
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-rose-300/15 blur-3xl pointer-events-none"
        />

        <div className="relative flex flex-col items-center text-center">
          {/* 顶部日期 */}
          <div className="text-rose-200/65 text-[10.5px] tracking-[0.4em] mb-1">
            2 0 2 6 · 5 · 2 0
          </div>
          <div className="text-rose-200/45 text-[10px] tracking-[0.3em] mb-7">
            AI 推 演 结 果
          </div>

          {/* 大字 verdict */}
          <h1 className={`font-serif-cn ${verdictColor.big} text-7xl sm:text-8xl leading-none tracking-[0.15em] mb-7`}>
            {verdictLabel}
          </h1>

          {/* divider */}
          <div className="w-10 h-px bg-rose-300/60 mb-5" />

          {/* AI 结论一句话 */}
          <p className="font-serif-cn text-rose-50 text-[15px] sm:text-base leading-loose max-w-md mb-7"
             dangerouslySetInnerHTML={{
               __html: conclusionLine.replace(/\*\*(.+?)\*\*/g, '<strong class="text-rose-200">$1</strong>'),
             }} />

          {/* 关键时刻 */}
          <div className="bg-white/[0.04] border border-rose-300/15 rounded-2xl px-5 py-4 mb-5 w-full max-w-md text-left">
            <div className="text-rose-300/75 text-[10px] tracking-[0.28em] mb-1.5">
              ⌛ 关 键 时 刻
            </div>
            <div className="font-serif-cn text-rose-50 text-base tabular-nums">
              5/20 · {keyMomentTime}
            </div>
            <div className="font-serif-cn text-rose-100/85 text-[13px] mt-1 leading-relaxed">
              {keyMomentAction}
            </div>
          </div>

          {/* 下一次机会（仅 wont） */}
          {verdict === "wont" && nextChanceDate && (
            <div className="bg-emerald-300/8 border border-emerald-300/25 rounded-2xl px-5 py-4 mb-7 w-full max-w-md text-left">
              <div className="text-emerald-200/85 text-[10px] tracking-[0.28em] mb-1.5">
                ✦ 下 一 次 机 会
              </div>
              <div className="font-serif-cn text-rose-50 text-base tabular-nums">
                {nextChanceDate}
              </div>
              {nextChanceReason && (
                <div className="font-serif-cn text-rose-100/85 text-[13px] mt-1 leading-relaxed">
                  {nextChanceReason}
                </div>
              )}
            </div>
          )}

          {/* punchline 金句 */}
          {punchline && (
            <p className="font-serif-cn italic text-rose-50 text-[15px] sm:text-base leading-loose whitespace-pre-line max-w-md mb-7 opacity-90">
              {punchline}
            </p>
          )}

          {/* 水印 */}
          <div className="text-rose-200/45 text-[10px] tracking-[0.35em]">
            · 命 盘 恋 语 · 5 / 2 0 ·
          </div>
        </div>
      </motion.section>

      {/* 分享 + 复制 */}
      <div className="mt-5 flex gap-2">
        <button
          onClick={handleSaveImage}
          disabled={saving}
          className="flex-1 py-3 rounded-full bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 font-medium hover:scale-[1.01] active:scale-95 transition shadow-lg shadow-rose-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "⌛ 生成中..." : "💌 截图发朋友圈"}
        </button>
        <button
          onClick={handleCopyText}
          className="px-5 py-3 rounded-full border border-rose-300/40 text-rose-100 text-sm hover:bg-rose-300/10 active:scale-95 transition"
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

      {/* 完整预言（次级，折叠风格） */}
      {(title || prophecyLine) && (
        <details className="mt-8 rounded-2xl border border-rose-300/15 bg-white/[0.02] px-5 py-3.5">
          <summary className="text-rose-200/65 text-[12px] cursor-pointer list-none flex items-center justify-between">
            <span className="tracking-wider">▾ 看完整预言文</span>
            <span className="text-rose-200/40 text-[10px]">点开</span>
          </summary>
          <div className="mt-3 pt-3 border-t border-rose-300/10 space-y-3">
            {title && (
              <h3 className="font-serif-cn text-rose-100 text-lg tracking-wide">
                {title}
              </h3>
            )}
            {prophecyLine && (
              <p className="font-serif-cn text-rose-100/85 text-[13.5px] leading-loose whitespace-pre-line">
                {prophecyLine}
              </p>
            )}
          </div>
        </details>
      )}

      {/* 重玩 */}
      <div className="mt-8 space-y-3">
        <button
          onClick={() => {
            keepAgentsResetRounds();
            router.push("/simulator");
          }}
          className="w-full py-3.5 rounded-full bg-gradient-to-r from-rose-300/85 to-rose-400/85 text-midnight-900 font-medium hover:scale-[1.01] active:scale-95 transition shadow-lg shadow-rose-500/25 text-sm"
        >
          🔁 用同一对 agent 再推演一次
        </button>
        <button
          onClick={() => {
            resetGame();
            router.push("/setup");
          }}
          className="w-full py-3 rounded-full border border-rose-300/30 text-rose-100/70 text-sm hover:bg-rose-300/10 transition"
        >
          ↺ 换一对 agent 重新开始
        </button>
      </div>

      <p className="text-rose-200/35 text-[11px] text-center mt-8 mb-4">
        AI 看到的不等于真实发生。这只是 5/20 的一种可能。
      </p>
    </main>
  );
}
