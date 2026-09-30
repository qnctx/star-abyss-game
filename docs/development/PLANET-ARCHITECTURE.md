# 星球架构接口 v1

## R3 高海拔地面就绪与上界

冻结目录 `artifacts/planet-architecture-r3`；生产增量为chunks、scene-adapter、field三个模块，R1/R2冻结保持不变。

`selectChunks`新增 `surfaceRadius=radius`（相机当地地表半径）、`segments=32`、`groundSpacing=20`、`groundRange=100`。适配器自动传 `radius+field.sample(camera).height`。距地面100m内先预留相机脚下块到20m名义网格精度，然后用余下同一个192块预算细化视野，避免海拔3509m被错误当成离地3509m。需要的脚下层级为ceil(log2(2*max(radius,surfaceRadius)/(segments*groundSpacing)))。显式过小maxLevel或maxChunks仍会限制精度，不能承诺不可能的预算；默认配置足够。

32m位置量化仍保留，但近地进入粗块时即时重选，不等待跨过32m。`sampleRenderedSurface`改为cubeUV直接确定活动块和真实Float32网格三角、与三角平面求交；不再依赖Raycaster对精确网格顶点/极点的边缘判定。查询仍不包含裙边/水面，`raycastSurface`通用射线API保留。

`field.maxSurfaceHeight`为数学保守地形海拔上界；有任意legacyHeight但未声明上界时返回null。新参数 `legacyMaxHeight` 表示调用者已经证明的旧平面Y上界。原程序噪声≤5085m，隆升≤999m、河谷≤520m、海床≤-205m，混合均为凸组合；旧区域|tx|,|tz|<blendEnd，因此最终上界为 `max(5085,(radius+legacyMaxHeight)*sqrt(1+2*(blendEnd/radius)^2)-radius)`。总控证明旧高度≤310m时可传310，120km半径综合上界仍5085m。未知函数不可推测上界，也不可把null转换为0开启高空快速路径。此上界仅限地形，岩壁/建筑/生态等solid仍须单独检查。

R3验证15/15 Node通过：256全球方向脚下名义间距≤20m且六面完整覆盖、≤192活动块；背面3509.852m、双极、近极、立方体角点6处实际mesh均ready，间距1.831–14.648m、缓存≤384，并验证0.1m微移。真实WebGL背面山地和南极地面均ready、零脚本/着色器错误。旧盆地、大陆、路线和水文回归仍通过。不同方向照明未重做，背面截图较暗；此修复不是完整球面行走/相机的原生验收。

## R2 大陆与高空遮罩修正

R1原始文件和证据已只读归档在 `artifacts/planet-architecture-r1`；R2精确冻结在 `artifacts/planet-architecture-r2`。不修改总控接线。

R2加入以盆地西侧为中心、约85km东西/72km南北半轴的有机大陆隆升场；其边缘受地质噪声调制，并用公里级平滑函数连接原全球地貌。盆地外的荒凉地貌权重改为径向渐变，不将6km方形存档/网格所有权边界用作大陆海岸。东侧35km附近为弯曲海岸，55–85km为宽阔海域，首河谷继续顺坡入海。

新增 `planetTerrain.setLegacyMaskEnabled(bool)` 与 `legacyMaskEnabled` getter。创建时仍传 `legacyMaskHalfSize:3000`。高空host在同帧隐藏旧ground并调用false；低空恢复旧ground并调用true。切换仅更新共享shader uniform，不重建块或重新编译shader；CPU射线和sampleRenderedSurface同步切换，禁用后盆地也由当前球面三角提供支撑。高度阈值和相机接线由总控决定。

R2测试：12/12 Node PASS；3721旧盆地高度回归保留；北/南/西40km×60km采样区域（去除旧盆地附近）2462点干地，最低79.44m；6km半径环形采样为干地；东55–85km、侧向±15km共169点水深超过100m。首路线最大坡度仍5.51°，水文下降和生态标记回归通过。WebGL使用真实主项目legacyTerrainHeight，分别输出global、33km盆地上空和地面视图，无脚本/着色器错误。未完成原游戏原生路线全程验收。

独立工作区：`C:/Users/HUAWEI/.codex/worktrees/7eee/star-abyss-game`。入口 `playable/src/planet/index.mjs`。未修改主项目、未发布4173。概念依据为美术任务 d343 的 `docs/art/planet-v1/surface-transition-concept.png`，本模块只交付地形、水面与数据架构，树木/芦苇/纹理由对应美术模块整合。

## 坐标与存档

- 默认 `{id:'star-abyss',seed:'star-abyss-planet-v1',radius:120000,version:1}`；米制工程半径，可配置，不是地球尺度。
- 球心 `{x,y,z}` 使用 JS double。Y北极，经度正向 **-Z**，确保 east/up/south 构成 Three.js 右手基底。lat/lon弧度，height径向海拔米。
- `toCartesian({lat,lon,height},radius)` / `toGeodetic(position,radius)`；不要在接线处另写经纬度公式。
- `tangentFrame(lat=0,lon=0,radius)` 返回 origin/up/east/south。`localToGlobal` / `globalToLocal` 精确转换旧盆地笛卡尔坐标，包括旧 y。
- `createFloatingOrigin({origin,threshold:2048,grid:256})` 仅改变渲染坐标，update返回origin/delta/revision；业务位置不可减原点后写存档。
- `attachPlanetPosition(save,p)` 在旧存档上增 planet，保留旧version/story/player等及planet.gameplay；拒绝不同id/seed/radius/version已有planet。`readPlanetPosition`读取球心位置或无planet时迁移旧player。

