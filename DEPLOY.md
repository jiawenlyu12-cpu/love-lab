# AI Love-Lab · 上线部署指南

> 上线前的最后 1-2 公里。所有"代码层"工作已经做完，剩下的都是你的账号 / 服务商 / 备案动作。

---

## 1. 上线前 checklist

代码层（已完成 ✓）：

- [x] `npm run build` 通过，9 个路由全部成功生成
- [x] TypeScript 严格类型检查通过
- [x] `next.config.js` 启用 `output: "standalone"`（支持 Docker）
- [x] `app/error.tsx` + `app/not-found.tsx` 错误边界
- [x] `/legal/privacy` 隐私声明页（含 AI 生成声明、年龄限制、ta 不许填真名等）
- [x] IP rate limit（每 IP 每分钟 30 次调用，挡爬虫 + 防 LLM 成本爆炸）
- [x] `vercel.json` 部署配置（hkg1 区域 / 60s function timeout / 安全头）
- [x] `Dockerfile` + `.dockerignore`（自托管选项）
- [x] `.env.production.example` 环境变量模板
- [x] 首页加 footer：「AI 生成内容 · 仅供娱乐 · 不代表真实分析」+ 隐私链接
- [x] setup 页 ta 代称字段加显著「勿填真名」提示

业务层（你需要做的 ⚠️）：

