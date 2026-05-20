# Development Tasks (Issue Templates)

以下 Issues 按开发阶段排列。每个任务包含目标、验收标准和预估工作量。

---

## Phase 0: 概念与设计

### #1 🎨 确定美术风格与色彩方案
**Label:** `design` `art`
**Priority:** `P1`
**Estimate:** 3-5 days

**目标：**
- 确定整体美术方向（写实 / 风格化 / 介于之间）
- 制定色彩方案（毒气星球冷色调 + 荧光点缀）
- 收集参考图 Mood Board
- 产出 3-5 张概念图

**验收标准：**
- [ ] Mood Board 完成，涵盖地表/洞穴/遗迹/基地 4 个主题
- [ ] 色彩方案文档（含色板）
- [ ] 至少 3 张关键场景概念图（Crash Zone / Crystal Caves / Ancient Ruins）

---

### #2 🔢 数值系统设计
**Label:** `design` `systems`
**Priority:** `P1`
**Estimate:** 5-7 days

**目标：**
设计完整的游戏数值表，包括：
- 氧气消耗/回复曲线
- 科技升级成本曲线
- 敌人血量/伤害/波次成长曲线
- 建造材料成本
- 武器/塔防伤害平衡

**验收标准：**
- [ ] 完整的 Excel/Google Sheets 数值表
- [ ] 包含公式，可调整参数
- [ ] 3 个阶段的平衡测试计划

---

### #3 📖 叙事脚本撰写
**Label:** `design` `writing`
**Priority:** `P2`
**Estimate:** 7-10 days

**目标：**
- 撰写完整主线叙事脚本（PDA 日志、全息记录、无线电通讯）
- 设计遗迹壁画/雕刻内容
- 撰写支线日志（遇难者故事）
- 所有文本的中英文对照

**验收标准：**
- [ ] 主线叙事完整脚本（约 50+ 条日志/通讯）
- [ ] 10+ 条遇难者支线日志
- [ ] 遗迹叙事文本

---

## Phase 1: 核心原型

### #4 🏗️ 搭建项目框架
**Label:** `engineering` `setup`
**Priority:** `P0`
**Estimate:** 3-5 days
**Depends on:** #1

**目标：**
- 确定游戏引擎（UE5 / Unity / Godot）
- 初始化项目结构和仓库
- 配置版本控制和 CI
- 搭建基础场景

**验收标准：**
- [ ] 项目创建成功，仓库可运行
- [ ] 基础文件夹结构建立
- [ ] 一个简单的可运行场景（空地图 + 玩家控制器）
- [ ] CI 基础配置（自动构建）

---

### #5 👤 第一人称角色控制器
**Label:** `engineering` `gameplay`
**Priority:** `P0`
**Estimate:** 5-7 days

**目标：**
- 第一人称移动（行走/奔跑/跳跃/蹲下）
- 鼠标视角控制
- 与地形碰撞
- 基础交互射线检测

**验收标准：**
- [ ] 流畅的第一人称移动
- [ ] 斜坡/台阶正常导航
- [ ] 基础物理碰撞
- [ ] FPS 60+（目标硬件）

---

### #6 💨 氧气系统 — MVP
**Label:** `engineering` `core-system`
**Priority:** `P0`
**Estimate:** 7-10 days

**目标：**
- 氧气条 UI（类似深海迷航）
- 氧气随时间消耗
- 不同活动消耗倍率不同
- 返回基地自动补氧
- 氧气耗尽→死亡→重生

**验收标准：**
- [ ] O₂ UI 显示无误
- [ ] 消耗曲线正确（静止 1x / 跑 1.5x）
- [ ] 基地范围内自动补氧
- [ ] 耗尽后死亡并重生
- [ ] 可携带 O₂ 罐作为消耗品

---

### #7 🔨 基础建造系统
**Label:** `engineering` `core-system`
**Priority:** `P0`
**Estimate:** 10-14 days

**目标：**
- 建造模式（切换建造 UI）
- 模块放置（吸附网格）
- 3 种初始模块：核心舱、O₂ 发生器、太阳能板
- 建造动画/效果
- 材料消耗检查

