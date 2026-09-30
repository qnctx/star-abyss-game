const r=require('./r10-candidate/report.json');
for(const s of r.scenarios.mouseCombo.states){const e=s.enemies?.[0],p=s.player;console.log(s.label,'t',s.combat.time,'move',s.combat.move,'phase',s.combat.phase,'hp',e?.hp,'y',e?.y,'d',e&&p?Math.hypot(e.x-p.x,e.y-p.y,e.z-p.z).toFixed(2):'-','events',s.combat.events?.map(x=>x.kind).join(','));}
for(const label of ['left1-pose','after-buffer','left3-kick']){const s=r.scenarios.mouseCombo.states.find(x=>x.label===label);console.log(label,JSON.stringify(s.avatar.melee));}
const b=r.scenarios.flightBank.samples;
for(const label of ['shiftA','shiftD','shiftWA','shiftWD']){const v=b.filter(x=>x.label===label&&x.elapsed>=1000),a=v.map(x=>x.flight.turnBank);console.log(label,'bank',Math.min(...a).toFixed(3),Math.max(...a).toFixed(3),'last',a.at(-1).toFixed(3),'boostAll',v.every(x=>x.flight.boosting));}
for(const label of ['WA-release-immediate','WA-release','WD-release-immediate','WD-release'])console.log(label,b.filter(x=>x.label===label).map(x=>x.flight.turnBank.toFixed(3)).join(','));
console.log('frameStats',r.scenarios.flightBank.frameStats);
