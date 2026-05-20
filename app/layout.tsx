import type { Metadata, Viewport } from "next";
import "./globals.css";
import WechatHint from "@/components/WechatHint";
import PageviewTracker from "@/components/PageviewTracker";

export const metadata: Metadata = {
  title: "心动模拟器 · AI Love-Lab",
  description: "在沙盘中推演那段你不敢真实开口的关系。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "心动模拟器",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

// ⭐ 手机适配：viewport + 主题色 + 安全区
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1a2e",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased overflow-x-hidden">
        <WechatHint />
        <PageviewTracker />
        {children}
      </body>
    </html>
  );
}
