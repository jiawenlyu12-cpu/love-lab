"use client";

import { useRef, useState } from "react";
import { useSimStore } from "@/lib/store/simulation-store";
import { cn } from "@/lib/utils";

// 客户端压缩：长边 ≤ 1280，JPEG quality 0.72，base64 输出
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    const MAX_DIM = 1280;
    const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas ctx");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ChatScreenshotUpload() {
  const { chatScreenshots, addChatScreenshot, removeChatScreenshot } =
    useSimStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const imgs = chatScreenshots || [];
  const canAddMore = imgs.length < 5;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // 允许重复选同一个
    if (files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of files) {
        if (imgs.length + 1 > 5) break;
        if (!f.type.startsWith("image/")) {
          setErr("只能上传图片");
          continue;
        }
        if (f.size > 8 * 1024 * 1024) {
          setErr("单张图片不能超过 8MB");
          continue;
        }
        const dataUrl = await compressImage(f);
        addChatScreenshot(dataUrl);
      }
    } catch (e: any) {
      setErr(e?.message || "压缩失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-rose-300/22 bg-rose-300/[0.04] px-4 py-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-rose-100 text-[13px] font-medium tracking-wide">
          📷 让 AI 直接读你和 ta 的聊天
        </div>
        <span className="text-rose-200/40 text-[10px]">最多 5 张</span>
      </div>
      <p className="text-rose-200/55 text-[11px] leading-relaxed mb-3">
        上传你和 ta 最近一天的聊天截图，AI 会**直接读** ta 的说话风格、双方密度，让 5/20
        推演更像真实的 ta。
        <br />
        <span className="text-rose-200/40">⚠️ 截图会传给 AI 处理，但**不会**长期保存在我们服务器</span>
      </p>

      {/* 已上传缩略图 */}
      {imgs.length > 0 && (
        <div className="grid grid-cols-5 gap-2 mb-3">
          {imgs.map((src, i) => (
            <div
              key={i}
              className="relative aspect-[3/4] rounded-lg overflow-hidden border border-rose-300/25 bg-white/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`截图 ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeChatScreenshot(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-rose-100 text-[11px] flex items-center justify-center hover:bg-black/85 active:scale-90"
                aria-label="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || !canAddMore}
        className={cn(
          "w-full py-2.5 rounded-xl text-[12.5px] transition active:scale-[0.99]",
          busy
            ? "bg-white/5 text-rose-200/40"
            : canAddMore
              ? "border border-dashed border-rose-300/45 text-rose-100 hover:bg-rose-300/8"
              : "border border-white/8 text-rose-200/30 cursor-not-allowed"
        )}
      >
        {busy
          ? "压缩中…"
          : canAddMore
            ? imgs.length === 0
              ? "+ 上传聊天截图（推演更准）"
              : `+ 再加一张（${imgs.length}/5）`
            : "已达 5 张上限"}
      </button>

      {err && (
        <p className="text-rose-300 text-[10.5px] mt-2">{err}</p>
      )}
    </div>
  );
}
