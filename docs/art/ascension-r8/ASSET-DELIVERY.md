# 六境效果资产交付

源图 `ascension-reference.png` 已在建模前审看，原图未修改。依图制作六种不同结构：渐细螺旋气带、层叠尖月牙、碎晶孔、铭刻断续金属门、分叉裂隙和多层断月界门；没有使用 torus 原始圆环作成品。

| 资产 | 三角形 | 材质/绘制批 | GLB字节 |
| --- | ---: | ---: | ---: |
| qi-boost | 592 | 1 | 47,492 |
| aerial-crescent | 1,588 | 1 | 70,148 |
| blink-aperture | 1,850 | 4 | 95,348 |
| domain-gate | 4,796 | 3 | 219,000 |
| void-fracture | 572 | 3 | 47,020 |
| dao-gate | 8,928 | 3 | 420,752 |
| 合计 | 18,326 | 15 | 899,760 |

## 文件与坐标

`playable/assets/ascension-r8/` 每种资产都有独立可编辑 `.blend` 和游戏 `.glb`。原生文件保留命名部件（刻纹、切面晶体、发光沟槽、边框、丝带等）；GLB按材质合并网格，PBR材质内嵌，无外部纹理。`manifest.json` 给出尺寸、边界、材质名称和预算。

所有运行时单位为米、Y向上、门/刃正Z为法向，几何围绕效果原点展开；气带沿Y环绕角色，气刃原点是弧线曲率中心，保持适合旋转挥斩的枢轴。瞬移孔交付单孔资产，起点和终点分别实例化同一GLB即可组成参考图双孔，不重复上传两份相同几何。

源资产不含灯光、碰撞、伤害或传送语义。集成时禁用投射/接收阴影，复用实例并限制并发；发光材质本身不需要动态灯光。第一人称是否隐藏气带以及屏幕中心避让由运行时控制。模型透明空隙是真实几何空隙；不是不透明的整面门板。

## 复现与验证

1. `D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/ascension-r8/build_assets.py`。
2. `D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/ascension-r8/render_verify.py`。强制Cycles CPU，逐一重新导入GLB，断言有限顶点、无零面积三角、统计与manifest一致、单asset最多4材质批。
3. 合照为 `ascension-assets-sheet.png`；六张单图以资产名命名。模型本身不依赖预览灯光。验证数值记录在 `verification.json`。

制作阶段完成参考对照、CPU重导入和模型渲染；集成阶段已通过实际 GLB 加载、权威时钟/目标位置测试，以及第三人称加速气流、星劫/道源空战和宽窄屏图鉴的独立浏览器检查。模型制作未调用付费 API；最终玩法与范围见六境设计文档。未声称完成全场景性能跑分。
