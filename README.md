# 星渊迷航 (Star Abyss Voyage)

> **探索生存 × 基地防守 × 星空** —— 在高压星球管理氧气，建立防线，发送救援信号并守住撤离窗口。

[![Design Doc](https://img.shields.io/badge/GDD-v0.1-blue)](docs/GAME_DESIGN_DOC.md)

---

## 核心概念

你是一名星际飞船的工程师，飞船遭遇未知能量冲击后解体。你在逃生舱中醒来，发现自己坠落在毒气笼罩的陌生星球。

- **氧气即生命** —— 每一次外出探索都在与时间赛跑
- **基地即堡垒** —— 白天探索建造，晚上抵御敌袭
- **探索即叙事** —— 扫描地下资源与信号缓存，逐步适应危险区域
- **撤离即终点** —— 持续供能信号台，撑过 180 秒撤离坚守

---

## 游戏循环

```
探索 → 收集 → 建造 → 防御 → 升级 → 探索更深 → 揭示真相 → 逃离
```

---

## 开发路线图

- [x] **Phase 0：概念设计** — Game Design Document 完成
- [x] **Phase 1：原型验证** — 已具备 O₂、采集、建造、昼夜防守与撤离闭环
- [ ] **Phase 2：垂直切片** — Crash Zone 完整内容
- [ ] **Phase 3：内容生产** — 全部区域 + 完整科技树
- [ ] **Phase 4：打磨发布** — 优化、测试、发行

---

## 技术栈

| 项目 | 当前选择 |
|------|----------|
| 引擎 | Godot 4.6.2 |
| 代码 | GDScript |
| 游戏工程 | `src/` |
| 浏览器规格原型 | `playable/star-abyss.html`（双击离线运行） |

---

## 文档

- [当前玩法执行版](docs/GAMEPLAY_v3.md)
- [HTML5 可玩规格原型](docs/HTML5_PROTOTYPE.md)
- [HTML ↔ Godot 行为契约](docs/HTML_GODOT_CONTRACT.md)
- [完整 Game Design Document](docs/GAME_DESIGN_DOC.md)
- [代码审查（唯一维护文档）](docs/REVIEW.md)
- [手工测试计划](docs/TEST_PLAN.md)
- [开发规则](docs/AI_DEVELOPMENT_RULES.md)
- [历史进度](PROGRESS.md)

---

> 🎮 *"在深渊中呼吸，在星光下逃离。"*
