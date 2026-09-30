const fs=require('fs');
for(const file of ['artifacts/r2-candidate-performance/report.json','artifacts/r2-integrated-browser/report.json','artifacts/r2-browser-hud-final/report.json']){
 if(!fs.existsSync(file))continue;
 const r=JSON.parse(fs.readFileSync(file));
 console.log(JSON.stringify({file,complete:r.complete,bundleSHA:r.bundleSHA,failure:r.failure,scenarios:r.scenarios?.map(s=>({name:s.name,timing:s.timing,delta:s.delta,speed:s.after.planet.session.flight.speed})),checks:r.checks?.map(c=>({name:c.name,opened:c.opened,distance:c.distance,maxY:c.maxY,Q01Accepted:c.Q01Accepted,talkingMovement:c.talkingMovement}))},null,2));
}
