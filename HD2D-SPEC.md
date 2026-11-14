# HD-2D 视觉精细化与光学重构技术规范 (HD2D-SPEC)

本文档针对当前项目 HD-2D 渲染模式下的视觉瑕疵、光学违和感、透视适配缺陷与资产细节断层，制定完整的工程级解决规范。本规范以**视觉精细度与物理/光学自洽性为最高优先级**（暂不向低端硬件算力妥协），同时严格保证原有克制像素风格（Restrained Pixel Look）零退化。

---

## 1. 核心目标与架构约束

1. **微缩沙盘光学基准（Miniature Diorama Optics）**
   - 保持像素艺术纹理本身的清晰方正与色阶秩序，同时消除透视旋转下的走样碎裂；
   - 建立自洽的三维光影关系：连续顺滑的日月天光、不被建筑/海面/卡牌割裂的真实软硬阴影、受几何遮挡约束的局部暖光与体积雾气、符合三维薄透镜/移轴几何的焦平面，以及饱满明亮的夜景散景光斑（Bokeh）。
2. **双风格严格隔离（Zero Pixel-Look Regression）**
   - 当 `!hd.on`（`uHd < 0.5`）时，原有的正交像素格吸附（`snap`）、7 阶色带（`GRAD`）、深度轮廓描边（Ink Pass）及正交卡牌像素对齐逻辑保持原样；
   - 两套风格共用的底层几何与模型资产缺陷（如四角光标负缩放绕序、四坡屋顶法线、公共/投资建筑缺夜景贴图）修复后双端共同受益。
3. **工程与校验契约**
   - 所有自定义 Shader 块替换与 `#include` 锚点必须通过 `npm run check`（`scripts/check.mjs`）的 Three.js 源码完整性校验；
   - 所有新增或调整的模型部件、灯位槽位（`LAMP`）与包围盒必须满足 `scripts/check.mjs` 的烘焙网格数、三角面与槽位容量断言。

---

## 2. 模块一：后处理管线重构与半透明分层合成

**涉及文件**：`src/client/render/hd2d.ts`、`src/client/render/scene.ts`、`src/client/render/strike.ts`、`src/client/render/exhaust.ts`、`src/client/render/models/public/area51.ts`

### 2.1 问题根因
- 当前所有半透明网格（导弹尾焰、烟雾、爆炸闪光、火花、UFO 牵引光束）均设置 `depthWrite: false`，在主场景渲染阶段直接混入 `T.main` 颜色缓冲；
- `compPass` 执行 `if ( d >= 1.0 ) c = sky( rd );` 时，任何投影在天空背景前的半透明特效会被纯天空色直接覆盖而消失；投影在远海或建筑前的半透明特效则会被错误叠加远海浓雾、印上背后墙角的黑色 GTAO，并在 `dofPass` 中按背景深度错误散焦；
- `aoPass` 与 `volPass` 运行在半分辨率下，采样 `NearestFilter` 的全分辨率深度图时像素中心恰好落在 2x2 像素十字交界处，引发剪影边缘锯齿光边；且 GTAO 4x4 Bayer 抖动仅经单次 4x4 模糊便放大回全屏，在浅色屋顶与白墙上留下块状灰印；
- 缺少几何抗锯齿，斜向棱柱、屋脊、旗杆与桅杆旋转时存在明显 1px 闪烁；同时移除 Ink Pass 后，同色体素堆叠模型缺乏分件轮廓感。

### 2.2 解决方案
1. **不透明与半透明两阶段分离渲染（Opaque / Translucent Split）**
   - 定义专用半透明图层 `LAYER_FX = 1`（供 `exhaust`、`strike` 烟雾/闪光/火花、`area51` 飞碟光束及升级后的火山半透明烟团使用），主相机默认渲染 Layer 0（不透明与 `alphaTest` 几何体），特效渲染时切换至 Layer 1。
   - 重排 HD-2D 帧管线顺序：
     1. **Opaque Pass**：渲染 Layer 0 至全分辨率 `T.main`（RGB16F + Depth24/32F）；
     2. **Full-Res GTAO & Bilateral Denoise**：在全分辨率下运行 GTAO（提升至 6 方向 x 8 步），并使用法线+线性深度联合权重的分离式双遍双边滤波（Horizontal + Vertical Cross-Bilateral Blur，核宽 `9x9`），彻底根除半分辨率十字采样错位与 Bayer 网格灰斑；
     3. **Full-Res Volumetric Pass**：在全分辨率下计算太阳/月亮体积光束、聚光灯光锥与点光源空气光晕，经双边滤波输出至 `T.vol`；
     4. **Opaque Composite Pass**：在 `T.hdr` 中合成不透明场景颜色、GTAO、微缩折痕对比（见第 3 点）、天空背景 `sky(rd)`、指数高度海雾 `tau()` 与体积光 `T.vol`；
     5. **Translucent Forward Pass + FX Depth**：将 `T.hdr` 绑定为颜色目标并挂载 `T.main.depthTexture`（`depthTest: true`），渲染 Layer 1 半透明特效；同时为可见性 `alpha > 0.05` 的半透明片元输出一张单通道最近深度图 `T.fxDepth`（或通过 MRT 写出前景有效深度），并在半透明 Shader 内部按其自身真实世界坐标 `vWorldPos` 计算大气雾透射率 `exp(-tau(uEye, rd, dist))`；
     6. **DOF -> Bloom -> Tonemap & Color Grading -> SMAA**。
