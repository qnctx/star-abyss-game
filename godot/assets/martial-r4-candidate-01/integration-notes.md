# 接线候选与未验范围

生产保持冻结；此目录.gdignore仍在，新GDScript/shader未parse/import。native_vfx_martial_candidate.gd只对charge/pressure用候选曲面，其余资源仍显式复用生产。早蓄力仅压缩纵向/深度，保持外侧细流横向范围，避免整体.45缩回背部轮廓；取消时shader反转流向。该形状仍锚双掌中点，尚不是分别跟踪肘点，需默认相机验证不能穿过背部。现有0.14秒缩小退气仍须正常速度对原C cancellation inset验收。

新增专属descent_cancel匹配已接受俯冲held .50 pose；路由须在改phase前保留old_phase，只有old_phase==descent才选新clip。windup早取消保持当前pose转回飞行，不能先跳入满坠姿。现生产generic cast_martial_cancel尚未改，因此GLB指纹相同不证明取消已接线。已接受descent的charge已隐藏；额外消散wake尚未实现，不能因新增charge网格而宣称已有。

下一引擎窗口在独立候选验证场景/资源副本中加载，不能删除本目录.gdignore触发共享生产导入。正常速度真实R录制两个动作通过后，才协调owner晋升，再逐招处理windslash/aperture。

后续CPU接线补充：已新增runtime GLTFDocument loader（不走Editor导入）、独立武技模块副本及phase分支，尚未parse/运行。新descent_wake由原impact-reference A3/A-EX1肩/前臂拖尾派生，候选模块逐physics帧读取实际shoulderL/shoulderR/elbowR骨矩阵，实例化三个窄曲面拖尾；取消保留末次拖尾位置向上散开并淡出，无伤害/地面环权威。上述只属于候选实现，不能视作视觉通过。verify_runtime.gd准备真实R/T/G与自然CD路径，固定realm/energy/位置和AI只为艺术取证，仍待独占窗口执行。
