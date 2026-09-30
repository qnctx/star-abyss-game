# 四向人类走跑参考 · 2026-09-05

本轮用户要求先生成动作参考再修改实体三维动作。生成方式：imagegen 技能的内置图像工具；接口不暴露型号选择参数，因此不宣称已锁定某个模型版本。未使用 CLI / 外部付费 API 脚本。

输入图仅用于保留 C「玄壳共生服」外观：`../explorer-outfits-20260905-v1/03-mineral-symbiosis.png`。此处四张均为 AI 生成的艺术动作参考，不是当前游戏截图、动作捕捉数据或逐帧物理真值，也不是贴到人物上的动画替身。

- [前进：步行 / 跑步](01-forward.png)
- [后退：步行 / 跑步](02-backward.png)
- [左移：侧步 / 侧跑](03-left.png)
- [右移：侧步 / 侧跑](04-right.png)

## 检查与采用边界

- 保留 C 薄片矿壳、织物、人类比例、头盔与琥珀脊线；不重新设计衣服。
- 首轮前进图多帧姿势近似，已修订为迈步 / 经过的不同轮廓。左移图原箭头反向已纠正；右移图原人物朝运动方向前跑，已改为背面侧移构图。
- 修订图仍有相邻姿势重复和个别左右脚时序不明确，不按帧号自动提取角度或照抄循环。采用的是承重、折腿回收、侧移平衡的视觉意图；完整左右脚时序、骨架曲线与接触由游戏逻辑独立校验。
- 前进：走路更直立，身体经过支撑脚；跑步折腿回收、屈肘、躯干前倾并有短暂腾空轮廓。
- 后退：重新安排后探、前掌接触和收腿，不把前进动画倒放。
- 左右：领步 / 跟步和横向承重，不把前进摆腿简单旋转；人体解剖侧与输入方向在代码中确定，服装不镜像。
- 实现验收以实际三维连续预览、真实按键及足底接触为准。不能因图好看或数值测试通过，就认定真人动作自然度已通过。

## 完整提示词

### 前进：步行 / 跑步

保存路径：`E:/myProject/star-abyss-game/docs/ui-concepts/human-locomotion-20260905-v2/01-forward.png`

```text
Use case: stylized-concept.
Asset type: human locomotion reference sheet for animating the existing C / mineral-symbiosis planetary explorer in a real 3D game, NOT a screenshot and NOT a clothing redesign.
Input image 1 is OUTFIT IDENTITY REFERENCE ONLY: preserve the fitted taupe/charcoal textile suit, thin asymmetric weathered ivory mineral shoulder/back/shin leaves, slender dim amber spine, compact black-visor helmet, flexible gloves and expedition boots. Replace all static standing poses with convincing HUMAN motion. Adult natural human anatomy and consistent proportions across frames.
Style: high quality realistic human movement photography translated into detailed realistic game-character renders, anatomy and believable weight transfer more important than armor detail. Soft even studio lighting, warm grey background, single flat floor and light contact shadows, no environment, no HUD.
Layout: one wide landscape production board, two clearly separated rows, six sequential full-body key poses in each row, consistent camera and scale, all hands and feet visible, numbered 01–06. Each row samples ONE COMPLETE cycle, not six repetitions of the same pose. Strong silhouette readability of BOTH legs and BOTH arms. Minimal clean Chinese headings specified below. Use small direction arrows, no long prose.
Motion requirements: relaxed shoulders, pelvis taking body weight over the supporting leg, chest counter-rotation, natural elbow flexion and relaxed fingers; heel/ball/toe contact must follow the specific movement, not stiff straight-leg marching. Noticeable differences among loading, support, passing, push-off and recovery. No mechanical robot posture, no rigid parallel arms, no identical knees in every panel, no moonwalk sliding, no crossed or interpenetrating legs, no extra limbs, no redesigned costume, no weapons, no watermarks. This is an artist's reference, not medical data.
Title (verbatim): "01 / 前进 · 人类走跑动作"
Camera: true side view with a tiny rear-three-quarter component for limb separation; character faces and travels to image RIGHT in every frame.
Top row heading: "步行 · 接触 / 承重 / 经过 / 蹬离 / 换腿 / 回收". Natural purposeful walking: forward heel touches first, knee gently yields as the opposite foot leaves; pelvis passes over planted foot; rear heel rises and toe pushes off; swinging knee folds and foot clears the floor; opposite arm comes forward with the forward leg; at least one foot contacts the floor, no high stepping. Show left/right alternation through the complete cycle.
Bottom row heading: "跑步 · 落足 / 缓冲 / 支撑 / 蹬伸 / 腾空 / 回收". Human running: mild whole-body forward inclination from ankles, substantial knee bend on impact and during rear-leg recovery, heel folds toward buttock before the knee travels forward, relaxed bent elbows counter-swing with opposite legs, distinct short airborne phase with both feet off the floor. Land near the center of mass; do not reach a locked straight leg far ahead. No crouched running throughout.
```

