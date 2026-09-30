// Exact guarded substitutions; run only in the integration checkout.
const fs=require('fs');
const edits={
 'package.json':[
  ['--outfile=playable/game.js"','--outfile=playable/game.js && node tools/build-performance-worker.cjs"']
 ],
 'playable/src/scene.mjs':[
  ["createRenderBudget, sampleRenderBudget", "createRenderBudget, sampleRenderBudget, recordRenderWork"],
  ['  function update(view) {','  function update(view) {\n    const updateCpuStart=performance.now();'],
  ['    try{\n      renderer.info.reset();', '    recordRenderWork(renderBudget,(view.simulationCpuMs||0)+performance.now()-updateCpuStart);\n    try{\n      renderer.info.reset();']
 ],
 'playable/src/main.mjs':[
  ['expeditionRuntime?.busy||expeditionRuntime?.defeated','(expeditionRuntime?.blocking??expeditionRuntime?.busy)||expeditionRuntime?.defeated'],
  ['function frame(now) {','function frame(now) {\n  const simulationCpuStart=performance.now();'],
  ['world.update({ player:viewPlayer,','world.update({ simulationCpuMs:performance.now()-simulationCpuStart,player:viewPlayer,']
 ],
 'playable/src/planet-runtime.mjs':[
  ['function stream(position,force=false) {\n    if(!force&&lastStream&&Math.hypot(position.x-lastStream.x,position.y-lastStream.y,position.z-lastStream.z)<24)return;\n    terrain.update(position);lastStream={...position};heightCache.clear();epoch++;\n  }',
   'function stream(position,force=false,pump=false) {\n    if(!force&&!pump)return; // only one normal pump in updateScene, never per simulation substep\n    if(!force&&!terrain.pending&&lastStream&&Math.hypot(position.x-lastStream.x,position.y-lastStream.y,position.z-lastStream.z)<24)return;\n    const revision=terrain.revision;terrain.update(position,force?{}:{budgetMs:3,maxLoads:1});lastStream={...position};\n    if(terrain.revision!==revision){heightCache.clear();epoch++;}\n  }'],
  ['syncGround();stream(session.flight.position);const {camera,scene}=objects;', 'syncGround();stream(session.flight.position,false,true);const {camera,scene}=objects;']
 ]
};
const staged=[];
for(const [path,replacements]of Object.entries(edits)){let source=fs.readFileSync(path,'utf8');for(const [before,after]of replacements){if(source.split(before).length!==2)throw Error('Expected one anchor: '+path+' '+before);source=source.replace(before,after);}staged.push([path,source]);}
if(process.argv.includes('--apply'))for(const [path,source]of staged)fs.writeFileSync(path,source);
else console.log('Verified all anchors. Pass --apply to integrate. Also build playable/checkpoint-worker.js with esbuild.');
