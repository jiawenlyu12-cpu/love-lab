import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative min-h-[100svh] flex flex-col items-center justify-center px-5 py-10 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        {Array.from({ length: 50 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-rose-100"
            style={{
              top: `${(i * 73) % 100}%`,
              left: `${(i * 137) % 100}%`,
              width: `${(i % 3) + 1}px`,
              height: `${(i % 3) + 1}px`,
              opacity: 0.3 + (i % 5) / 10,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-2xl text-center">
        <p className="text-rose-200/70 text-xs sm:text-sm tracking-[0.3em] uppercase mb-5 sm:mb-6">
          AI Love-Lab
        </p>
        <h1 className="font-serif-cn text-[2.4rem] leading-[1.2] sm:text-5xl md:text-6xl text-rose-100 mb-7 sm:mb-8">
          你心里那个人，
          <br />
          今天会发消息吗？
        </h1>
        <p className="font-serif-cn text-base sm:text-lg md:text-xl text-rose-200/80 leading-relaxed mb-3 sm:mb-4">
          AI 用你的故事，演一遍真实可能发生的事
        </p>
        <p className="text-xs sm:text-sm text-rose-200/50 mb-10 sm:mb-12 leading-relaxed px-2">
          不打分 · 不预测 yes/no · 你看见的不是答案，是一种可能
        </p>

        <Link
          href="/setup"
          className="inline-block w-full sm:w-auto px-10 py-4 rounded-full bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 font-medium tracking-wider hover:scale-105 transition shadow-lg shadow-rose-500/30 active:scale-95"
        >
          让 AI 演一次 →
        </Link>

        <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-2 sm:gap-4 text-[10px] sm:text-xs text-rose-200/65">
          <div className="glass rounded-2xl p-3 sm:p-4">
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">👤</div>
            <div className="font-serif-cn text-rose-100 mb-1 text-[11px] sm:text-sm">
              基础信息
            </div>
            <p className="leading-snug">生日 / MBTI / ta 代称</p>
          </div>
          <div className="glass rounded-2xl p-3 sm:p-4">
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">🪞</div>
            <div className="font-serif-cn text-rose-100 mb-1 text-[11px] sm:text-sm">
              12 题养成
            </div>
            <p className="leading-snug">每答一题 agent 变丰富</p>
          </div>
          <div className="glass rounded-2xl p-3 sm:p-4">
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">🎬</div>
            <div className="font-serif-cn text-rose-100 mb-1 text-[11px] sm:text-sm">
              沙盘推演
            </div>
            <p className="leading-snug">推进 · 介入 · 读心</p>
          </div>
        </div>

        <div className="mt-10 text-rose-200/30 text-[10px] tracking-wider">
          AI 生成内容 · 仅供娱乐 · 不代表真实分析
          <span className="mx-2">·</span>
          <a
            href="/legal/privacy"
            className="hover:text-rose-200/60 underline-offset-2 hover:underline"
          >
            隐私声明
          </a>
        </div>
      </div>
    </main>
  );
}
