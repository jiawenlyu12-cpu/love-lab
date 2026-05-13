import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function avatarFor(seed: string): string {
  // 极简: 取一个稳定 emoji
  const pool = ["🧑‍💼", "🧑‍🎓", "🧑‍🎨", "🧑‍💻", "🧑‍🔬", "🧑‍🚀", "🧚", "🧝", "🦊", "🐈", "🐻", "🦁"];
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}
