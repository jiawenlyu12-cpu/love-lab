// 客户端埋点 helper
// 用法：import { track } from "@/lib/analytics"; track("setup_started")
//
// 数据流：track() → POST /api/track → Netlify Blobs
// 用 sendBeacon 在页面卸载时也能发出去；fetch keepalive 兜底

const VISITOR_KEY = "ail_visitor_id";

function uuid(): string {
  // RFC4122 v4，简化版（够当 visitor ID 用）
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getVisitorId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

interface TrackPayload {
  event: string;
  visitorId?: string;
  path?: string;
}

let inflight = 0;
const MAX_INFLIGHT = 8;

export function track(event: string, props?: Record<string, any>): void {
  if (typeof window === "undefined") return;
  if (!event) return;

  const payload: TrackPayload = {
    event,
    visitorId: getVisitorId(),
    path: window.location?.pathname,
  };
  // props 不传到服务端（服务端只数 event 名，不存 props）—— 留 props 参数是为以后扩展
  void props;

  const body = JSON.stringify(payload);

  // sendBeacon 优先：页面卸载也能发
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/track", blob);
      if (ok) return;
    } catch {
      // fall through
    }
  }

  // fetch keepalive 兜底
  if (inflight >= MAX_INFLIGHT) return;
  inflight++;
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  })
    .catch(() => {
      /* 静默失败，埋点不能阻塞业务 */
    })
    .finally(() => {
      inflight--;
    });
}

// 标准事件名常量（前后端共用）— 让 grep 能找到
export const Events = {
  pageview: "pageview",
  setup_started: "setup_started",
  setup_completed: "setup_completed",
  builder_started: "builder_started",
  builder_q_answered: "builder_q_answered",
  builder_completed: "builder_completed",
  simulator_opened: "simulator_opened",
  prophecy_viewed: "prophecy_viewed",
  scenario_picked: "scenario_picked",
  round_advance: "round_advance",
  round_reroll: "round_reroll",
  intervene_submit: "intervene_submit",
  peek_used: "peek_used",
  final_summary_view: "final_summary_view",
  agent_saved: "agent_saved",
  agent_loaded: "agent_loaded",
} as const;
