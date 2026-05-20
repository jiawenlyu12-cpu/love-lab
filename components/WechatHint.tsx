"use client";

import { useEffect, useState } from "react";

// 微信内置浏览器拦截 .netlify.app；引导用户用系统浏览器打开
export default function WechatHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isWechat = ua.includes("micromessenger");
    if (!isWechat) return;
    // 检查 sessionStorage：用户点过"我知道了"就不再显示
    try {
      if (sessionStorage.getItem("wx-hint-dismissed") === "1") return;
    } catch {
      /* sessionStorage 不可用，直接显示 */
    }
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center px-8 text-center"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      {/* 顶部箭头指向右上角 */}
      <div
        className="absolute top-3 right-4 flex flex-col items-end"
        style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      >
        <div className="text-rose-300 text-5xl leading-none">↗</div>
        <div className="text-rose-200 text-xs mt-1 tracking-wider whitespace-nowrap">
          点这里 ···
        </div>
      </div>

      <div className="text-rose-50 font-serif-cn text-2xl leading-relaxed mb-5">
        请在浏览器中打开
      </div>
      <p className="text-rose-100/85 text-sm leading-loose mb-2 max-w-xs">
        微信暂时屏蔽了此类外部链接
      </p>
      <p className="text-rose-200/65 text-[13px] leading-loose max-w-xs">
        请点击右上角 <span className="text-rose-300">···</span> 选择「在浏览器打开」，
        <br />
        或长按链接复制后到浏览器粘贴
      </p>

      <button
        onClick={() => {
          try {
            sessionStorage.setItem("wx-hint-dismissed", "1");
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
        className="mt-10 text-rose-200/55 text-xs underline underline-offset-2"
      >
        我已知道，先在微信里看
      </button>
    </div>
  );
}