2. **微缩体块折痕微勾勒（Micro-Crease Shading）**
   - 在 `compPass` 中基于全分辨率线性深度与重构视空间法线，提取相邻像素间的法线夹角与深度二阶差分（排除剪影跳变边缘）：
     - 凹角缝隙（如船体阶梯交界、墙脚、棋子四肢接缝）施加柔和的微接触压暗（最高 `12%–18%`）；
     - 凸棱脊线（如屋檐边缘、石阶上沿）施加极克制的微高光提亮（最高 `6%–10%`），弥补无描边模式下纯色体素模型的分件立体感。
3. **后处理几何抗锯齿（SMAA 1x）**
   - 在色调映射与 sRGB 输出阶段接入标准三遍 **SMAA 1x**（Luma/Color Edge Detection -> Blending Weight Calculation -> Neighborhood Blending），在不模糊像素贴图内部纹素的前提下，消除所有 3D 斜边、细杆与棱柱边缘的锯齿闪烁。

---

## 3. 模块二：三维倾斜焦平面、高光散景（Bokeh）与色彩科学

**涉及文件**：`src/client/render/hd2d.ts`、`src/client/render/scene.ts`

### 3.1 问题根因
- `dofPass` 用屏幕纵坐标 `abs(uv.y - 0.5)` 伪造移轴模糊，导致焦点处的垂直高楼上半截与升空导弹被生硬截断糊掉，且与 `lens()` 的 `drop` 偏移脱节；
- `if ( r0 < 0.4 ) return;` 早退阻止了前景失焦物体向相邻对焦背景外溢扩散，产生刀切硬边；
- Karis 平均权重 `1 / (1 + luma)` 未做逆重映射，吞噬了夜景高光能量，导致失焦灯光灰暗浑浊，丧失 HD-2D 标志性的璀璨散景圆斑；
- 简化逐通道 ACES 拟合曲线在强光下产生严重色相偏移（品红褪白黄、橙红偏柠檬黄），且暗角 `endAsp` 未乘 `free.w`。

### 3.2 解决方案
1. **三维 Scheimpflug 沙盘焦平面（3D Tilted Focal Plane）**
   - 移除 `abs(uv.y - 0.5)` 屏幕 2D 项；
   - 对每个像素取 `z = min(zOpaque, zFx)` 重构世界坐标 `P_world`；
   - 定义过相机注视中心 `T = controls.target` 的三维焦平面法线 `N_focus`：
     - 在全局鸟瞰（`zoomed() == 0`）时，景深光圈收缩，全棋盘保持清晰，仅远海与地平线柔和虚化；
     - 随着近景推进（`zoomed() -> 1`），焦平面法线沿相机水平视线方向 `camForwardXZ` 定义：**同一水平景深距离 `dot(P_world.xz - T.xz, camForwardXZ)` 内的垂直建筑，从地面 `y = 0` 到塔顶 `y = H` 均处于零弥散带内**，确保注视点上的摩天大楼、发射塔与升空导弹通体锐利，只有沿沙盘前后纵深远离注视点的前排/后排地块产生自然的微距虚化。