- [ ] 申请 Anthropic API key（[console.anthropic.com](https://console.anthropic.com/settings/keys)）
- [ ] 注册域名（建议 `.com` 国际域名 + `.cn` 国内备案）
- [ ] 如需大陆访问：ICP 备案（个人 7-15 天 / 企业 20-30 天）
- [ ] 如面向公众放量：申请 **AIGC 服务备案**（国家网信办，企业主体，1-3 个月）
- [ ] 配置 LLM 成本告警（Anthropic Console / 国内云厂商）

---

## 2. 三条部署路径（选一条）

### 🚀 路径 A · Vercel（最快，推荐 demo 阶段）

适合：海外用户主 + 国内用户能接受 200-500ms 回源 + 想 10 分钟上线

```bash
# 1. 安装 Vercel CLI（如未安装）
npm i -g vercel

# 2. 进入项目目录
cd /Users/lv/projects/ai-love-lab

# 3. 首次部署 — 跟着 CLI 提示走，会要 GitHub 登录
vercel

# 4. 设置生产环境变量
vercel env add ANTHROPIC_API_KEY production
# 粘贴你的 sk-ant-api03-... key 后回车

vercel env add ANTHROPIC_MODEL production
# 输入：claude-sonnet-4-5

# 5. 部署生产
vercel --prod
```

完成后 Vercel 会给你一个 `xxx.vercel.app` 链接。绑定自定义域名在 Vercel Dashboard 加。

**注意**：
- `vercel.json` 已配置 `regions: ["hkg1"]`（香港节点，国内访问更友好）
- 函数超时 60s（够用，10 回合推演每次单调用 < 30s）

---

### 🐳 路径 B · 自托管（推荐放量阶段：腾讯云 / 阿里云）

适合：要 ICP 备案 + 大陆服务器 + 完整可控 + 长期成本低

```bash
# === 本机构建镜像 ===
cd /Users/lv/projects/ai-love-lab
docker build -t ai-love-lab:latest .

# === 本机验证镜像 ===
docker run --rm -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-api03-... \
  -e ANTHROPIC_MODEL=claude-sonnet-4-5 \
  ai-love-lab:latest

# 浏览器访问 http://localhost:3000 验证

# === 推到云上 ===
# 选项 1：推到腾讯云容器服务 TKE / Docker Hub 后云端拉取
# 选项 2：直接 scp 镜像 tar 包到 ECS 后 docker load

docker save ai-love-lab:latest | gzip > ai-love-lab.tar.gz
scp ai-love-lab.tar.gz user@your-server-ip:/tmp/

# 在服务器上：
ssh user@your-server-ip
docker load < /tmp/ai-love-lab.tar.gz
docker run -d --name love-lab \
  -p 3000:3000 \
  --restart unless-stopped \
  -e ANTHROPIC_API_KEY=sk-ant-api03-... \
  ai-love-lab:latest

# 加 nginx 反向代理 + Let's Encrypt SSL
sudo certbot --nginx -d yourdomain.com
```

**注意**：
- Anthropic API 在大陆不通，服务器要么放香港，要么搭境外 forward proxy
- 如果切换到国内 LLM（DeepSeek / 智谱），看路径 C

---

### 🇨🇳 路径 C · 国内 LLM（远期 · 真正放量）

如果你要在大陆 ICP 备案后跑爆款，必须切到国内 LLM：

1. **改 `app/api/agents/route.ts:callLLM`** —— 把 Anthropic SDK 换成 DeepSeek / 智谱 / Moonshot SDK
2. **改 prompts** —— 国内 LLM 对长 JSON 输出格式略不同，需要测试
3. **完成 AIGC 服务备案** —— 国内 LLM 也要求接备案过的算法

成本对比（10 回合一局）：
- Anthropic Haiku：~¥0.4 / 局
- DeepSeek-V3：~¥0.05 / 局（**便宜 8 倍**）
- 智谱 GLM-4：~¥0.06 / 局

切换工作量约 1 天。需要时告诉我，我直接帮你改。

---

## 3. 上线后立刻要做的

### 监控
- [ ] **错误告警**：接 Sentry 免费层 → `npm i @sentry/nextjs && npx @sentry/wizard`
- [ ] **运行时告警**：UptimeRobot 免费 → 每 5 min ping `/api/agents`（POST 个 dummy 请求看是否 200）
- [ ] **LLM 余额告警**：Anthropic Console 后台设阈值

### 埋点（最少必要）
插入到代码（你之后再加 PostHog / 友盟 / 自建都行）：

- 进 `/setup` 时打点 `setup_view`
- 完成 builder 时 `builder_complete`
- 第 1 回合产生 `round_1_played`
- 看到 report 时 `report_view`
- 截图按钮点击 `report_share_click`

最低四件套：完成率、留存、转化、分享率。

### 第一周观测
| 指标 | 目标 | 不达标说明 |
|------|------|------|
| Setup → Report 完成率 | ≥ 35% | 中途流失，流程太重或卡顿 |
| Report → 截图点击率 | ≥ 15% | 分享卡内容不够"想发" |
| 7 天复访 | ≥ 8% | 没有让用户记住产品的钩子 |
| 单局 LLM 成本 | < ¥0.5 | 立刻砍 prompt 或加 rate limit |
| 错误率 | < 1% | Sentry 报警 |

---

## 4. 紧急回滚

如果上线后出现严重 bug：

**Vercel**：
```bash
vercel rollback   # 一键回到上一版
```

**自托管**：
```bash
docker stop love-lab && docker rm love-lab
docker run -d --name love-lab ... ai-love-lab:previous-tag
```

---

## 5. 还没做但建议做的（按优先级）

1. **HTML2Canvas 分享卡导出**（提升分享率最有效，2-3 小时）—— 现在用户只能长按截图，加按钮"直接保存为图片"会大幅提升分享率
2. **OG meta 卡片**（提升微信/朋友圈分享展示，30 分钟）—— 现在分享链接是干光秃秃，加 `<meta property="og:image">` 让分享卡有大图
3. **微信内打开优化**（如果走微信传播，必须）—— 微信浏览器对 fixed/sticky 有 bug，需要单独测试
4. **AIGC 备案**（合规必经，建议立刻开始走流程）
5. **国内 LLM 切换**（成本+合规，立刻准备 PoC）

---

## 6. 给老板看的"产品状态"一句话

> **代码层 production-ready，本地 build 全过；接下来 30 分钟可以 demo 部署到 Vercel，2-3 天可以完成域名 + SSL + 监控完整上线；面向大陆公开放量前需 ICP 备案（1-2 周）+ AIGC 服务备案（1-3 个月）+ 国内 LLM 切换（1 天工作）。**

---

## 7. 我能帮你做的下一步

告诉我你选哪条路径，我可以：

- **A · Vercel**：你给我一个 ANTHROPIC_API_KEY（用 `!` 命令安全注入到 `.env.local`），我用 `vercel` CLI 走部署，给你看实际上线效果
- **B · 自托管**：你给我服务器 SSH 信息，我帮你装 docker + 部署 + 配 nginx + Let's Encrypt
- **C · 国内 LLM 切换**：你说切到哪个（DeepSeek / 智谱 / Moonshot），我改代码 + 跑对照测试
- **D · 分享卡 PNG 导出 + OG meta**：直接做，1-2 小时见效

—— ai-love-lab 上线工程 v1（2026-05-12）
