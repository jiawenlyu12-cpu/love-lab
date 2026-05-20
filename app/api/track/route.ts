import { NextRequest, NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics-tracker";

export const runtime = "nodejs";

const MAX_BODY = 4 * 1024; // 4 KB 上限，防滥用

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    const body = JSON.parse(text || "{}");
    const event = String(body.event || "").slice(0, 64);
    if (!event) {
      return NextResponse.json({ error: "missing_event" }, { status: 400 });
    }
    const visitorId =
      typeof body.visitorId === "string"
        ? body.visitorId.slice(0, 48).replace(/[^a-zA-Z0-9_-]/g, "")
        : undefined;
    const path =
      typeof body.path === "string" ? body.path.slice(0, 128) : undefined;

    // 必须 await：Netlify Function 在 response 后就会被回收，
    // void 触发的 Promise 不保证完成
    await recordEvent({ event, visitorId, path });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "bad_request", message: e?.message?.slice?.(0, 100) },
      { status: 400 }
    );
  }
}
