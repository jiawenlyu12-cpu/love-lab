import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/analytics-tracker";

export const runtime = "nodejs";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authed(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false; // 未配置就不开放
  const got =
    req.nextUrl.searchParams.get("token") ||
    req.headers.get("x-admin-token") ||
    "";
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stats = await getStats();
  return NextResponse.json(stats, {
    headers: { "cache-control": "no-store" },
  });
}
