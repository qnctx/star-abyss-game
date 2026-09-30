const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,root=path.resolve(base,'../../..'),dest=path.join(base,'qa/audit-r4');
const cards=[
  {
    "id": "01",
    "title": "大陆与流域",
    "ref": "01-planet-geography.png",
    "actual": "godot/reports/terrain-r3-material/orbit.png",
    "kind": "材质开发机位",
    "note": "当前只证明能渲染整球。盆地占比、相连主脊、河网与海岸身份没有完成同投影核对。",
    "scale": "大陆 / 整球"
  },
  {
    "id": "02",
    "title": "干盆地与层岩",
    "ref": "02-basalt-basin.png",
    "actual": "godot/reports/terrain-r3-material/basin-ground.png",
    "kind": "材质开发机位",
    "note": "光滑旧坡面仍占主导；参考中的垂直断口、块状碎石、崖脚坡积物没有形成同等层次。",
    "scale": "地面 / 盆缘"
  },
  {
    "id": "03",
    "title": "盆地到平原",
    "ref": "03-basin-to-plains.png",
    "actual": "godot/reports/terrain-r3-material/route-8000.png",
    "kind": "材质开发机位",
    "note": "必须核对台地降低、砾石至细土、稀草至草丛的共同变化；换绿色底材质不足以通过。",
    "scale": "地面 / 区域"
  },
  {
    "id": "04",
    "title": "山系、峡谷与悬崖",
    "ref": "04-mountains-canyon-cliffs.png",
    "note": "本页缺对应实景。需要沿主脊、横跨峡谷、崖脚三个机位，不用平原或火山截图代替。",
    "scale": "地面 / 山系"
  },
  {
    "id": "05",
    "title": "河谷森林",
    "ref": "05-forest.png",
    "actual": "godot/reports/terrain-r3-material/route-17000.png",
    "kind": "材质开发机位",
    "note": "当前候选机位缺乏参考中的林下巨木尺度、层次丰富的地表、背景崖壁和近处河岸；相似树冠重复明显。",
    "scale": "林下 / 林冠 / 流域"
  },
  {
    "id": "06",
    "title": "河流与湿地",
    "ref": "06-river-wetland.png",
    "actual": "godot/reports/terrain-r3-material/route-27000.png",
    "kind": "材质开发机位",
    "note": "当前候选机位与森林同样呈平整底面加树/岩点缀，未显示参考中可读的主槽、洲滩、浅水芦苇镶嵌结构。",
    "scale": "水岸 / 河漫滩"
  },
  {
    "id": "07",
    "title": "河口与海岸",
    "ref": "07-estuary-coast.png",
    "actual": "godot/reports/terrain-r3-material/route-34000.png",
    "kind": "材质开发机位",
    "note": "必须在完整河口机位证明主槽展宽、沉积浅滩、岩岬与外海相接；本图未建立相机对应。",
    "scale": "岸边 / 完整河口"
  },
  {
    "id": "08",
    "title": "海洋与裂岛",
    "ref": "08-ocean-islands.png",
    "note": "本页缺对应裂岛群实景。不能用单一海岸或轨道海色替代海峡、礁群、海蚀柱结构验收。",
    "scale": "海面 / 岛群 / 轨道"
  },
  {
    "id": "09",
    "title": "自然生态交界",
    "ref": "09-natural-ecotones.png",
    "note": "本页缺跨林缘连续实景。需同一条弯河与草地空隙贯穿两侧，并检查地面到区域尺度。",
    "scale": "步行 / 横跨林缘"
  },
  {
    "id": "10",
    "title": "盆地高空",
    "ref": "10-basin-1600m.png",
    "actual": "godot/reports/terrain-r3-material/basin-1600m.png",
    "kind": "材质开发机位",
    "note": "参考更像崖缘斜俯瞰，未证明1600m AGL；实景测试也须区分world-Y=1600与相对实际地面的AGL。两图不是同机位。",
    "scale": "明确AGL / 全盆地"
  },
  {
    "id": "11",
    "title": "轨道整体",
    "ref": "11-orbit.png",
    "actual": "godot/reports/terrain-r3-material/orbit.png",
    "kind": "材质开发机位",
    "note": "亮线消失属于渲染修复，不证明大陆、河网或盆地比例还原；原天空保留约束与参考差别另列。",
    "scale": "整球"
  },
  {
    "id": "12-cold",
    "title": "冷裂谷（参考左上）",
    "ref": "12-special-regions.png",
    "actual": "docs/development/planet-regions-r3-cold.png",
    "kind": "局部地质测试机位",
    "note": "当前展示局部薄片/冰挂，尚不能证明整条冷裂谷轮廓；带状边缘、覆冰厚度和破裂层次仍不足。",
    "scale": "局部 / 完整裂谷"
  },
  {
    "id": "12-volcanic",
    "title": "火山地热（参考右上）",
    "ref": "12-special-regions.png",
    "actual": "docs/development/planet-regions-r3-volcanic.png",
    "kind": "早期局部地质测试机位",
    "note": "这是共享材质霓虹曲线移除前的历史截图，保留以揭示差距，不代表当前背景材质。岩口/冷却面仍未形成参考的火山与洞口整体。",
    "scale": "岩口 / 流沟 / 火山群"
  },
  {
    "id": "12-crystal",
    "title": "镜晶峡谷（参考左下）",
    "ref": "12-special-regions.png",
    "note": "本页缺对应完整峡谷实景。资产展台晶体不能证明峡谷轮廓、晶脉嵌岩或沿谷分布。",
    "scale": "嵌接 / 峡谷"
  },
  {
    "id": "12-storm",
    "title": "雷暴高原（参考右下）",
    "ref": "12-special-regions.png",
    "note": "本页缺对应高原实景。浮岩单体不等于高原、深裂隙和浮岩群形成完整空间关系。",
    "scale": "浮岩 / 跨裂隙 / 高原"
  }
];
fs.mkdirSync(dest,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const c of cards){
 c.referenceSHA256=hash(path.join(base,c.ref)); c.sameView=false;c.runtimeSourceSHA256AtCapture=null;
 if(c.actual){const source=path.join(root,c.actual);c.snapshot='qa/audit-r4/'+c.id+'.png';fs.copyFileSync(source,path.join(base,c.snapshot));c.sourceMtimeUTC=fs.statSync(source).mtime.toISOString();c.actualSHA256=hash(source);if(hash(path.join(base,c.snapshot))!==c.actualSHA256)throw Error('copy mismatch');}
}
const manifest={createdUTC:new Date().toISOString(),scope:'Image audit only; no runtime edits, no new image generation',decision:'art_acceptance_failed',sameViewPairs:0,unknownRuntimeSHA:'Development screenshots did not record runtime source SHA at capture; do not retroactively invent it.',cards};
fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2));
const style=':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#111720;color:#edf2f6;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1440px;margin:auto;padding:28px 22px}h1{font-size:clamp(24px,4vw,36px);line-height:1.3}h2{font-size:23px;margin:0 0 6px}p{margin:8px 0 14px}a{color:#8bcdfa;overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:12px 22px;margin:20px 0}article{background:#1b2430;border:1px solid #364356;border-radius:12px;padding:20px;margin:24px 0}.badge{display:inline-block;color:#ffd2bb;background:#5a3025;border-radius:6px;padding:4px 10px;font-weight:650;margin:4px 0 14px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{min-width:0;margin:0}figcaption{padding:8px 0;color:#c1d4e4}img{display:block;width:100%;height:360px;object-fit:contain;background:#0a1017}.missing{min-height:160px;display:grid;place-items:center;text-align:center;border:1px dashed #99a8bb;padding:24px;background:#131c27}.link{display:inline-block;padding:8px 0;min-height:40px}.note{color:#ffe2b5}small{color:#b0bfd0}footer{margin:24px 0}@media(max-width:700px){main{padding:18px 12px}.pair{grid-template-columns:minmax(0,1fr)}article{padding:14px}img{height:auto;max-height:380px}}';
const body=cards.map(c=>'<article id="p'+c.id+'"><h2>'+esc(c.id+' · '+c.title)+'</h2><p><small>观察尺度：'+esc(c.scale)+'</small></p><div class="badge">'+(c.actual?'非同机位 · 仅差距诊断':'缺证 · 不予判定通过')+'</div><div class="pair"><figure><figcaption>设计参考｜生成概念图，不是游戏截图</figcaption><a href="'+c.ref+'" target="_blank"><img loading="lazy" src="'+c.ref+'" alt="'+esc(c.title)+'的原始设计参考"></a><a class="link" href="'+c.ref+'" target="_blank">打开原始参考图 ↗</a></figure><figure><figcaption>实际实现｜'+esc(c.kind||'缺对应机位截图')+'</figcaption>'+(c.actual?'<a href="'+c.snapshot+'" target="_blank"><img loading="lazy" src="'+c.snapshot+'" alt="'+esc(c.title)+'的开发截图，非同机位"></a><a class="link" href="'+c.snapshot+'" target="_blank">打开原始实景截图 ↗</a>':'<div class="missing">缺少对应实景<br>不以概念图、资产展台或其他地貌替代</div>')+'</figure></div><p class="note">'+esc(c.note)+'</p></article>').join('\n');
const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>地形 R4｜参考与实景差异审查</title><style>'+style+'</style></head><body><main><h1>地形 R4 · 参考与实景差异审查</h1><p><strong>整体美术还原未通过。</strong> 本页展示差距，所有现有图对均未建立同一相机。技术测试和性能结果不代表“按图完成”。</p><p>已知参考缺相机元数据，开发截图缺运行版本随图记录。后续验收必须固定同一地理与相机，记录源码SHA和相机JSON，交同视角并排原图。</p><nav><a href="AUDIT-R4.md">地貌区别与验收规范</a><a href="index.html">全部12张设计原图</a><a href="qa/audit-r4/manifest.json">来源、SHA与缺证清单</a></nav>'+body+'<footer>本页没有生成新图或更改生产地图。实景文件逐字节留存；历史火山截图已明确标注版本局限。</footer></main></body></html>';
fs.writeFileSync(path.join(base,'COMPARISON.html'),html);
console.log(JSON.stringify({cards:cards.length,actual:cards.filter(c=>c.actual).length,sameView:0,decision:manifest.decision}));

