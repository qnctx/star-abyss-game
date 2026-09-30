# PHASE1-R4 地形微调独立定向验收

结论：本次有限范围 PASS，未发现明确玩法或相机阻断。不是全章重跑，也不是全部美术最终验收。

## 冻结与范围

- 日期：2026-09-16。独立工作树 b067；证据目录 `artifacts/tests/TEST-PHASE1-R4`。
- 产品源：`E:/myProject/star-abyss-game/artifacts/deliveries/PHASE1-R4`，复制至证据目录 frozen；141/141 文件 SHA256 与 manifest 一致，见 integrity.json。
- 用户给定 bundle 标识：`19b29a055653cbe0b8732cd73f9eadfa21c2654c01894f95d038f52f6f64737d`。本测试以逐文件 manifest 校验锁定，不假设未知 bundle 聚合算法。
- 对 R3 的逐文件比较只有 `playable/src/phase1-terrain.mjs` 和编译产物 `playable/game.js` 变化。地形源码 diff 是坡面过渡 .68/1.10 和分南北的主路收窄；其他 manifest 文件一致。
- 读取并继承 601e 工作树 TEST-PHASE1-R3.md 所述既有第一章/AI测试背景，本次没有重新认证全章或战斗。
- 自有服务 127.0.0.1:7588，后台 CUA iab 原生点击、键盘 = 自动前进、V 切换视角、鼠标拖动。没有 hidden appstate、传送、加速、业务注入或存档编辑。未操作 4173/4186，未改主产品。结束已暂停、关闭自有 tab、停止自有服务。

## 原生有限实玩

|步骤|实际观察|证据|
|---|---|---|
|新调查出生 (0,190)，第一人称朝北|正常加载，原角色系统、紫色天空与环星画面保留|01-spawn|
|= 原生步行至 (0,-142)，约332米|主路可行，没有卡住或落地异常|02-north|
|V 第三人称，转向44°、315°、269°|两侧坡面可辨，顶部层状岩体可见；观察视角没有明显穿地或遮掉角色|03-northeast-third、04-northwest-third、05-west-wall|
|转向88°继续真实走至 (142,-147)|跨过东侧坑缘进入坑内，途中(96,-145)也观察到连续地面和坡壁；未遇阻断|06-east-crater|
|坑内转176°向下观察，再266°回望|第三人称角色及地面正常，没有明显相机穿地|07-crater-turn、08-crater-back|

每项证据均有原生PNG和AX文本。HUD坐标为显示的整数，非逐帧轨迹。总原生路线约474米。东侧(145,-150)是坑中心附近，最终视角实际在坑内，不能称为坑缘俯瞰全景。原生测试只证明所走路线和已观察视角，不代表全部边坡、全部岩壁或连续逐帧相机证明。

已查看冻结概念图。当前北段画面依然以圆润、斜坡形的大地形为主，层状岩体较多出现在顶部且占屏较小；坑内能看见包围坡面，细节密度和岩壁尺度不等于概念图。本次不以照片或像素级匹配为门槛，也不把几何PASS写成图模质量全部PASS。已观察1280×720中文HUD、视角按钮和暂停界面无明显裁切、遮盖或不可点击。

## 独立 Node 检查（不是实玩）

- `terrain-route-audit.mjs` 直接导入冻结 R4 的 terrainHeight/collides/camera 模块：主线关键折线路径2273个点，地形高度绝对值最大0，开门状态的碰撞阻断0。门开状态只用于静态路线检查，不验证剧情开门。
- 返回信标、信号、破口、电芯、供电、记录、三中继和黑匣子共10个平台，中心±2米、0.5米间距采样，全部高度0。
- 9个主路纵向位置 × 3个横向位置 × 36个角度，共972条相机boom采样；结果cameraBlocked为0，最小地形净空约1.753米。这是预设boom静态查询，不替代真实第三人称所有俯仰角。
- `outcrop-r4-audit.mjs` 基于用户指定 SCOPE-PREP 审计脚本，改为 frozen R4 导入，并增加每个有效岩面样本的向下相机 sweep 检查。Three.js使用主目录已有依赖，只读，不改产品。
- 7个分层岩体4249–4255，共6469个可见网格垂直射线命中；渲染交点与 rockSurfaceHeight 最大误差0.001049米，超0.002米失败0。地面上方有效岩面检查相机挡点、向下sweep、角色碰撞均无漏挡；每岩24个横向光学射线样本未发现可见网格命中而LOS放行。
- 岩体顶点采用实际R4 terrainHeight的新基面生成，独立对照可见Three网格；不是沿用R3 JSON结论。数据见 outcrop-r4-audit.json 与 terrain-route-audit.json。

## 复查步骤和交付

1. 在本工作树运行 `node artifacts/tests/TEST-PHASE1-R4/serve.cjs`，用新7588测试档开始，=沿北走约332米，=停步，V切第三人称，拖动观察两侧；朝东走约142米，停下转身检查坑内。
2. 运行 `node artifacts/tests/TEST-PHASE1-R4/terrain-route-audit.mjs`。
3. 岩体审计需 three；运行前在证据目录建立指向 `E:/myProject/star-abyss-game/node_modules` 的 node_modules junction，运行 `node artifacts/tests/TEST-PHASE1-R4/outcrop-r4-audit.mjs`，结束只移除该junction。本次临时junction已清理。
4. `evidence-sha256.json` 锁定报告与非 frozen 证据，排除自身；frozen由manifest/完整性记录锁定。未提交git，未改其他项目文档或产品。
