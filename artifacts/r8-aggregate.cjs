const fs=require('fs'),path=require('path');
const base=path.resolve('artifacts'),out=path.join(base,'r8-candidate');fs.mkdirSync(out,{recursive:true});
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name,'report.json'),'utf8'));
const r6=read('r8-r6-final'),air=read('r8-air-check'),loot=read('r8-loot'),gallery=read('r8-gallery');
const sha=r6.bundleSHA;const errors=[...r6.errors,...air.errors,...loot.errors,...gallery.errors];
const report={at:new Date().toISOString(),bundleSHA:sha,galleryBundleSHA:gallery.bundleSHA,complete:false,errors,assertions:{},screenshots:[],sourceReports:{r6:'r8-r6-final-report.json',air:'r8-air-check-report.json',loot:'r8-loot-report.json',gallery:'r8-gallery-report.json'},notVerifiedInThisBrowserPass:[
 'G-only launch / ground Space jump / airborne Space idle were validated in the earlier R7 browser pass and this bundle CPU regression, but were not repeated in this R8 browser pass.',
 'R8/R9 Y short and long blink distances or their cooldowns; those are covered by CPU rules and the R6 browser check only.',
 'Out-of-zone attack rejection and all four F2 aiming targets; covered by CPU validation, not repeated as browser paths.',
 'All mobile game HUD widths; the gallery was checked at 390px and the game screenshots at 1440x900.'
]};
const a=report.assertions;
a.sameGameBundle=[r6.bundleSHA,loot.bundleSHA,...air.realms.map(x=>x.bundleSHA)].every(x=>x===sha);
a.r6CruiseVsBoost=r6.complete&&r6.boost.camera==='third'&&r6.boost.boostVisible===true&&r6.boost.meters>r6.cruise.meters*1.2;
a.r6ShortLongAndSave=r6.short.meters>11.9&&r6.short.meters<12.1&&r6.long.meters>59.9&&r6.long.meters<60.1&&r6.savedCooldown>0;
a.r8R9AirAttack=air.complete&&air.realms.every(x=>x.passed&&x.states.at(-1).simTime>x.states[0].simTime+1&&x.states.at(-1).enemies.some((e,i)=>e.hp<x.states[0].enemies[i].hp)&&x.states.at(-1).drops.some(d=>d.created));
a.r8EnemyCounter=loot.counter.hpAfter<loot.counter.hpBefore;
a.r8RealLandWalkLootSave=loot.complete&&loot.land.reached&&loot.walk.grounded&&loot.walk.finalDist<3.2&&loot.pickup.dropAfter<loot.pickup.dropBefore&&loot.saved.remaining===loot.pickup.dropAfter&&loot.saved.inventory.some(x=>x.name==='掠兽血液');
a.gallerySixRealModels=gallery.complete&&gallery.realms.length===6&&gallery.realms.every(x=>x.loaded&&x.meshes.length>0&&x.glbHTTP===200&&x.blendHTTP===200);
a.galleryNarrowNoPageOverflow=gallery.narrow.viewport===390&&gallery.narrow.scrollWidth===390;
const evidence=[['r8-r6-final','R6-third-person-boost.png'],['r8-r6-final','R6-long-preview.png'],['r8-air-check','R8-windup.png'],['r8-air-check','R8-strike.png'],['r8-air-check','R9-windup.png'],['r8-air-check','R9-strike.png'],['r8-loot','R8-landed.png'],['r8-loot','R8-loot-near.png'],['r8-gallery','R9-wide.png'],['r8-gallery','R9-narrow.png']];
for(const name of ['r8-r6-final','r8-air-check','r8-loot','r8-gallery'])fs.copyFileSync(path.join(base,name,'report.json'),path.join(out,`${name}-report.json`));
for(const [dir,file] of evidence){const dest=`${dir}-${file}`;fs.copyFileSync(path.join(base,dir,file),path.join(out,dest));report.screenshots.push(dest);}
report.complete=errors.length===0&&Object.values(a).every(Boolean);
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({bundleSHA:sha,complete:report.complete,assertions:a,screenshots:report.screenshots.length,errors}));if(!report.complete)process.exitCode=1;
