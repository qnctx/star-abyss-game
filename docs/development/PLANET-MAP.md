# 全球地图模块 v1

独立新增 `playable/src/planet-map.mjs`。依赖现有 `planet/coordinates.mjs`；不修改main、ui或旧盆地地图。底图来自同一个field.sample，地图不生成3D、不传送或改写玩家/载具/进度。

```js
import {createPlanetMap} from './planet-map.mjs';
const map=createPlanetMap({field});
const state={position:playerCanonical,
  vehicle:parkedVehicle?{position:parkedVehicleCanonical,parked:true}:null,
  progression:{surveys:['plains']}};
const {svg,model}=map.render(state);
// 由host将svg放入专属容器，并将model.legend绘制为可滚动响应式列表。
const target=map.select('survey:forest',state);
// target仅导航数据；保存或设置导航由host负责。
```

构造参数：`field`必传；`camp`可覆盖营地canonical位置；width=960,height=480,columns=120,rows=60。默认营地从旧局部(0,0,196)变换到球心再按field投地。四勘测来自field.routeLandmarks的plains/forest/wetland/coast真实位置；缺少真实路标抛错，不生成假坐标。

所有position均为球心double米制{x,y,z}；vehicle必须是`{position:canonical,parked?:boolean}`，parked=false隐藏停车点。不能直接传旧{x,z}。progression.surveys是已完成生态ID数组，仅用于展示，不推进进度。

`render(state)`返回安全自生成svg与model。底图在构造时以7,200个全球经纬度格中心采样并缓存，每次render只更新标记。模型包含：

- player：lat/lon弧度、height米、latitudeDegrees/longitudeDegrees。
- markers：player/camp/四survey/可选vehicle，真实投影x/y、错开后的displayX/displayY、距离和方位。密集标记不重叠，用引线保留真实地理位置。
- legend：`{id,label,number,symbol,position,distance,bearing,completed}`。勘测number为1–4，其他为null。distance米，bearing为从北顺时针初始大圆方位角度；同点、对跖点、精确极点初始方位为null。

`select(id,state)`返回 `{id,name,label,kind,position,lat,lon,height,distance,bearing}` 或null。玩家标记不可选。已知营地/停车点保留原canonical位置（包括高度），不擅自降到地表。

`pick({x,y},state,{hitRadius=10})`：输入为SVG viewBox坐标，优先选择命中标记，否则对经纬度反投影并调用field.surfacePoint返回真实地表目标。经度左右边缘周期相邻，背面不会与盆地重影。

```js
const point=new DOMPoint(event.clientX,event.clientY)
  .matrixTransform(svgElement.getScreenCTM().inverse());
const target=map.pick(point,state);
```

SVG标记带`data-target`和role/button/tabindex；host可以直接按事件目标调用select，并处理Enter/Space。完整中文列表由host负责：地图在手机上缩小时图标小，列表必须提供等价的可点击目标入口。此模块不向现有界面注入DOM，不接管旧地图键盘。

公共数学API：`projectPlanet(position,{radius,width,height})`、`unprojectPlanet({x,y},options)`（返回单位球心方向）、`sphericalNavigation(from,to,radius)`。等距圆柱投影，上北下南，横向经度[-180,180)，纵向纬度[90,-90]。用atan2球面角计算距离，避免平面oldXZ投影造成背面重影。

验证：`node --test playable/tests/planet-map.test.mjs`，6/6；`node tools/planet-map-browser-check.cjs`，桌面1100px与手机390px实际Chromium点击森林、背面停车点、海岸均返回正确目标，state保持不变，零pageerror，无横向溢出或按钮文字裁切。截图和browser.json在artifacts/planet-map-v1。独立演示不等于总控完整游戏UI验收。
