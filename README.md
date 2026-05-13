# 心动模拟器 · AI Love-Lab

**让 AI 把你和 ta 的关系演给你看 —— 一个事件驱动的关系演化预测产品。**

不是聊天 bot · 不是占卜 · 不是剧情小说。
观察者视角的"双 Agent 自演 + 有限导演权"。10-15 分钟跑完一段倒计时到 5/20 当晚的故事，离开时手里有 4 张可截图的洞察卡。

---

## 核心循环

```
[Setup]
 ├─ 1 个关系阶段
 ├─ 5 道情境校准题 → AI 综合出"看到的你"
 ├─ ta 的 5 项白描（称呼 / 印象 chips / 最近行为 / 间隔 / 小习惯）
 └─ 可选：你最想搞清楚的事
        ↓
[5 集自演 · 倒计时到 5/20]
 ├─ Ep1 (5/13 前后)  起点情境
 ├─ Ep2 (5/16 前后)  情绪起伏
 ├─ Ep3 (5/18 前后)  ★ 抉择 1：你的 Agent 怎么应对 ta 的试探
 ├─ Ep4 (5/19)       节日前夜
 └─ Ep5 (5/20 22-24h)★ 抉择 2 + 决定性时刻
        ↓ 每集结束自动一张 mini 洞察卡
        ↓
[终局解读 · 4 张卡]
 ├─ 主预言卡    AI 看见的 5/20 当晚（落到具体分钟，预言时态）
 ├─ 镜像差错卡  你以为的你 vs AI 演出的你
 ├─ 信号卡      ta 在 5 集里反复发出的某种信号
 └─ 应对卡      可解释性优先的方向感建议
```

3 张副卡末尾统一加「这只是一种可能」。主卡不加 — 主卡的克制感由"预言时态"本身承担。

---

## 设计原则（红线）

1. **永远不显示数字打分** —— 不分级，不命中率，不 SABCD
2. **永远不评判用户** —— 没有"你不懂 ta"
3. **永远用预言时态** —— "会 / 可能 / 大概率"，禁止过去时和确定式现在时
4. **抉择不是猜对错** —— 是用户校准自己的 Agent，"你选什么 AI 就照你选的演下去"
5. **可解释性 > 精确性** —— 应对卡写"留出空间比加大输出更能..."，不写"周日晚 8 点不要发长消息"

---

## Agent 架构（8 个）

**演出层**
- `dm-system` — 抛事件，倒计时叙事，第 5 集落到目标日 22:00-24:00
- `user-mirror` — 你的 Agent，按 setup + 抉择行动
- `crush-bot` — ta 的 Agent，按印象 chip + 行为白描行动
- `episode-insight` — 每集结束的 mini 洞察卡

**解读层**
- `mirror-diff` — 镜像差错卡（对比 setup 自报 vs 实际行为）
- `forecaster-signal` — 信号卡
- `forecaster-action` — 应对卡（可解释性优先模板）
- `narrator` — 主预言卡（最严的语调约束在这）

**辅助**
- `calibration-derive` — 把 5 道答题综合成 derivedTraits

每个 agent 在 `lib/agents/*.ts` 独立维护 system prompt。调用统一从 `app/api/agents/route.ts` 走，前端永不接触 API key。

---

## 关键隔离

- Crush-Bot 的 system prompt 永远不和 User-Mirror 的 prompt 拼在一起
- Crush-Bot 永远不知道任何"好感度"或"评价"
- 抉择写入 User-Mirror 的 system prompt 增量；**不影响 Crush-Bot**
- DM-System 知道目标日和倒计时，但不知道双方的内心

---

## 文件结构

```
app/
  api/agents/route.ts      统一 LLM 入口
  setup/page.tsx           关系阶段 + 5 道校准 + ta 画像
  simulator/page.tsx       5 集状态机
  report/page.tsx          1 主卡 + 3 副卡
  page.tsx                 Landing
components/
  predict/
    EventCard.tsx          每集顶部的事件卡
    DecisionPanel.tsx      抉择面板
    EpisodeStream.tsx      当前集的 beats 流
    InsightSlip.tsx        集间的 mini 洞察卡
lib/
  agents/                  8 个 agent 各自一个文件 + mock.ts
  store/simulation-store.ts  Zustand + persist
  calibration.ts           5 道情境校准题数据
  decisions.ts             第 3、5 集的抉择题
  engine.ts                前端 fetch 封装
  types.ts                 全局类型 + 常量
  utils.ts                 cn / uid / avatarFor
```

---

## 启动

```bash
npm install
cp .env.example .env.local   # 填 ANTHROPIC_API_KEY；留空走 mock 模式
npm run dev
```

| Env | 说明 |
|---|---|
| `ANTHROPIC_API_KEY` | 留空时所有 Agent 走预置 mock，UI 完整可演但内容固定 |
| `ANTHROPIC_MODEL`   | 默认 `claude-sonnet-4-5` |

---

## 已知 limitation

- **Mock 模式**：无 API key 时所有 Agent 输出都是预置随机样例。**不能反映真实模型质感**。投资人 / 真实测试必须配 key
- **没有平行结局**：原计划做的"看看选 B 会怎样"彩蛋砍到 v2，避免 5/20 上线压力
- **没有用户系统**：localStorage 持久化，单浏览器
- **没有移动端深度适配**：desktop 1280px+ 体验最佳
- **没有真实 streaming**：每个 Agent 一次性返回，靠 `wait()` 节拍模拟"对方正在反应"
- **节日 hook 写死 520**：v2 改为按当前日期动态切换最近的节日（七夕 / 中秋 / 12 月）

---

## v2 路线（5/20 后做）

- 平行结局彩蛋（终局后展示"如果选 B 会..."）
- 节日动态切换（自动落到下一个节日）
- 衍生入口：「你和你最在意的朋友」/「你和某类型的人」
- 长图导出（不只截图）+ 只读分享链接
- Crush-Bot streaming
- v3 再考虑小程序版本（Taro 迁移）
