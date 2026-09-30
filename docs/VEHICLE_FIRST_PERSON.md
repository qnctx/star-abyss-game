# 巡迹勘探车：驾驶第一人称

## 视角与操作

驾驶时 V 在驾驶第一人称和追尾之间切换。首次上车沿用当前步行的第一/第三人称偏好；之后单独记住驾驶选择，下车恢复步行选择。存档保存驾驶偏好，旧存档缺少字段时采用步行偏好。

驾驶第一人称的眼睛固定在车体座椅位置（地面上 1.72m，车体中心向后 0.14m），不受步行蹲伏的镜头高度影响。车转弯时镜头随车转动并保留转头偏角；鼠标环视不会改变车辆方向。Alt 环视松开后平滑回到车辆前方。W/S 油门/倒车、A/D 转向、Space 刹车、F 停稳下车，原有车体碰撞和电池规则保留。

## 图片与真实 3D 对应

[设计图](ui-concepts/vehicle-cockpit-20260912/cockpit-concept.png) 用内置 imagegen 生成，参考原游戏的开放式单座悬浮勘探车截图；[完整提示词](ui-concepts/vehicle-cockpit-20260912/prompt.md)。保留窄座椅、前后象牙壳、双侧浮舱、四个反重力盘，新增双握把和中央仪表。图中细节是设计目标，实际游戏材质和手套精度仍简化。

游戏内 `vehicle-cockpit.mjs` 组装的是附属于同一车辆的真实世界空间几何。转头会看到仪表侧面和车身，切第三人称仍是同一仪表；没有用图片铺在屏幕前方伪装驾驶舱。第一人称手套握住实际把手，随转向组件旋转。仪表速度、电量条和 BRAKE/DRIVE/READY 状态读取实际物理数据。驾驶灯固定在车头，避免近距离过曝仪表。

[GLB](../playable/assets/vehicles/survey-skimmer-cockpit-v1.glb) 直接从当前游戏车辆构造器导出，再由本地 Blender 导入保存为 [可编辑源文件](../playable/assets/vehicles/survey-skimmer-cockpit-v1.blend)，包含 DriverEye / Exterior 相机。`source-manifest.json` 记录模型与运行时代码的 SHA-256，自动测试检查同步。GLB 的仪表画面是导出时静态状态，游戏中的仪表由实时画布材质驱动。

重建交付资产：`node tools/export-skimmer-source.cjs`，然后 `D:\blender\blender.exe --background --python tools/save-skimmer-blender.py`。游戏构建：`npm run build`。本轮 aholo 请求和积分支出均为 0。

## 验证

完整规则 277/277 通过。`node tools/verify-vehicle-cockpit.cjs` 在真实离线页面通过：F 取部件和修车/上车、驾驶第一人称、鼠标环视不转车、Alt 回正、W+A 转弯、实时仪表、Space 刹车、V 双向切换、存档恢复、下车恢复步行视角，以及 1440/768/640 下的中文提示和按钮无裁切。页面错误 0。

[实测报告](../artifacts/vehicle-cockpit-20260912/browser-audit.json)；[实际第一人称](../artifacts/vehicle-cockpit-20260912/cockpit-first-person.png)；[同车外观](../artifacts/vehicle-cockpit-20260912/same-vehicle-exterior.png)。已查看真实截图并修正握把遮挡仪表、前臂连接和近距离车灯过曝。

自动回归入口：`npm run test:feature -- cockpit`，覆盖独立驾驶偏好、旧存档兼容、实时仪表和下车恢复。

本轮该专项 36/36 规则、1/1 浏览器通过，前后指纹一致，报告 `playable/test-artifacts/2026-09-12T03-16-17-383Z-12024-cockpit/summary.json`。验证范围为本功能，未重跑完整发布回归。

复测：Ctrl+F5 刷新游戏 → 靠近修好的车按 F → V 切第一人称 → 鼠标看左右和仪表 → W+A/D 开车转弯 → Space 刹停 → V 看同一车辆外观 → F 下车，检查步行视角恢复。
