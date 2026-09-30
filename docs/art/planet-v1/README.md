# 星球生态与地表美术 v1

2026-09-16。独立工作区：`C:/Users/HUAWEI/.codex/worktrees/d343/star-abyss-game`。

## 真实图像与范围

- `planet-ecology-concept.png`：使用内置 imagegen 实际生成的完整星球生态概念图，含球体和大陆示意。
- `surface-transition-concept.png`：使用内置 imagegen 实际生成的区域水系总览及四处地面观察参考。
- `asset-preview.png`：实际 Three.js 独立资产预览，程序生成分枝树、折叶树冠、芦苇及卵石网格。不是游戏画面。
- `PROMPTS.json`：两次生成的完整提示词、原始输出路径；未调用付费 Lux 任务。

概念图不是高度图或地形数据。大陆图和球体仅视觉关联，不保证投影逐像素一致；示意比例尺不可量测。完整生态分布具有山系、雨影、内陆盆地、流域、海岸和海洋；图中高山浅色可解释为裸岩，当前没有新增积雪资产。四个地面观察格代表相距多公里的地点，不是围绕一个池塘的相邻布景。

## 与统一世界接口的约定

采用总控 seed=`star-abyss-planet-v1`、默认 radius=120000m（可配置）；Y 为北极，球心坐标 double 米，lat/lon 为弧度。美术模块不另建坐标系统、不生成高度、不设置随机世界种子。盆地 ±3000m 原样保留，4000m 前完成架构过渡；本模块对所有 `legacyWeight>0` 地点禁放新增实例，避免破坏旧区域。

`sampleSurface(direction)` 的 biomes 使用 basin/plains/mountains/forest/wetland/river/coast/ocean/cliff 连续归一权重；slope 单位为弧度。`placePlanetArt` 调用 `surfacePoint` 后减同一渲染 origin，模型 Y 轴对齐球面径向。非球面岩壁需要贴壁资产时应另给局部法线，当前三类不贴陡壁。

## 3D 对应表

| 概念参考 | 3D 与材质 | 实际交付 | 集成职责 |
|---|---|---|---|
| 原紫色盆地、图01层岩 | 继承主项目 phase1-geology 的真实玄武岩贴图和网格 | 没有复制或修改旧岩层实现 | 地形任务保留旧三角面高度/碰撞 |
| 图02平原、远山 | plains/mountains/cliff 连续线性色彩及粗糙度 | `sampleArtMaterial` 9生态材质配置 | 主地形顶点/片元混合，不能逐chunk硬切材质 |
| 图03分枝树、根、树冠 | 弯曲渐细管截面、五向板根、12分枝、1920独立折叶 | tree 实例网格，LOD0 4420三角 | 注册返回的主干碰撞胶囊；枝冠为视觉、不得攀爬承重 |
| 图03河岸卵石 | 7颗不规则扁圆闭合石体 | pebble 实例网格，LOD0 630三角 | 仅碎石细节；地表支撑来自权威地形 |
| 图04湿地芦苇 | 18根弯曲茎、侧叶、穗 | reed 实例网格，LOD0 846三角 | 无碰撞；依权威水深0..0.35m分布 |
| 河流、海洋 | river/ocean 色与粗糙度是美术建议 | 无额外水面网格，避免和地形水文冲突 | 地形任务实现一致水面、水深、海岸线 |

资产为首版风格化程序网格，轮廓和构成按图，未宣称照片级或逐像素匹配。无新栅格PBR贴图；树叶使用真实几何，不依赖透明排序。近处仍可见叶片与卵石多边形，树冠不具概念图的照片级细节。

## 连续过渡与距离规则

1. 原盆地只占内陆一部分，盆缘出露岩逐渐变碎砾、粉土、稀草、连续草地；不能用颜色矩形划界。盆地旧玩法清场优先。
2. 建议盆缘至平原用1..3km过渡，平原至山麓/疏林用2..5km，疏林至河谷林用1..4km，湿地内陆边界0.5..2km。它们是可调美术宽度，不覆盖架构最终里程。
3. 河源在山地，支流汇入主河后经过冲积平原与河口；内陆盆地若是封闭流域不要凭概念图强行穿山引水。必须以生成器实际高度和流向检查为准。
4. 森林随湿度、坡度和距河距离连续增密；树最大坡度0.55rad且水深必须0；湿地芦苇最大坡度0.18rad，水深0..0.35m；海岸卵石最大坡度0.65rad，水深0..0.2m。
5. 湿地形成于低坡、汇水和河口低地，非每条地貌边界都有一圈沼泽。沙/泥滩接潮间带、浅海陆架、深海；海岸岩壁保留同一基岩连续性。
6. 相邻大区域主体必须在地面受地形曲率、山脊和大气遮挡，不能靠很近的雾墙隐藏小场景。高空总览显示同一流域，不换独立地图。
7. 候选点由稳定全局cell生成；建议最小间距树7m、芦苇丛1.5m、卵石组2m。按连续生态权重概率接受，不能使用逐帧随机数。跨cell去重、最小间距及种子派生由host负责。

## 集成示例

```js
import {placePlanetArt,createPlanetArtBatch} from './planet-art/index.mjs';
const {records,colliders}=placePlanetArt({
  kind:'tree',field,candidates,origin,
  getWaterDepthM:(direction,sample)=>waterField.depthAt(direction,sample)
});
const batch=createPlanetArtBatch(THREE,{kind:'tree',records,seed:cellSeed,lod:0});
scene.add(batch.mesh);
// host: register colliders in its world-space collision registry before enabling movement.
// host: on origin shift rebuild matrices from stable world data; do not mutate saved coordinates.
// host: on cell retirement remove mesh, unregister colliders, then batch.dispose().
```

候选项 `{id:安全整数,direction:{x,y,z}}`，id跨运行稳定；返回 records 包含局部position、单位up、scale和yaw。树干colliders为球心double位置，radiusM/heightM缩放一致。树根和高枝不包括在主干胶囊内，地面应留根部足够避让；需要精确树根碰撞时由host增加简化根部碰撞。水深回调必须真实存在；缺水文数据不要把默认0当已验证可种植地。

调用方实施视距LOD与剔除：树90/260m，芦苇45/120m，碎石40/100m；当前模块提供lod0/1几何，未内置调度/淡入。远森林用地表色/后续林冠LOD，不在高空绘制全部独立叶片。每类每seed每LOD一个InstancedMesh，每个batch独立拥有资源。材质可用于生成顶点色；不要拿一套uniform平均色代表整个跨生态chunk。

## 验证

从此工作区运行（依赖路径参数可换成本地完整checkout）：

```bat
node docs/art/planet-v1/run-tests.cjs E:/myProject/star-abyss-game
node docs/art/planet-v1/verify-preview.cjs E:/myProject/star-abyss-game
```

测试验证有限顶点/法线、确定性、LOD减面、球面朝向、实例边界、资源释放、旧盆地排除、水深拒绝、浮动原点减法和材质权重。独立预览使用临时loopback端口，运行后自动关闭，无需4173；截图与JSON输出保存本目录。查看截图确认中文未裁切、三个资产类别可辨识。实际游戏探索、世界流式与原生角色碰撞尚待总控集成验收。