2. **双通道前景外溢景深与 HDR Bokeh 光斑保真**
   - **CoC 计算与 Tile 膨胀**：计算带符号弥散圆 `signedCoC`（前景为负，背景为正）；运行 `16x16` 下采样 `cocTilePass` 求取邻域最大前景模糊半径 `maxFgCoC`（带 `1` 个 Tile 邻域膨胀），仅当像素自身 `|CoC| < 0.4` 且 `maxFgCoC < 0.4` 时才跳过模糊，允许前景失焦轮廓自然外溢覆盖背景。
   - **圆盘/多边形光圈核与高光散景**：采样提升至 `48–64` 点同心圆盘映射（Concentric Disk Mapping）或双遍前景/背景分离核；移除 `1 / (1 + luma)` 压制，改用物理圆盘面积归一化权重 `1.0 / max(r * r, 1.0)` 配合高光安全上限（如 `min(luma, 16.0)`），并为高亮片元（`luma > K.thr`）赋予轻微的光圈边缘环增亮（Cat's-eye / Optical Bokeh Rim），使失焦的路灯、窗户与霓虹化作晶莹通透的光斑。
3. **AgX / 三维矩阵 ACES 色调映射与视口对称暗角**
   - 将逐通道 Narkowicz ACES 替换为保持色相的 **AgX（Punchy 预设）** 或三维输入/输出矩阵版 **ACES Fitted（RRT + ODT）**，使高强度的品红、青蓝、赤橙霓虹在中心亮部自然过渡向柔和饱和亮色而非死黄/惨白；饱和度调整移至色彩空间安全区间并添加色域压缩防截断；
   - 将 `endAsp` 更新为 `vec2((w * free.w) / h, 1.0)`，保证右侧 UI 栏展开时暗角围绕可视舞台对称分布。

---

## 4. 模块三：透视卡牌解耦、亚像素锐利像素过滤与逐像素 LOD

**涉及文件**：`src/client/render/board.ts`、`src/client/render/scene.ts`、`src/client/render/light.ts`、`src/client/render/labels.ts`、`src/client/render/builder.ts`

### 4.1 问题根因
- `board.ts` 的 `labels()` 在 HD-2D 透视相机下仍执行正交像素格吸附与固定 `+z` 南向视差平移，导致缩放时卡牌尺寸跳动，旋转视角（如 `az = 180°`）时立体字母严重偏心甚至飞出卡牌边界；
- 透视旋转下 `NearestFilter` 导致地面细线、金框与斜向幕墙钢架断裂成闪烁锯齿；
- 全局单一整数 `lod.n` 无法兼顾低仰角透视下的近景与远景，且跨级时全地图纹理在同一帧集体突变。

### 4.2 解决方案
1. **HD-2D 下卡牌与立体字母的几何精确定位**
   - 在 `board.labels()` 中判断 `hd.on`：
     - 当 `hd.on === true` 时，停用 `Math.floor` 像素格吸附、奇数像素取整缩放与 `+z` 视差补偿；
     - `o.card.scale.set(1, 1, 1)`，`o.card.position.set(CARD.x, TOP + 0.015, CARD.z)`；
     - `o.letters` 按固定世界比例 `u = Math.min(pxUnit(fitZoom), CARD.w / 11)` 居中放置于 `(CARD.x, TOP + 0.015, CARD.z)`，字块厚度收敛为精致薄浮雕（如 `h = 0.06` 世界单位，`scale.set(u, h, u)`，不再除以 `sin(ELEV)` 拉伸 Z 轴），确保从 360° 任意方位角与任意仰角观察，字母均端正位于卡牌几何中心，绝不压框或越界。
2. **亚像素抗锯齿像素采样（Sharp Bilinear / Analytical Pixel Filter）**
   - 在 `light.ts`（`uHd > 0.5` 分支）中为所有像素贴图引入基于屏幕空间导数的分析盒式采样函数 `hdSample(sampler2D tex, vec2 uv)`：
     ```glsl
     vec4 hdSample( sampler2D tex, vec2 uv, int mip ) {
       vec2 sz = vec2( textureSize( tex, mip ) );
       vec2 p = uv * sz, i = floor( p + 0.5 );
       vec2 f = clamp( ( p - i ) / max( fwidth( p ), 1e-4 ) + 0.5, 0.0, 1.0 );
       return textureLod( tex, ( i - 0.5 + f ) / sz, float( mip ) );
     }
     ```
   - 配合双线性过滤状态（在 HD-2D 切换时将像素贴图设为 `LinearMipmapLinearFilter`，切回 Pixel 模式时恢复 `NearestMipmapNearestFilter`）：纹素内部 100% 保持纯平色块，仅在纹素边界跨过的 **1 个屏幕像素宽度** 内平滑抗锯齿，彻底消除斜向透视下的线条断裂与旋转摩尔闪烁。