**验收标准：**
- [ ] 按 B 进入建造模式
- [ ] 模块可放置在地面上
- [ ] 材料不足时无法建造
- [ ] 建造完成有视觉反馈
- [ ] 太阳能板白天发电，基地正常运转

---

### #8 🗺️ Crash Zone 地图制作
**Label:** `art` `level-design`
**Priority:** `P0`
**Estimate:** 14-20 days
**Depends on:** #1, #4

**目标：**
- 制作初始区域 Crash Zone（约 1km²）
- 含逃生舱坠落点
- 基础地形（丘陵、岩石、洞穴入口）
- 毒气大气效果
- 基础资源分布

**验收标准：**
- [ ] 地面可步行探索
- [ ] 体积雾效果（毒气氛围）
- [ ] 5+ 种资源点分布
- [ ] 性能稳定（60 FPS）
- [ ] 昼夜光照切换

---

### #9 👾 敌人 AI — 侦察虫
**Label:** `engineering` `ai`
**Priority:** `P0`
**Estimate:** 7-10 days

**目标：**
- 侦察虫模型 + 动画
- 基础 AI：巡逻/发现/追击/攻击
- 受击反馈
- 死亡效果

**验收标准：**
- [ ] 侦察虫按路线巡逻
- [ ] 玩家靠近时切换追击
- [ ] 近战攻击命中判定
- [ ] 可被玩家武器击杀
- [ ] 尸体/掉落物

---

### #10 🛡️ 基础塔防波次
**Label:** `engineering` `tower-defense`
**Priority:** `P0`
**Estimate:** 10-14 days

**目标：**
- 夜晚触发敌袭波次
- 3 种初始敌人类型
- 2 种防御塔（激光、散射）
- 波次难度递增
- 防御成功/失败判定

**验收标准：**
- [ ] 夜晚自动触发袭击
- [ ] 敌人沿路径向基地前进
- [ ] 防御塔自动索敌攻击
- [ ] 3+ 波次递增难度
- [ ] 胜利/失败条件明确

---

## Phase 2: 垂直切片

### #11 🏭 制造台与研究台
**Label:** `engineering` `ui`
**Priority:** `P1`
**Estimate:** 7-10 days

### #12 🌿 种植系统
**Label:** `engineering` `gameplay`
**Priority:** `P1`
**Estimate:** 5-7 days

### #13 💎 Crystal Caves 区域
**Label:** `level-design` `art`
**Priority:** `P1`
**Estimate:** 14-20 days

### #14 🤖 前人生存据点（叙事内容）
**Label:** `design` `level-design`
**Priority:** `P1`
**Estimate:** 7-10 days

### #15 🛵 探索小艇（第一个载具）
**Label:** `engineering` `gameplay`
**Priority:** `P1`
**Estimate:** 10-14 days

---

## Phase 3: 完整内容

### #16 🍄 Fungal Forests
**Label:** `level-design`
**Estimate:** 14-20 days

### #17 🟢 Toxic Swamp
**Label:** `level-design`
**Estimate:** 14-20 days

### #18 🌊 Abyssal Rift + 深潜机甲
**Label:** `level-design` `engineering`
**Estimate:** 20-25 days

### #19 🏛️ Ancient Ruins
**Label:** `level-design` `art`
**Estimate:** 20-25 days

### #20 🔮 The Core + 最终 BOSS
**Label:** `level-design` `engineering`
**Estimate:** 20-25 days

### #21 🎵 音效与音乐
**Label:** `audio`
**Estimate:** 20-30 days

---

## Phase 4: 打磨

### #22 🎮 UI/UX 全面优化
**Label:** `ui` `polish`
**Estimate:** 10-14 days

### #23 ⚡ 性能优化
**Label:** `engineering` `optimization`
**Estimate:** 10-14 days

### #24 🐛 Bug 修复 & QA
**Label:** `bug`
**Estimate:** ongoing

### #25 📦 打包与发布
**Label:** `devops`
**Estimate:** 5-7 days

---

> 总计约 30+ Issues，4 个开发阶段，预估总工作量：6-12 个月（取决于团队规模）