针对性修订提示词：

```text
Use case: precise-object-edit. Input image is the edit target. Fix ONLY the six WALKING poses in the TOP ROW of this C-suit human motion board; they are currently near-duplicates, which is wrong for an animation reference. Keep the outfit identity, layout, title, lighting, and ENTIRE BOTTOM RUNNING ROW unchanged. Keep the same right-facing camera. Replace top frames with a genuinely alternating full walking cycle: 01 LEFT foot extended forward with heel on floor, RIGHT leg trailing; 02 body transfers above the planted LEFT foot, right heel lifts, knees yield; 03 LEFT support leg directly UNDER pelvis, RIGHT knee bends and passes close to left leg with right foot OFF floor; 04 RIGHT foot now extended FORWARD heel-down, LEFT leg trailing, arms swapped from frame01; 05 body above planted RIGHT support, left heel lifts; 06 RIGHT support leg UNDER pelvis, LEFT swing knee passes forward with left boot OFF floor. Frames03 and06 must have the legs CLOSE TOGETHER beneath the body in the passing pose, distinctly different from the wide contact strides01/04. Exactly two legs per figure, clear near/far limb separation, natural walking not marching, at least one foot supporting, no floating all-body. Match all clothing material and dimensions to the original. No extra words.
```

### 后退：步行 / 跑步

保存路径：`E:/myProject/star-abyss-game/docs/ui-concepts/human-locomotion-20260905-v2/02-backward.png`

```text
Use case: stylized-concept.
Asset type: human locomotion reference sheet for animating the existing C / mineral-symbiosis planetary explorer in a real 3D game, NOT a screenshot and NOT a clothing redesign.
Input image 1 is OUTFIT IDENTITY REFERENCE ONLY: preserve the fitted taupe/charcoal textile suit, thin asymmetric weathered ivory mineral shoulder/back/shin leaves, slender dim amber spine, compact black-visor helmet, flexible gloves and expedition boots. Replace all static standing poses with convincing HUMAN motion. Adult natural human anatomy and consistent proportions across frames.
Style: high quality realistic human movement photography translated into detailed realistic game-character renders, anatomy and believable weight transfer more important than armor detail. Soft even studio lighting, warm grey background, single flat floor and light contact shadows, no environment, no HUD.
Layout: one wide landscape production board, two clearly separated rows, six sequential full-body key poses in each row, consistent camera and scale, all hands and feet visible, numbered 01–06. Each row samples ONE COMPLETE cycle, not six repetitions of the same pose. Strong silhouette readability of BOTH legs and BOTH arms. Minimal clean Chinese headings specified below. Use small direction arrows, no long prose.
Motion requirements: relaxed shoulders, pelvis taking body weight over the supporting leg, chest counter-rotation, natural elbow flexion and relaxed fingers; heel/ball/toe contact must follow the specific movement, not stiff straight-leg marching. Noticeable differences among loading, support, passing, push-off and recovery. No mechanical robot posture, no rigid parallel arms, no identical knees in every panel, no moonwalk sliding, no crossed or interpenetrating legs, no extra limbs, no redesigned costume, no weapons, no watermarks. This is an artist's reference, not medical data.
Title (verbatim): "02 / 后退 · 人类走跑动作"
Camera: stable side view with a tiny front-three-quarter component, character consistently FACES image RIGHT while movement arrow and translation are toward image LEFT. This is real backward locomotion, never turn around and walk forward and never merely reverse forward-running photographs.
Top row heading: "倒退步行 · 探地 / 承重 / 回收". Backward step reaches BEHIND the pelvis, toe/forefoot finds the floor before the heel lowers, cautious shorter steps, soft knees, mostly upright torso, relaxed small arm swing. The front foot pushes body backwards; body weight shifts onto the back support foot before the front foot recovers.
Bottom row heading: "倒退跑 · 后探 / 缓冲 / 推离". Controlled backward jogging: deeper cushioning knee flexion than walking, small rearward travel, moderate bent elbows, forefoot-first rear contact, a brief recovery/flight moment, realistic balanced athletic posture not an exaggerated backward lean. Distinct six sequential poses showing support foot and returning foot correctly. Both rows preserve forward attention with head facing RIGHT.
```