3. **手绘三级贴图合并为硬件 Mipmap 链（Per-Pixel Continuous LOD）**
   - 改造 `lodMap` 与 `pixelTexture`：在 HD-2D 下，将 `make(2)`（Near，如 `128x128`）、`make(1)`（Mid，`64x64`）、`make(0)`（Far，`32x32`）直接填入同一张 `CanvasTexture` 的 `mipmaps[0..2]`（`32x32` 以下更小层级由 `make(0)` 盒式降采样补齐，`generateMipmaps = false`）；
   - GPU 根据每个像素的真实屏幕导数逐像素平滑选取最匹配的手绘层级，近景地面与建筑呈现精细 L2 刻画，远景格子自动退至干净的 L0 构图，彻底消灭缩放时的全图集体跳变与远景混叠；
   - `labels.ts` 中 `edge()` 的外框在生成 HD-2D Mip 1/2（即 Mid/Far）时保持不透明深色轮廓（不再使用半透明 `#0b0e2480`），弥补无 Ink Pass 时的中远景边界清晰度。

---

## 5. 模块四：无限海平面、水体真实光影与平滑昼夜大气

**涉及文件**：`src/client/render/world.ts`、`src/client/render/sky.ts`、`src/client/render/hd2d.ts`

### 5.1 问题根因
- `SEA = 500` 的有限矩形平面在低仰角（`elev = 22°`）下直接暴露出半空中的方形裁切断崖；
- 海面随机冷白闪光 `glint` 无视视线反射方向与建筑阴影，在夕阳与背阴处刺眼违和；连续浮点波浪法线与像素棋盘格水色风格割裂；
- 海面本体不接收阴影，浮在 `+0.01` 处的 `dim` 半透明层遮不住海面上的太阳直接高光；
- 太阳按 `0.2°` 阶跃移动造成 3 Hz 光影卡顿；日落 `-3°` 硬钳制翻转突兀；月夜体积光与月晕硬编码乘了暖黄色。

### 5.2 解决方案
1. **无限海平面延伸与海天无缝雾化**
   - 将海面网格扩展为跟随相机水平投影中心（吸附至大步长网格避免顶点抖动）的高半径圆盘（半径 `1600 > hdCam.far`），同时在 `compPass` 中对 `d >= 1.0 && rd.y < -1e-4` 的视线补充 `y = -0.8` 平面解析求交兜底，保证任意平移与极低仰角下海平面永远延伸至真实视平线；
   - 调整掠射角海雾光学厚度：在地平线附近（`abs(rd.y) -> 0`）使透射率 `tr -> 0` 平滑收敛至 `haze(rd)`，实现海水与远方天际线的无缝消融。
2. **海面原生阴影接收与物理方向性波光**
   - 移除独立的 `dim`（`ShadowMaterial`）平面，直接在 `sea` 网格上开启 `receiveShadow = true`：
     - 在海面着色器中读取软阴影因子 `shadow`：阴影区域将漫反射色向下偏移一档深海色调（保持清透感而非死黑），并将 **`directSpecular` 与 `glint` 同时乘以 `shadow`**，彻底消除建筑黑影内部反射刺眼太阳高光的现象；
   - **重构像素波光（`glint`）**：
     - 触发条件增加反射波瓣门控 `pow(saturate(dot(normal, halfDir)), 12.0)`，使闪烁波光仅聚集在迎向太阳/月亮反射光路的波峰带内，背光与阴影区自然隐去；
     - 波光 HDR 颜色改为 `sky.lightC * sky.lightK * 2.4`，正午呈晶莹金白、黄昏化作碎金赤红、月夜化为清冷碎银；
   - **波浪法线像素化**：对波浪斜率梯度按当前像素格中心 `q` 量化为有限倾角阶梯，使海面高光呈现与像素水纹一致的鳞片颗粒质感，并在远景随距离平滑衰减棋盘格抖动幅度以消除远海摩尔纹。
3. **连续无卡顿天体运动与双光源昼夜交接**
   - 在 `sky.ts` 中，`hd.on` 开启时取消 `Math.round(h / STEP) * STEP` 的 `0.2°` 角度阶跃量化，`sky.light` 与 `sky.sun` 同步每帧连续平滑旋转（`fitShadow` 已在光线正交平面上做纹素中心对齐，配合 PCSS 软核完全不会出现硬阴影边缘蠕动），彻底消除 3 Hz 光影抽动；
   - **平滑日月交接**：拆分 `sunLight` 与 `moonLight` 权重（或将太阳最低高度放宽至掠射角 `0.8°` 并在 `alt ∈ [-2°, +2°]` 内将主平行光强度平滑降至 `0` 再在 `[-6°, -2°]` 升起对侧月光），消除 `-3°` 的生硬钳制与霞光跳变；
   - **修正月夜散射色温**：移除 `hd2d.ts` 中 `volPass` 写死的 `vec3(1.0, 0.9, 0.7)` 与 `compPass` 写死的 `vec3(1.0, 0.8, 0.5)`，改由 `sky.lightC` 直接驱动体积散射与天体光晕色温，还原清澈冷冽的银蓝月夜。

