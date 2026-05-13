import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">✨</div>
      <h1 className="font-serif-cn text-2xl text-rose-100 mb-3">
        这条路 AI 还没走过
      </h1>
      <p className="text-rose-200/60 text-sm mb-8">
        页面不存在 — 回首页重新开始吧
      </p>
      <Link
        href="/"
        className="px-8 py-3 rounded-full bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 font-medium text-sm hover:scale-[1.02] active:scale-95 transition"
      >
        回首页
      </Link>
    </main>
  );
}
