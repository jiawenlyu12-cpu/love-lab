"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSimStore } from "@/lib/store/simulation-store";
import ChatScreenshotUpload from "@/components/ChatScreenshotUpload";
import { toPng } from "html-to-image";

type Verdict = "will" | "maybe" | "wont";

interface Result {
  verdict: Verdict;
  verdictLabel: string;       // "会" / "还差一步" / "不会"
  title: string;              // 4-10 字主标题
  chatReading: string;        // 第一步：聊天解读
  baziReading: string;        // 第二步：八字底色
  fiveTwentyEnding: string;   // 第三步：520 结局
  nextChanceDate?: string;
  nextChanceReason?: string;
  punchline?: string;
}

export default function Page() {
  const [userName, setUserName] = useState("");
  const [userBirthday, setUserBirthday] = useState("");
  const [taName, setTaName] = useState("");
  const [taBirthday, setTaBirthday] = useState("");
  const { chatScreenshots } = useSimStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const imgs = chatScreenshots || [];
  const canSubmit =
    userName.trim() &&
    userBirthday &&
    taName.trim() &&
    taBirthday &&
    imgs.length > 0 &&
    !loading;

  async function onSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/520", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: { name: userName.trim(), birthday: userBirthday },
          ta: { name: taName.trim(), birthday: taBirthday },
          screenshots: imgs,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Result;
      setResult(data);
      // 滚到顶部，结果卡居中
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setErr(e?.message || "出了点问题，再试一次");
    } finally {
      setLoading(false);
    }
  }

  async function downloadCard() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#150b0d",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `lovelab-520-${userName}-${taName}.png`;
      a.click();
    } catch (e) {
      // 兜底：让用户长按截图
      alert("下载失败，你可以长按卡片截图保存");
    }
  }

  function reset() {
    setResult(null);
    setErr(null);
  }

  return (
    <main className="relative min-h-[100svh] px-5 py-8 sm:py-12 overflow-hidden bg-grain">
      {/* 柔和光晕 */}
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

      <div className="relative max-w-xl mx-auto">
        {/* === Editorial header === */}
        <header className="flex items-center justify-between text-rose-200/40 text-[10px] sm:text-[11px]">
          <span className="caps">Vol. 02 — 520 Special</span>
          <span className="serif-italic">2026 / 05 / 20</span>
        </header>
        <div className="rule-line mt-3 mb-8 sm:mb-10" />

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
            >
              {/* === 主标题 === */}
              <h1 className="font-serif-cn text-rose-100 text-[2.1rem] sm:text-5xl leading-[1.18] mb-4 sm:mb-6 text-center">
                520
                <span className="serif-italic text-rose-200/70 mx-3">·</span>
                ta 会 不 会
                <br />
                <span className="serif-italic text-rose-200">这一次松口</span>
              </h1>

              <div className="rule-line-solid mx-auto w-12 my-5 sm:my-6" />

              <p className="text-rose-200/65 text-[13px] sm:text-sm leading-relaxed mb-10 text-center max-w-md mx-auto">
                给 AI 看你和 ta 的几张聊天截图，<br />
                配上双方生日的八字，<br />
                得一个钉死的、扎心但准的答案。
              </p>

              {/* === Form === */}
              <div className="space-y-6">
                {/* 你 */}
                <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.03] px-5 py-5">
                  <div className="serif-italic text-rose-200/60 text-[11px] tracking-[0.35em] mb-3 uppercase">
                    01 · You
                  </div>
                  <div className="space-y-3">
                    <Field
                      label="你的名字"
                      placeholder="给 AI 一个称呼就行"
                      value={userName}
                      onChange={setUserName}
                      maxLength={12}
                    />
                    <DateField
                      label="你的生日"
                      value={userBirthday}
                      onChange={setUserBirthday}
                    />
                  </div>
                </div>

                {/* ta */}
                <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.03] px-5 py-5">
                  <div className="serif-italic text-rose-200/60 text-[11px] tracking-[0.35em] mb-3 uppercase">
                    02 · The Other
                  </div>
                  <div className="space-y-3">
                    <Field
                      label="ta 的名字"
                      placeholder="ta 在你手机里叫什么"
                      value={taName}
                      onChange={setTaName}
                      maxLength={12}
                    />
                    <DateField
                      label="ta 的生日"
                      value={taBirthday}
                      onChange={setTaBirthday}
                    />
                  </div>
                </div>

                {/* 截图 */}
                <ChatScreenshotUpload />
              </div>

              {/* CTA */}
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className={`group inline-flex items-center justify-center gap-3 px-10 sm:px-14 py-4 sm:py-5 border transition-all ${
                    canSubmit
                      ? "border-rose-200/55 text-rose-100 hover:bg-rose-200/[0.05] active:scale-[0.98]"
                      : "border-rose-200/15 text-rose-200/30 cursor-not-allowed"
                  }`}
                >
                  <span className="font-serif-cn text-lg sm:text-xl tracking-[0.25em]">
                    {loading ? "AI 正在解卦…" : "解 出 520 结 局"}
                  </span>
                  {!loading && (
                    <span className="serif-italic text-xl text-rose-200">→</span>
                  )}
                </button>
                {!canSubmit && !loading && (
                  <p className="mt-3 text-[11px] text-rose-200/40">
                    填好双方姓名+生日，再传至少一张聊天截图
                  </p>
                )}
                {err && (
                  <p className="mt-3 text-[11.5px] text-rose-300">{err}</p>
                )}
              </div>

              {/* tagline */}
              <p className="mt-10 text-center text-[10.5px] text-rose-200/35 tracking-wider">
                AI · 仅供消遣 · 不构成关系建议
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5 }}
            >
              <ResultCard
                ref={cardRef}
                result={result}
                userName={userName}
                taName={taName}
              />

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={downloadCard}
                  className="px-8 py-3 border border-rose-200/55 text-rose-100 hover:bg-rose-200/[0.05] active:scale-[0.98] transition-all font-serif-cn tracking-[0.2em]"
                >
                  下 载 卡 片
                </button>
                <button
                  onClick={reset}
                  className="px-8 py-3 border border-rose-200/20 text-rose-200/60 hover:text-rose-100 hover:border-rose-200/40 active:scale-[0.98] transition-all font-serif-cn tracking-[0.2em]"
                >
                  换 一 个 人 算
                </button>
              </div>

              <p className="mt-8 text-center text-[10.5px] text-rose-200/35 tracking-wider">
                结局是 AI 的猜测 · 行不行还得你自己去问
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-20 sm:mt-24">
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
      </div>
    </main>
  );
}