---

## 6. 模块五：光源空间纠偏、全动态实时阴影与体积遮挡

**涉及文件**：`src/client/render/lamps.ts`、`src/client/render/world.ts`、`src/client/render/hd2d.ts`、`src/client/render/light.ts`、`src/client/render/scene.ts`、`src/client/render/scenery.ts`、`src/client/render/strike.ts`

### 6.1 问题根因
- 中心地球仪的点光源位于实心球心 `(0, FLOAT, 0)`，外表面法线背对球心导致球体完全受不到该灯照明而漆黑一片，且无夜间大陆城市灯火；
- `volPass` 的 `seen()` 将遮挡物厚度硬编码限制在 `1.2` 单位以内，导致厚建筑、火山、地球仪和前排塔楼完全挡不住后方光源的空气光晕；
- 聚光灯 `spot` 与全部点光源无阴影，光线与体积光锥直接穿墙透地；灯塔仅做原地呼吸闪烁而无旋转光束；
- 主动棋子弹跳、`tick` 机械运动不触发阴影重绘导致影子卡死，海上船只、海豚、风车与空中导弹关闭了 `castShadow`；
- PCSS 接收面梯度 `g` 未限幅导致折角 2x2 噪点，且 `shadowScale` 切换时核宽按纹素突变。

### 6.2 解决方案
1. **中心地球仪照明重塑与夜间大陆城市灯火**
   - 将 `lamps.ts` 中地球仪的点光源移出实心球心，改为对准底座罗盘与球体下缘的环境补光，并在地球仪材质中加入柔和的大气边缘瑞利辉光（Fresnel Atmosphere Rim）；
   - 在 `world.ts` 中新增 `planetNight(L)` 生成地球夜间 `emissiveMap`：依据 `LAND` 与 `NEAR`（海岸带与中低纬度陆地分布）结合确定性哈希点阵，绘制像素化的金黄色人类城市群灯光带，夜晚随 `uLamp` 亮起并在背阳面显现。
2. **真实厚度屏幕空间遮挡与聚光灯/关键光源实时阴影**
   - **修复 `seen()` 穿墙漏光**：移除 `1.0 - smoothstep(0.8, 1.2, gap)` 的薄墙假设；改为从空气采样点向光源步进（提升至 12 步）时，结合表面重构法线朝向与合理的建筑包围厚度上限（扩展至 `14.0` 单位，并对背向深度表面持续计入遮挡），彻底阻断后排灯光穿透前排摩天楼或球体漏出光晕；
   - **主动棋子聚光灯实时阴影**：开启 `spot.castShadow = true`（`1024x1024` 深度贴图），在 `light.ts` 中启用聚光灯 PCSS 软阴影，并将 `spot.shadow.map` 与 `spot.shadow.matrix` 传入 `hd2d.ts` 的 `volPass`，使主动棋子上方的聚光灯光锥遇到建筑和棋子时投下真实的体积暗影；
   - **灯塔旋转体积光束**：为角落灯塔（`ISLETS[1]`）在 `volPass` 中建立绕 Y 轴慢速旋转（角速度 `0.8 rad/s`）的双向水平光束锥（模拟灯塔双面透镜扫海），并在海面与薄雾中投出缓慢扫过的柔和光柱；
   - **导弹光源昼夜自适应**：将 `strike.ts` 中飞行段与爆炸段的 `fire.intensity` 及其体积光晕乘上昼夜适应因子 `mix(0.28, 1.0, sky.lampK)`，避免正午阳光下导弹周围出现突兀的浓重橙雾团。
3. **全场景动态物体实时阴影覆盖**
   - 在 HD-2D 模式下，每帧（或只要画面内存在活跃弹跳棋子、可见 `tick` 运动节点、航行船只、跃起海豚、旋转风车、飞行导弹）自动触发太阳阴影重绘，保证弹跳棋子、油田磕头机、新加坡水幕的地面软阴影 60fps 实时同步；
   - 移除 `scenery.ts` 中 `moving()` 强制设置 `o.castShadow = false` 的限制，为货轮、帆船、海豚、风车叶片、火山烟团及 `strike.ts` 中的导弹开启 `castShadow = true`（在 `fitShadow` 中确保可视范围内的海面船只纳入正交阴影视锥）。
