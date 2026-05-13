"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 仅本地开发时打到控制台；生产环境如接 Sentry 在此 capture
    if (process.env.NODE_ENV !== "production") {
      console.error("[error.tsx]", error);
    }
  }, [error]);

  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">🌙</div>
      <h1 className="font-serif-cn text-2xl text-rose-100 mb-3">
        AI 暂时走神了
      </h1>
      <p className="text-rose-200/60 text-sm mb-8 max-w-md leading-relaxed">
        服务端遇到了一个意外。重试一下通常就好。
        <br />
        如果反复出现，可以换一对 agent 重新开始。
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-300 to-rose-400 text-midnight-900 font-medium text-sm hover:scale-[1.02] active:scale-95 transition"
        >
          重试
        </button>
        <a
          href="/"
          className="px-6 py-2.5 rounded-full border border-rose-300/40 text-rose-100 text-sm hover:bg-rose-300/10 transition"
        >
          回首页
        </a>
      </div>
      {error.digest && (
        <p className="text-rose-200/30 text-[10px] mt-8 tracking-wider">
          error id · {error.digest}
        </p>
      )}
    </main>
  );
}
