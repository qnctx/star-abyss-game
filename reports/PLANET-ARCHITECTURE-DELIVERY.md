# 星球架构独立交付

工作区：C:/Users/HUAWEI/.codex/worktrees/7eee/star-abyss-game。

完成球面/旧地表坐标、种子连续字段、首条顺坡河谷路线、九生态权重、水面、六面LOD分块、缓存回滚/释放、浮动原点和存档增量适配。提供可挂Three.scene的接口，以及实际渲染三角支撑查询。未修改主项目脏文件或4173入口。

精确生产文件仅 `playable/src/planet/{coordinates,field,chunks,scene-adapter,index}.mjs`。测试两份，工具两份（WebGL检查与冻结），文档本报告及 `docs/development/PLANET-ARCHITECTURE.md`。交付manifest内含每个文件SHA256、基线SHA和路线实值。

验证命令、接口约定和风险详见上述接口文档。最终11/11 Node PASS；独立Chromium WebGL零脚本/着色器错误；已查看orbit/ground实际截图，修复裙边法线与高空相机深度精度问题。

边界：未做主项目全任务/载具/存档原生回归；当前同步chunk构建需要实机预算评估；LOD无geomorph；河流首纵切有下游关系，非全球水文模拟；地貌视觉底层不是概念图最终品质。总控必须接入生态、美术和近地碰撞ready门控，并保持旧PlaneGeometry方区mask、相机裁剪面和原点同步。