4. **PCSS 梯度限幅与世界空间恒定软度 + 高密度体积光步进**
   - 在 `light.ts` 的 `pcss()` 中，按阴影纹素深度比对平面梯度限幅：`g = clamp(g, vec2(-maxSlope), vec2(maxSlope))`，消除体素折角与立体字边缘的 2x2 阴影块噪点；并将 Blocker 搜索半径扩展至 `1.2` 世界单位；
   - 将 PCSS 的最小/最大滤波核半径改为以**世界单位**定义（如 `clamp(penumbraWorld, 0.06, 0.75) / uSh.y * tx`），确保镜头缩放触发 `shadowScale`（`1 <-> 2`）切换时，地面阴影模糊宽度保持连续无跳变；
   - 将 `volPass` 太阳体积光步进从 `20` 步提升至 `64` 步（配合 Interleaved Gradient Noise 抖动与全分辨率双边滤波），彻底消除窄楼群日落长影中的光束断层条纹。

---

## 7. 模块六：材质统一受光、精确 PBR 掩码、夜景补全与资产精修

**涉及文件**：`src/client/render/light.ts`、`src/client/render/board.ts`、`src/client/render/builder.ts`、`src/client/render/actors.ts`、`src/client/render/scenery.ts`、`src/client/render/strike.ts`、`src/client/render/models/**`

### 7.1 问题根因
- `card` 与 `plaque` 采用无光照 `MeshBasicMaterial`：白天阻断建筑软阴影，夜晚空地上的白底 `SALE` 木牌惨白刺眼，而本该发光的霓虹招牌又因无 HDR 强度无法触发 Bloom；
- `RELIEF` 无差别将贴图明度当高度且固定跨 1 个 Mip 0 纹素差分，导致整块平坦纹素倾斜泛边、棋子眼珠凹陷如石雕、地面彩绘标线凸起如砖块；`hip` 四坡屋顶保留了圆锥平滑法线导致高光弯曲；
- `GLOSS` 凭 `b - max(r, g)` 猜玻璃，漏判了 Lv2 别墅青色落地窗（`#5cc0d8`）与中银大厦银蓝幕墙，误判了蓝色玩家卫衣；
- `USE_EMISSIVEMAP` 无条件给整面墙加暖色自发光底光，导致 Lv1 小屋下层 `block` 白墙与上层共面 `gable` 白山墙在夜里裂成上下两截颜色；
- 使用旧版 `floor()` 的机场、高铁站、BBC、新闻社、税务局、马士基、建筑集团大楼夜晚全黑如停电烂尾楼；未售空地与抵押地块的 `pad` 夜里仍有 `0.5` 强无阴影背光；
- 火山冒出实心硬边灰方块，导弹烟雾脱节成等距圆球串；四角选中光标因单轴负缩放导致三角面绕序翻转。

### 7.2 解决方案
1. **信息卡（`card`）与招牌（`plaque`）全面纳入光照阴影体系**
   - **受光信息卡**：将 `board.ts` 中的 `card` 材质由 `MeshBasicMaterial` 替换为受光 `toon` 材质（`rough = 0.88, spec = 0.25, relief = 0`，开启 `receiveShadow = true`）：
     - 白天完整接收建筑、门柱与棋子的 PCSS 软阴影，夜晚自然接收周围霓虹灯与路灯的色彩晕染；
     - 保留克制的夜间微背光（如 `backlit(..., 0.12)`）配合立体字的 `backlit`，确保深夜暗处卡牌编号依然清晰易读，彻底消除阴影在卡牌边缘被硬截断的“贴纸感”。
   - **招牌 `plaque` 语义分流与双面化**：
     - 为 `builder.plaque()` 增加可选模式参数 `lit?: 'sign' | 'neon'`（默认 `'sign'`）：
       - `'sign'`（木牌/石牌/金属铭牌，如 `SALE`、`LV n`、`START`、`TAX`、`JAIL`、`TOLL`、`NEWS`、恶魔岛锁头）：使用受光 `toon` 材质，开启 `castShadow / receiveShadow`，夜晚随环境光自然变暗，不再在荒地里惨白发光；同时将 `city.ts` 的 `SALE` 牌与 `LV` 牌背面也贴上相同牌面（或深色木背板），解决北向视角整排白板问题；
       - `'neon'`（灯箱与霓虹招牌，如 `AREA 51`、BBC `ON AIR`、`CLUB`、`CASINO`、`CRH`、美联航与马士基航站楼灯箱，以及 `las-vegas.ts` 的主霓虹招牌 `SIGN`）：使用 `nightlit` / `glow` 材质，白天保持正常招牌色，黄昏后输出 `1.8–2.5` 倍 HDR 辐射度触发柔和 Bloom 辉光。
