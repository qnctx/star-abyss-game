# 武技视觉候选01

仅CPU候选，整个目录以.gdignore隔离。复用已批准reference.png C行与impact-reference.png A行，没有新增生成费用，也没有替换生产库或触发Godot导入。

本片包含break/cancel/descent/descent_cancel/landing地空10段，使用原C2 51骨架，动画GLB无mesh。候选加强地面蓄力下沉、双掌空间和髋肩驱动；下砸用20度pelvis与35度脊柱局部旋转驱动（不能直接视为屏幕55度），非对称收膝，先交叉前臂后右手推进/左臂平衡。charge细流从肘外侧空间收向掌间节点；pressure仍为短曲面前锋，特效没有碰撞权威。

结构审计在cpu-structure-audit.json；源变更后必须重build并更新hash。preview为Cycles CPU辅助姿态研究，第一批采样定位为源姿态缺陷，已保存在preview-first；第二批相对手部/接触姿态正复核，不能作为游戏默认相机或正常速度验收。独立审查报告将指出缺口。新增专属descent_cancel起点复用held descent pose，尚未接入生产的取消路由。下砸取消仍需按真实中断时刻验证回航；现有生产通用cancel属于双掌收气，不能用它代替专属坠姿回航。

下一视觉验证：在独占窗口，以候选加载测试接入真实C2/实际R输入，保留生产路径；默认相机正常速度记录蓄力聚气→双掌释放→恢复、俯冲收膝→真实触地→缓冲起身与空中取消回航。辅助侧视须远离树冠/岩片遮挡。轻量physics observer逐帧采样，渲染采样与physics帧间隔分开记录，检查pose与效果起源同步、身体无穿插、中文HUD完整。未验证前不得晋升到生产。
