"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

// 客户端组件：每次 pathname 变化发一个 pageview 事件
export default function PageviewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    track("pageview");
  }, [pathname]);
  return null;
}