2. **显式 PBR 属性掩码与纹素微斜角法线（Explicit Material Mask & Texel Bevel）**
   - **废除颜色猜测（`GLOSS` 蓝色启发式与全贴图明度 `RELIEF`）**：
     - 为程序化贴图引入伴随属性图 `ormMap`（或双通道数据纹理：R = `gloss` 玻璃光滑度，G = `height` 真实结构凹凸高度）：
       - 在 `builder.ts` 绘制窗户、玻璃幕墙（含 Lv2 别墅的 `AQUA` 青色落地窗、香港中银大厦 `curtain` 幕墙与天窗、摩天楼 `RIBBON` 玻璃带、门厅玻璃）时，精确写入 `gloss = 1.0`（对应 `rough = 0.10`）与窗框凹陷高度；墙面灰缝、屋顶瓦片接缝、砖石灰缝写入真实凹槽高度；
       - 棋子五官（`FACE`）、卫衣（`TORSO`）、骰子点数、卡牌表面、地面平面油漆标线（`START` 终点格、斑马线、舞池格）的 `height` 保持纯平（仅石砖拼缝写浅凹槽），`gloss = 0`，彻底根除“石雕凹坑眼”、“玻璃卫衣”与“凸砖油漆线”。
     - 在 `RELIEF` 中按当前生效的 Mip 层级查询 `textureSize(ormMap, mip)`，结合亚像素导数仅在高度阶跃边缘生成精细的 1px 灰缝微斜角法线，不再将整块平坦纹素面片的法线掰歪。
   - **修复四坡屋顶（`hip`）平面法线**：在 `builder.ts` 的 `roofGeo` 完成 `.toNonIndexed()` 后立即调用 `g.computeVertexNormals()`，使四坡屋顶的四个斜面拥有平整一致的面法线。
3. **夜间自发光一致性与全图公共/投资建筑亮灯**
   - **消除山墙水平断色线**：删除 `light.ts` 中 `NIGHT` 块内无条件叠加给整面墙体的 `+ diffuseColor.rgb * vec3(0.08, 0.05, 0.022) * uHd`，使仅窗户像素发光，墙体底色与无 `emissiveMap` 的 `gable()` 三角山墙、女儿墙完全一致；
   - **淘汰无夜景的旧版 `floor()`**：为 `facade()` / `wallMat` 补全与 `cityMat` 同标准的夜间窗户 `emissiveMap`（或将 `china-railway.ts`、`united-airlines.ts`、`build.ts`、`maersk.ts`、`bbc.ts`、`news.ts`、`tax.ts` 中的 `floor()` 全部升级为带确定性种子的 `block()`），并为 BBC 大楼、机场航站楼、高铁站、银行（古希腊柱廊暖色洗墙灯）、证券交易所补充 `ModelDef.lamps` 局部灯位（同步上调 `light.ts` 中 `LAMP.city` 起始偏移量并通过 `npm run check` 校验）；
   - **收敛地块垫子（`pad`）背光**：当状态为未售空地（`!st`）或已抵押（`st.m`）时，将 `pad` 的 `uBacklit` 设为 `0`；仅对已购且正常营业的地块开启柔和背光（由 `0.5` 调优至 `0.18`），且在 `compPass` 中允许 GTAO 作用于背光表面，恢复建筑根部扎实的接地阴影。
4. **特效几何升级与光标绕序修复**
   - **火山体积烟团**：将 `scenery.ts` 中的 6 个实心硬边立方体 `box(1, 1, 1)` 升级为由多个错落二十面体/球体融合而成的蓬松烟团，赋予半透明软边缘材质（归入 `LAYER_FX`），底部根据距火山口高度叠加橙红岩浆透射暖光，随上升逐渐冷却为半透明灰烟消散；
   - **导弹连续烟迹**：将 `strike.ts` 的烟雾池扩容（如 `SMOKE_COUNT = 144, SMOKE_STEP = 0.009s`），结合随年龄膨胀与旋流噪声偏移，使高速上升与俯冲段的尾烟连成饱满绵密的气流轨迹，消除孤立圆球串；
   - **修复四角光标括号绕序**：将 `board.ts` 中 `cursor()` 的 `b.scale.set(-x, 1, -z)` 替换为绕 Y 轴正交旋转 `b.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][k]`（四角顶点顺时针排列），保持所有括号网格正缩放行列式与正确外表面法线。

