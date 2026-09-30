# 本地测试服务恢复

2026-09-17：用户报告 ERR_CONNECTION_REFUSED；实际 HTTP 探测确认 4173 未监听。启动正式项目 E:/myProject/star-abyss-game 的静态服务后，test-lab.html 返回 HTTP 200，内置浏览器重新加载原游戏标签成功。

`node tools/start-local-preview.cjs` 会先探测现有服务，健康时不启动第二个进程；服务关闭时使用独立、隐藏的后台 Node 进程启动。日志与 PID 位于正式项目 artifacts/local-preview。此启动方式不修改系统开机设置；电脑重启后仍需启动服务。

验证步骤：运行启动命令；打开 http://127.0.0.1:4173/test-lab.html；等待外勤模型载入，确认元婴 R4 与 F2 实验室可操作。再次运行启动命令应显示 already healthy，不产生重复服务。

本轮七模型已经用户明确授权，任务分为苏禾/台/瓶三项与 N01/N03/N04/N05 四项；以各组持久化任务记录恢复，禁止因下载或浏览器异常重复生成。

已安装双击启动入口 `E:/myProject/star-abyss-game/start-test-lab.cmd`。七项均已生成下载；独立离线预览全部载入成功，七项旋转/缩放验证通过，无外部网络请求和浏览器错误。证据：reports/seven-models/preview-qa/report.json。游戏内验收与离线模型验收分别记录。