### 左移：侧步 / 侧跑

保存路径：`E:/myProject/star-abyss-game/docs/ui-concepts/human-locomotion-20260905-v2/03-left.png`

```text
Use case: stylized-concept.
Asset type: human locomotion reference sheet for animating the existing C / mineral-symbiosis planetary explorer in a real 3D game, NOT a screenshot and NOT a clothing redesign.
Input image 1 is OUTFIT IDENTITY REFERENCE ONLY: preserve the fitted taupe/charcoal textile suit, thin asymmetric weathered ivory mineral shoulder/back/shin leaves, slender dim amber spine, compact black-visor helmet, flexible gloves and expedition boots. Replace all static standing poses with convincing HUMAN motion. Adult natural human anatomy and consistent proportions across frames.
Style: high quality realistic human movement photography translated into detailed realistic game-character renders, anatomy and believable weight transfer more important than armor detail. Soft even studio lighting, warm grey background, single flat floor and light contact shadows, no environment, no HUD.
Layout: one wide landscape production board, two clearly separated rows, six sequential full-body key poses in each row, consistent camera and scale, all hands and feet visible, numbered 01–06. Each row samples ONE COMPLETE cycle, not six repetitions of the same pose. Strong silhouette readability of BOTH legs and BOTH arms. Minimal clean Chinese headings specified below. Use small direction arrows, no long prose.
Motion requirements: relaxed shoulders, pelvis taking body weight over the supporting leg, chest counter-rotation, natural elbow flexion and relaxed fingers; heel/ball/toe contact must follow the specific movement, not stiff straight-leg marching. Noticeable differences among loading, support, passing, push-off and recovery. No mechanical robot posture, no rigid parallel arms, no identical knees in every panel, no moonwalk sliding, no crossed or interpenetrating legs, no extra limbs, no redesigned costume, no weapons, no watermarks. This is an artist's reference, not medical data.
Title (verbatim): "03 / 左移 · 人类侧步动作"
Camera: fixed directly behind the character with slight rear three-quarter offset, back of suit readable. Body and head keep facing into the scene / away from camera throughout. Movement is to the character's LEFT, image LEFT. Do NOT rotate the character to simply run forward to the left.
Top row heading: "向左侧步 · 左脚领步 / 转移重心 / 右脚跟进". Six sequential naturally paced human side-step poses: left leg opens to the left and accepts weight, pelvis shifts over left support, right foot lifts and follows inwards without crossing or touching the left boot, stance becomes narrower then left opens again. Knees remain slightly soft, arms loosely counterbalance across the body, NOT a T pose, NOT a huge squat or dance pose. Left-leading and right-following roles must be clear.
Bottom row heading: "向左侧跑 · 预压 / 侧推 / 跟步". Six sequential human lateral shuffle-running poses: right leg pushes laterally off the floor, left foot lands to receive the body, trailing right recovers underneath; mild lateral lean toward travel, flexed knees and relaxed bent arms balancing rather than swinging fore-aft as in forward sprint. Brief light airborne transition possible, no foot crossing, no ice skating sliding, no exaggerated wide-legged crouch. Minimal inward/outward hip rotation where human balance requires it.
```

针对性修订提示词：

```text
Use case: precise-object-edit. Input image is the edit target. Correct ONLY THE DIRECTION ARROWS on this LEFT SIDESTEP reference sheet: EVERY small horizontal movement arrow must point to image LEFT (←), never right. The Chinese heading correctly says 左移 and the motion should move left. Preserve every character pose, all outfit panels on their original sides, all typography and numbers, layout, background, floor, lighting and everything else unchanged. Do not mirror the image. Only reverse the arrowheads of all horizontal arrows.
```

### 右移：侧步 / 侧跑

保存路径：`E:/myProject/star-abyss-game/docs/ui-concepts/human-locomotion-20260905-v2/04-right.png`