---

## 8. 分阶段落地路线与验收矩阵

为保证每一步改动清晰可控、随时可构建验证，建议按以下 6 个独立阶段依次推进：

| 阶段 | 核心范围 | 关键修改文件 |
| :--- | :--- | :--- |
| **Phase 1: 几何、卡牌透视与材质底层修正** | 光标绕序修复、`hip` 平面法线、HD-2D 卡牌/立体字解耦、`card`/`plaque` 受光与霓虹分流、山墙断色修复、`pad` 背光收敛 | `board.ts`, `builder.ts`, `light.ts`, `models/city.ts`, `models/special/las-vegas.ts` |
| **Phase 2: 精确 PBR 掩码、亚像素采样与 Mipmap LOD** | 纹素级 `gloss/height` 属性图替代颜色猜测、Sharp Bilinear 导数抗锯齿采样、三级手绘贴图合并硬件 Mipmap 链 | `scene.ts`, `light.ts`, `builder.ts`, `labels.ts`, `actors.ts` |
| **Phase 3: 无限海平面、水体真实阴影与连续昼夜大气** | 无限海平面与视平线雾化、`sea` 原生阴影与方向性染色 `glint`、波浪法线像素化、取消太阳 0.2° 跳步、平滑日月交接与月夜银蓝色温 | `world.ts`, `sky.ts`, `hd2d.ts`, `scene.ts` |
| **Phase 4: 光源纠偏、全动态阴影、聚光灯阴影与体积光** | 地球仪外置补光与夜间城市灯火、船只/海豚/导弹/弹跳棋子/`tick` 实时阴影、PCSS 梯度限幅与世界核宽、`spot` 实时阴影与体积光锥、灯塔旋转光束、64 步体积光与 `seen()` 厚度修复 | `lamps.ts`, `world.ts`, `light.ts`, `scene.ts`, `hd2d.ts`, `scenery.ts`, `strike.ts` |
| **Phase 5: 半透明分层管线、三维焦平面、Bokeh 与色彩** | `LAYER_FX` 不透明/半透明分离合成、全分辨率 GTAO 双边滤波与微缩折痕、三维 Scheimpflug 焦平面、前景外溢 HDR Bokeh、AgX/矩阵 ACES 与 SMAA 1x | `hd2d.ts`, `scene.ts`, `strike.ts`, `exhaust.ts`, `models/public/area51.ts` |
| **Phase 6: 全图公共/投资建筑夜景补全与特效几何精修** | `floor()` 建筑全面亮窗与地标补灯、火山半透明透光烟团、导弹高密连续烟迹 | `builder.ts`, `light.ts`, `scenery.ts`, `strike.ts`, `models/{invest,public}/*.ts` |

### 验收与视觉回归检查清单
每个阶段完成后均需通过：
1. **静态与模型预算校验**：`npm run check` 与 `npm run build` 零报错通过；
2. **Pixel 模式零回归对比**：运行 `node scripts/shot-matrix.mjs --looks=pixel --hours=0,12,18` 确认原有像素风格画面一致；
3. **HD-2D 专项疑难场景矩阵验收**：
   - **低仰角海天与日落交接**：`elev=22, zoom=0.5, hours=12,17.95,18.25,0` —— 验证海平面无方形断崖、海面阴影内无太阳高光、波光随日月方向与色温变化、月夜无脏黄雾；
   - **旋转视角卡牌与跨卡阴影**：`tile=13,14, az=180,-35, zoom=3` —— 验证 360° 视角下立体字母居中不越界、建筑软阴影平滑穿过彩色卡牌不断裂；
   - **高楼三维景深与夜景 Bokeh**：`tile=13,20, elev=30, zoom=2.8, hours=12,0` —— 验证注视点高楼从底座到塔尖通体清晰、前景失焦轮廓柔和外溢、远景路灯与霓虹形成明亮散景圆斑；
   - **地球仪、火山与公共建筑夜景**：中心地球仪大陆灯火清晰、火山烟团柔和透光、机场/BBC/高铁站等建筑夜间灯火通明、未售空地 `SALE` 牌与 `pad` 自然暗下；
   - **导弹跨空半透明合成**：`elev=22, strike=[30,52,1.6]` —— 验证尾焰与连续烟带在天空及远海背景前均不被抹除、不被印上墙角 AO。
