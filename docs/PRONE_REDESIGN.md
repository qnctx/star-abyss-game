# 趴卧动作与下车转向 · 2026-09-12

## 动作与对应 3D

采用腹部低位、弯肘支撑、左右手与对侧腿交替推进的低姿爬行关系。参考 [FM 7-22](https://www.armyresilience.army.mil/ard/images/pdf/Policy/FM%207-22%20Army%20Physical%20Readiness%20Training%20.pdf) 与 [STP 21-1-SMCT](https://www.first.army.mil/Portals/102/STP%2021-1-SMCT.pdf)。这是针对现有角色制作的骨骼动画，不是动作捕捉。

- 趴下/起身各约 0.9 秒，经过低蹲再展开身体，避免直接把站立模型放平。
- 原生 C2 的 19 根骨骼通过双关节求解保持实际臂长、腿长，手肘向外弯、靴子向后；修正脚踝扭转。
- 原资产握拳不适合支撑，增加五指张开的手套几何并绑定原生手腕；趴姿隐藏旧拳部。当前手指是静态弯曲几何，没有独立手指动画。
- 第一人称使用原生头部的眼点，平地静止时约高 0.386 米、位于骨盆前 0.782 米；隐藏遮挡视线的头盔内侧。取出扫描器时由持物手臂替代趴姿身体显示，避免重复手臂。
- 第三人称趴姿拉近到 3.2 米，并抬高观察位置。灯移到头部前方，避免灯光穿过肘部。

同一运行时姿态导出 [GLB](../playable/assets/animations/prone-v2/c2-prone-v2.glb) 和 [Blender 源文件](../playable/assets/animations/prone-v2/c2-prone-v2.blend)，含 `ProneDown / ProneIdle / ProneCrawl / ProneUp` 四段动画。清单记录模型、动作、重定向与手部构造源文件哈希；导出时也移除旧拳面，保留新手套。本轮 aholo 支出为 0。

重建：`node tools/export-prone-motion.cjs`，再执行 `D:\blender\blender.exe --background --python tools/save-prone-blender.py`。模型质量仍受现有 C2 资产限制；目前没有逐肘、逐膝的复杂斜坡地形 IK。

## 下车修复

驾驶环视后，旧逻辑把身体转回车头，却保留独立观察方向；普通鼠标同时旋转二者，偏差一直存在，按 Alt 回正才消失。现在退出车辆立即清除自由环视/回正状态，并将身体对齐当前观察方向。后续步行、疾跑可以直接鼠标转弯。

## 验证与复测

完整 Node 规则 281/281 通过；构建成功。实际页面脚本 `tools/verify-prone-redesign.cjs` 验证 Z 趴下/起身、V 双视角、W 爬行、第三人称驾驶环视后 F 下车并直接 W+Shift+鼠标转向，全程不按 Alt。第一人称驾驶的同类回归接入 `vehicle-cockpit.spec.js`。

截图：[第三人称侧面](../artifacts/prone-redesign-20260912/prone-side.png)、[第一人称低头](../artifacts/prone-redesign-20260912/first-person-look-down.png)、[爬行](../artifacts/prone-redesign-20260912/crawl.png)。实机记录：[browser-audit.json](../artifacts/prone-redesign-20260912/browser-audit.json)。

手动复测：

1. 刷新页面，按 Z 趴下，按 V 切换两种视角，鼠标上下查看，按 W 爬行，再按 Z 起身。
2. 趴下按 Q，检查扫描器取出和收回时没有重复手臂。
3. 上车后向侧面看，按 F 下车，直接 W/Shift+W 配合鼠标转弯；第一、第三人称驾驶各测试一次，不按 Alt。

本次是定向功能回归，未重新执行完整发布门禁，未部署。

最终专项门禁：15/15 规则、2/2 浏览器通过，构建与执行前后指纹一致，详见 [summary.json](../playable/test-artifacts/2026-09-12T03-47-43-739Z-10872-prone/summary.json)。
