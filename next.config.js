/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 输出 standalone server.js + 最小化依赖目录，用于 Docker 部署
  // Vercel 部署时此选项无害
  output: "standalone",
  // 生产环境隐藏 powered-by header
  poweredByHeader: false,
  // 压缩响应
  compress: true,
};

module.exports = nextConfig;
