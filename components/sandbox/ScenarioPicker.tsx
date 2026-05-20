"use client";

import { useState } from "react";
import { SCENARIO_PRESETS, type ScenarioPresetKey } from "@/lib/types";
import { cn } from "@/lib/utils";

// 关系主场景选择器
// 受控组件：父级传入当前 scenarioHint 字符串 + onChange
// 内部决定 chip 高亮 / 是否展开自定义输入框

interface Props {
  value: string;            // 当前 hint 字符串（空 = 让 AI 选）
  onChange: (next: string) => void;
}

function presetForValue(v: string): ScenarioPresetKey | null {
  if (!v) return null;
  // 完全匹配 hint
  const exact = SCENARIO_PRESETS.find((p) => p.label === v || p.hint === v);
  if (exact) return exact.key as ScenarioPresetKey;
  // 否则是 custom
  return "custom";
}

export default function ScenarioPicker({ value, onChange }: Props) {
  const activeKey = presetForValue(value);
  const [showCustom, setShowCustom] = useState(activeKey === "custom");
  const [draft, setDraft] = useState(activeKey === "custom" ? value : "");

  function pickPreset(key: ScenarioPresetKey, label: string) {
    if (key === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(label);
  }

  function commitCustom() {
    const v = draft.trim();
    if (v) onChange(v);
  }

  return (
    <div className="rounded-2xl border border-rose-300/15 bg-white/[0.02] px-3 py-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-rose-200/65 text-[10.5px] tracking-[0.24em]">
          📍 你 们 的 故 事 发 生 在 哪 里
        </span>
        <span className="text-rose-200/35 text-[9.5px]">选填</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {/* 让 AI 选（默认态） */}
        <button
          onClick={() => {
            setShowCustom(false);
            onChange("");
          }}
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full border transition active:scale-95",
            !value
              ? "border-rose-300/60 bg-rose-300/15 text-rose-100"
              : "border-rose-300/20 text-rose-200/70 hover:bg-rose-300/5"
          )}
        >
          让 AI 替我选
        </button>
        {SCENARIO_PRESETS.map((p) => {
          const active =
            p.key === "custom"
              ? activeKey === "custom"
              : value === p.label;
          return (
            <button
              key={p.key}
              onClick={() => pickPreset(p.key as ScenarioPresetKey, p.label)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full border transition active:scale-95",
                active
                  ? "border-rose-300/60 bg-rose-300/15 text-rose-100"
                  : "border-rose-300/20 text-rose-200/70 hover:bg-rose-300/5"
              )}
            >
              {p.key === "custom" ? "✎ 自定义" : p.label}
            </button>
          );
        })}
      </div>

      {/* 当前选中场景的 hint 描述 */}
      {value && !showCustom && (
        <p className="mt-2 text-rose-200/45 text-[10.5px] leading-snug">
          {presetForValue(value) !== "custom"
            ? SCENARIO_PRESETS.find((p) => p.label === value)?.hint || ""
            : `你输入的场景：${value}`}
        </p>
      )}

      {/* 自定义输入框 */}
      {showCustom && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="例：英语角认识的，但每周只能见一次 / 大学同学，毕业后我去了北京 ta 在上海，靠微信和偶尔的电话维系…"
            className="w-full bg-white/5 border border-rose-300/25 rounded-lg px-3 py-2 text-rose-50 text-[12.5px] placeholder:text-rose-200/30 focus:outline-none focus:border-rose-300/60 resize-y leading-relaxed"
            rows={3}
            onBlur={commitCustom}
            onKeyDown={(e) => {
              // Cmd/Ctrl + Enter 提交（Enter 单独保留换行）
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commitCustom();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-rose-200/35 text-[10px]">
              想写多少都行 · ⌘/Ctrl+↵ 确认
            </span>
            <button
              onClick={commitCustom}
              disabled={!draft.trim()}
              className={cn(
                "text-[11px] px-3 py-1 rounded-lg border transition active:scale-95",
                draft.trim()
                  ? "border-rose-300/45 text-rose-100 bg-rose-300/10"
                  : "border-white/8 text-rose-200/30 cursor-not-allowed"
              )}
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