## 地貌与路线

`createPlanetField({planet,legacyHeight,legacyHalfSize:3000,blendEnd:4000})`：

- `sample(direction)`：height/moisture/temperature/river/legacyWeight/biomes/waterHeight/waterDepth。
- `sampleSurface(direction)` 另含坡度 `slope`（弧度，2m中心差分）。批量碰撞优先sample或实际渲染采样，不要每次求坡度。
- direction可以是任意非零球心向量；所有高度LOD均调用同一地貌场。
- biomes为basin/plains/mountains/forest/wetland/river/coast/ocean/cliff九个归一连续权重。
- waterHeight为数值或null；null表示无水，waterDepth非负。完整旧盆地强制无水，即使原地形y小于0。
- `surfacePoint(direction)`返回球心地表位置。旧地表沿射线迭代解切平面高度，±3000m方区精确保留，4000m完成过渡。必须注入未扩展的旧terrainHeight，避免递归。
- `routeDirection(distance,crossOffset=0)`：首条东向河谷，距离为米；`routeLandmarks`给ID、距离、canonical position。
- 首纵切：平原8km、森林17km、湿地27km、海岸34km、海洋42km。通过宽1.8km核心/9km渐变宽度的连续高度、湿度与权重曲线形成，并非传送区域。
- 河槽位于路线侧向320m，自6.5km高地沿连续下降水面流至35km海口。程序水面表现没有流体模拟；其他全球噪声river字段不是完整水系模拟。

## 分块及渲染接线

`selectChunks(cameraGlobal,{radius,maxLevel:12,maxChunks:192,splitFactor:2.5})` 返回完整六面覆盖叶块 `{face,level,x,y}`，预算不足保留父块。`buildChunk`生成局部Float32顶点和double center；surfaceIndexCount不含裙边。`directionToCube`用于定位面和UV。

`createChunkCache({load,dispose,capacity:384})`同步构建新集合后原子替换；构建失败保留旧覆盖，LRU淘汰非活跃块，destroy释放资源。需要worker异步加载时应在外部实现作业队列，不可把Promise传给load。

```js
const field=createPlanetField({legacyHeight:legacyTerrainHeight});
const planetTerrain=createPlanetTerrain({THREE,scene,field,
  renderFrame:tangentFrame(),autoRebase:false,legacyMaskHalfSize:3000});
const result=planetTerrain.update(cameraCanonical);
camera.position.set(result.cameraRender.x,result.cameraRender.y,result.cameraRender.z);
camera.up.set(result.upRender.x,result.upRender.y,result.upRender.z);
camera.near=result.recommendedNear;camera.far=result.recommendedFar;
camera.updateProjectionMatrix();
```

默认固定旧盆地基底与原点，旧游戏物体无需改坐标。开启autoRebase前，host必须同步平移旧场景/生态/相机并处理delta，否则会错位。相机朝向由host控制，update不夺取旧相机控制器。

legacyMaskHalfSize只裁新球面在旧平面覆盖的正面方区，背面不裁；原PlaneGeometry保留为该区域唯一可见地表。mask要求使用适配器自有材质。原装饰远山应由host移除/隐藏。不得让旧PlaneGeometry与未mask的球面一起出现。

真实海洋/河流水面为各块子网格，位置由waterHeight决定，干地使用waterDepth着色器裁切；与地形碰撞分开。默认32segments，低空约192块；坡面裙边覆盖LOD裂口，不作为地面支撑。此版本无地形geomorph；切LOD可能产生跳变，需要集成实机验收。

`sampleRenderedSurface(canonical)` 返回当前实际三角height/position/spacing/ready/source及字段；用cube face定位一个活动mesh射线，不遍历全部192块。legacy返回原精确地面。`isReady(canonical,maxSpacing=20)`检查实际支撑与精度。高空飞行不应要求高精地面块，但降落前必须检查；ready=true单独只意味着已有三角，不意味着精度达标。

LOD选择每相机移动32m刷新，缓存避免每帧重建。构建仍在调用线程执行；预算、性能和异步worker是集成后续优化点。不要以字段可采样替代已加载地面碰撞状态。

## 验证

在本工作区执行：

1. `node --test playable/tests/planet-architecture.test.mjs playable/tests/planet-integration.test.mjs`
2. `node tools/planet-webgl-check.cjs`

集成测试和WebGL工具从 `PLANET_BASELINE`（默认E:/myProject/star-abyss-game）只读加载真实R4 terrainHeight、Three.js和Playwright/esbuild依赖。未复制或修改主项目源码。独立架构测试不依赖该路径。

11/11 Node通过，真实旧盆地3721点误差小于0.1mm；4–35km路面每25m采样最高5.51°且不入水；6.5–35km河水单调下降且河槽有水；全部路线生态标记主类型正确。另验证极点/经度缝/高空往返、种子确定性、六面LOD全覆盖、朝外法线、缓存失败回滚、存档扩展保留以及Three实际三角射线。

WebGL无pageerror/console error，orbit/ground截图在artifacts/planet-architecture。orbit约194670绘制三角、ground约162097（依当前视锥，不是全部常驻数），不是FPS性能承诺。浏览器检查为独立地形画面，不是原生完整玩法验收。近景仍是程序地形底层；概念图品质的生态、雾、细节纹理及旧紫色星空/环星由总控整合，不能将截图作为最终美术交付。
