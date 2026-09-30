# 地表材质 R1 冻结交付

唯一新增运行时代码：`C:/Users/HUAWEI/.codex/worktrees/d343/star-abyss-game/playable/src/planet-art/surface-material.mjs`

SHA256：`10c4cc0b7f4b15e0ccf4a3103941de27bc269abd2812ef2ce95291c42a52ed42`

基于已有 surface-transition-concept.png，未生成新图、未调用付费3D。保留现有顶点生态色，增加40m、3.125m、0.417m级3D连续低对比草土/砂砾斑驳与轻微导数法线。距离与屏幕像素足迹共同衰减；微粒65m、土壤420m后消失，宏观斑驳5km后消失。无新增纹理、draw call或位移。不能替代地形起伏、地表草丛或照片级PBR。

## 接线

scene-adapter import `enhancePlanetSurfaceMaterial`，在现有 `if(legacyMaskHalfSize){...}` 遮罩hook安装块结束后、`function load(c)` 前添加：

```js
enhancePlanetSurfaceMaterial(material);
```

不要把新材质作为 external material 传入启用legacyMask的adapter；会触发adapter已有ownedMaterial检查。增强器先执行已安装的onBeforeCompile，再添加细节；原mask uniform和discard代码保留，cacheKey追加版本且重复增强幂等。

要求每块地面有 `planetLegacyXZ` vec3。当前adapter在legacyMaskHalfSize>0时创建此属性；之后只禁用mask仍保留属性，可继续使用。无该属性时不应调用增强器，或由host给稳定同一坐标系属性。采样属性的xzy，完全不依赖mesh.position、camera或render origin，因此rebase不滑动。仅增强地面，勿施于水面或树。

## 验证

命令：`node docs/art/planet-v1/verify-surface.cjs E:/myProject/star-abyss-game`

真实headless WebGL两套程序编译PASS，无console/page错误；旧mask hook执行2次（原版与增强各一次），增强cacheKey为 `test-existing-mask|planet-surface-v1`。重复增强保持同一hook。截图检查近景有低对比斑驳、远景无高频细点，启用mask后双方同区域正确丢弃。

命令：`fc /b docs\art\planet-v1\surface-near.png docs\art\planet-v1\surface-rebase.png`

平移mesh和相机1024m后的截图逐字节相同。独立测试不是实际游戏或跨球体全场景回归；不同GPU的数值表现及集成后场景仍由总控最终验证。

辅助文件均在本报告目录：surface-preview.html、verify-surface.cjs、surface-validation.json、surface-near.png、surface-rebase.png、surface-mask.png、surface-far.png。没有修改旧manifest以免影响先前交付冻结。未修改地形、碰撞、树mesh、sharedsource或主项目；未发布4173。