// ---------- 子组件 ----------

function Field({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="block text-rose-200/55 text-[11px] mb-1.5 tracking-wide">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full bg-white/[0.04] border border-rose-200/20 rounded-lg px-3.5 py-2.5 text-rose-100 text-[14px] placeholder:text-rose-200/25 focus:outline-none focus:border-rose-200/55 transition"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-rose-200/55 text-[11px] mb-1.5 tracking-wide">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="1950-01-01"
        max="2015-12-31"
        className="w-full bg-white/[0.04] border border-rose-200/20 rounded-lg px-3.5 py-2.5 text-rose-100 text-[14px] focus:outline-none focus:border-rose-200/55 transition [color-scheme:dark]"
      />
    </label>
  );
}

// ---------- 结果卡 ----------

const ResultCard = ({
  result,
  userName,
  taName,
  ref,
}: {
  result: Result;
  userName: string;
  taName: string;
  ref?: React.Ref<HTMLDivElement>;
}) => {
  // verdict 颜色和大字
  const verdictAccent =
    result.verdict === "will"
      ? "text-amber-200"
      : result.verdict === "maybe"
        ? "text-rose-200"
        : "text-rose-300/90";

  return (
    <div
      ref={ref}
      className="relative rounded-3xl border border-rose-300/25 bg-gradient-to-br from-[#1d0e12] via-[#231115] to-[#170a0d] px-7 py-9 sm:px-10 sm:py-12 overflow-hidden"
    >
      {/* 卡片头 */}
      <div className="flex items-center justify-between text-rose-200/40 text-[10px] sm:text-[11px] mb-6">
        <span className="caps">Lovelab · 520 Verdict</span>
        <span className="serif-italic">5 / 20</span>
      </div>

      {/* 主标题 verdict */}
      <div className="text-center mb-6">
        <p className="text-rose-200/50 text-[11px] tracking-[0.4em] uppercase mb-3">
          这个 520
        </p>
        <h2
          className={`font-serif-cn ${verdictAccent} text-[2rem] sm:text-[2.6rem] leading-tight`}
        >
          {result.title || verdictHeadline(result.verdict, taName)}
        </h2>
        <p className="serif-italic text-rose-200/55 text-sm mt-3">
          {result.verdictLabel}
        </p>
      </div>

      <div className="rule-line-solid mx-auto w-12 my-6" />

      {/* 三步走 */}
      <Section index="01" title="聊 天 里 露 出 的 真 相">
        {result.chatReading}
      </Section>
      <Section index="02" title="八 字 给 出 的 底 色">
        {result.baziReading}
      </Section>
      <Section index="03" title="5 / 20 这 一 天 的 结 局">
        {result.fiveTwentyEnding}
      </Section>

      {/* 下次机会（仅 wont） */}
      {result.verdict === "wont" && result.nextChanceDate && (
        <div className="mt-6 rounded-xl border border-rose-200/20 bg-rose-200/[0.04] px-5 py-4">
          <div className="text-rose-200/50 text-[10px] tracking-[0.35em] uppercase mb-1">
            Next Chance
          </div>
          <div className="font-serif-cn text-rose-100 text-lg">
            {formatDate(result.nextChanceDate)}
          </div>
          {result.nextChanceReason && (
            <div className="serif-italic text-rose-200/65 text-[12.5px] mt-1">
              {result.nextChanceReason}
            </div>
          )}
        </div>
      )}

      {/* punchline */}
      {result.punchline && (
        <blockquote className="mt-7 text-center">
          <p className="font-serif-cn text-rose-100/85 text-[15px] sm:text-base leading-relaxed whitespace-pre-line">
            {result.punchline}
          </p>
        </blockquote>
      )}

      {/* 卡片底部 */}
      <div className="mt-8 pt-5 border-t border-rose-200/12 flex items-center justify-between text-[10px] text-rose-200/35">
        <span className="serif-italic">
          {userName || "你"} × {taName || "ta"}
        </span>
        <span className="caps">lovelab.renlab.ai</span>
      </div>
    </div>
  );
};

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="serif-italic text-rose-200/45 text-[11px]">
          {index}
        </span>
        <h3 className="font-serif-cn text-rose-100 text-[13.5px] tracking-[0.15em]">
          {title}
        </h3>
      </div>
      <p className="text-rose-100/85 text-[13.5px] leading-[1.75] whitespace-pre-line">
        {children}
      </p>
    </div>
  );
}

function verdictHeadline(v: Verdict, taName: string): string {
  const t = taName || "ta";
  if (v === "will") return `${t} 会 松 口`;
  if (v === "maybe") return `差 一 步 而 已`;
  return `${t} 不 会 表 白`;
}

function formatDate(iso: string): string {
  // 2026-07-07 → 7月7日
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${parseInt(m[2])}月${parseInt(m[3])}日`;
}
