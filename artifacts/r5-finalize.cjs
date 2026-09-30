const fs=require('fs'),path=require('path');
for(const folder of ['r5-baseline','r5-candidate']){
  const file=path.resolve('artifacts',folder,'report.json');if(!fs.existsSync(file))continue;
  const r=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const run of r.runs){
    for(const s of run.samples){if(s.agl==null){const m=s.hud?.match(/离地\s*([\d,]+)\s*\//);s.agl=m?Number(m[1].replace(/,/g,'')):null;}}
    const a=run.samples,ys=a.map(s=>s.y),deltas=ys.slice(1).map((y,i)=>y-ys[i]);
    run.position={startY:ys[0],endY:ys.at(-1),drop:ys[0]-ys.at(-1),upwardSteps:deltas.filter(v=>v>.1).length,plateaus:deltas.filter(v=>Math.abs(v)<.05).length,largestDownStep:Math.min(0,...deltas),largestUpStep:Math.max(0,...deltas)};
    run.durationSeconds=(a.at(-1).time-a[0].time)/1000;
    run.descentMetersPerSecond=run.position.drop/run.durationSeconds;
    run.frame.over33Fraction=run.frame.over33/run.frame.count;
    run.frame.over33PerSecond=run.frame.over33/run.durationSeconds;
    const near=a.find(s=>s.agl!=null&&s.agl<=30);run.nearGroundSeconds=near?(a.at(-1).time-near.time)/1000:null;
    if(run.released)run.releaseHover={verticalSpeed:run.released.verticalSpeed,active:run.released.active,agl:run.released.agl};
  }
  r.measurementNotes='Duration is first-to-last 0.5s sample time (up to 0.5s longer than exact landing); frame time is rAF interval with page snapshots and two screenshots included. HUD AGL is rounded. terrain.pending is not exposed in the public test snapshot. CDP profiling is separate.';
  fs.writeFileSync(file,JSON.stringify(r,null,2));
  console.log(JSON.stringify({folder,complete:r.complete,bundleSHA:r.bundleSHA,runs:r.runs.map(x=>({name:x.name,durationSeconds:x.durationSeconds,nearGroundSeconds:x.nearGroundSeconds,drop:x.position.drop,upwardSteps:x.position.upwardSteps,over33Fraction:x.frame.over33Fraction,over33PerSecond:x.frame.over33PerSecond,releaseHover:x.releaseHover}))}));
}