```text
Use case: stylized-concept.
Asset type: human locomotion reference sheet for animating the existing C / mineral-symbiosis planetary explorer in a real 3D game, NOT a screenshot and NOT a clothing redesign.
Input image 1 is OUTFIT IDENTITY REFERENCE ONLY: preserve the fitted taupe/charcoal textile suit, thin asymmetric weathered ivory mineral shoulder/back/shin leaves, slender dim amber spine, compact black-visor helmet, flexible gloves and expedition boots. Replace all static standing poses with convincing HUMAN motion. Adult natural human anatomy and consistent proportions across frames.
Style: high quality realistic human movement photography translated into detailed realistic game-character renders, anatomy and believable weight transfer more important than armor detail. Soft even studio lighting, warm grey background, single flat floor and light contact shadows, no environment, no HUD.
Layout: one wide landscape production board, two clearly separated rows, six sequential full-body key poses in each row, consistent camera and scale, all hands and feet visible, numbered 01–06. Each row samples ONE COMPLETE cycle, not six repetitions of the same pose. Strong silhouette readability of BOTH legs and BOTH arms. Minimal clean Chinese headings specified below. Use small direction arrows, no long prose.
Motion requirements: relaxed shoulders, pelvis taking body weight over the supporting leg, chest counter-rotation, natural elbow flexion and relaxed fingers; heel/ball/toe contact must follow the specific movement, not stiff straight-leg marching. Noticeable differences among loading, support, passing, push-off and recovery. No mechanical robot posture, no rigid parallel arms, no identical knees in every panel, no moonwalk sliding, no crossed or interpenetrating legs, no extra limbs, no redesigned costume, no weapons, no watermarks. This is an artist's reference, not medical data.
Title (verbatim): "04 / 右移 · 人类侧步动作"
Camera: fixed directly behind the character with slight rear three-quarter offset, back of suit readable. Body and head keep facing into the scene / away from camera throughout. Movement is to the character's RIGHT, image RIGHT. Do NOT rotate the character to simply run forward to the right.
Top row heading: "向右侧步 · 右脚领步 / 转移重心 / 左脚跟进". Six sequential naturally paced human side-step poses: right leg opens to the right and accepts weight, pelvis shifts over right support, left foot lifts and follows inwards without crossing or touching the right boot, stance becomes narrower then right opens again. Knees remain slightly soft, arms loosely counterbalance across the body, NOT a T pose, NOT a huge squat or dance pose. Right-leading and left-following roles must be clear.
Bottom row heading: "向右侧跑 · 预压 / 侧推 / 跟步". Six sequential human lateral shuffle-running poses: left leg pushes laterally off the floor, right foot lands to receive the body, trailing left recovers underneath; mild lateral lean toward travel, flexed knees and relaxed bent arms balancing rather than swinging fore-aft as in forward sprint. Brief light airborne transition possible, no foot crossing, no ice skating sliding, no exaggerated wide-legged crouch. Minimal inward/outward hip rotation where human balance requires it. Mirror MOTION mechanics of the leftward sheet, but KEEP the asymmetric C outfit panels on their original anatomical sides, do not mirror clothing identity.
```

针对性修订提示词：

```text
Use case: precise-object-edit. Input image is the edit target. Correct the DIRECTIONAL BODY POSES on this RIGHT LATERAL STEP sheet, preserving C-suit design, text, numbering, two-row layout, material, floor and lighting. Current figures misleadingly turn right and run FORWARD. All twelve figures must instead show TRUE REAR VIEW: both shoulders equally visible, back of helmet centered, chest and head pointing directly AWAY from viewer into screen. They travel to image RIGHT while continually facing AWAY. Top row six distinct walking sidesteps: 01 neutral soft knees feet hip-width; 02 right leg lifts and OPENS to right side; 03 right boot plants wide to image right and pelvis transfers over right support; 04 left boot lifts and FOLLOWS toward right while right stays planted; 05 left boot lands hip-width to left of right; 06 right boot lifts to begin next opening step. No crossed feet. Bottom row repeats right-leading/left-following lateral mechanics as faster lateral shuffle with bent knees and arms loosely counterbalancing, modest lean RIGHT, distinct push-off and small airborne transfer. Right support always absorbs the lateral motion, not a forward running stride. Show the entire BACK of torso and BOTH SHOULDER BLADES in each frame, no side-facing visors. Do not mirror the asymmetric outfit leaves. Horizontal arrows all point image RIGHT.
```

