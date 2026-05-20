import type { Metadata, Viewport } from "next";
import "./globals.css";
import WechatHint from "@/components/WechatHint";
import PageviewTracker from "@/components/PageviewTracker";

export const metadata: Metadata = {
  title: "Lovelab · 520 这个结局你能扛得住吗",
  description: "给 AI 看你和 ta 的聊天截图 · 配上双方生日的八字 · 钉死一个 520 结局",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Lovelab · 520",
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
