# 全球地图独立交付

工作区C:/Users/HUAWEI/.codex/worktrees/7eee/star-abyss-game。生产只新增playable/src/planet-map.mjs；main/ui/旧盆地地图均未改。

同源地貌格网SVG、全球经纬度、玩家/营地/4勘测/停车点、球面距离和bearing、可选目标数据已实现。图标错开有引线；中文列表模型完整。点击返回导航目标，不传送，不变更玩家/进度；背面停车位置保持canonical坐标。

6/6 Node测试通过；桌面/390px浏览器点击闭环通过，零页面错误；中文按钮无溢出/裁字，列表可滚动。已查看desktop.png与mobile.png。API接线详见docs/development/PLANET-MAP.md；源、测试、工具及SHA见artifacts/planet-map-v1/manifest.json。

边界：底图为120×60低分辨率生态图，窄河流可能在底图采样中不明显；不能当精密局部导航地图，旧盆地地图需由host保留。地图本身不持久化目标或写入UI，host负责导航目标保存和旧/新地图切换。球面方位在同点/对跖/精确极点返回null，host显示未定义，不能格式化成0°。
