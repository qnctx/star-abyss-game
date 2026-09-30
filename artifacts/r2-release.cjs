const fs=require('fs'),p=require('path'),crypto=require('crypto');
const baseline=JSON.parse(fs.readFileSync('artifacts/playtest-r2-deployment-baseline.json'));
const destination=baseline.root,source=process.cwd();
const sha=file=>fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null;
const walk=d=>fs.existsSync(p.join(source,d))?fs.readdirSync(p.join(source,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]):[];
const docs=['CONTROLLER-TAKEOVER-R2','USER-PLAYTEST-R2-IMPLEMENTATION','PERFORMANCE-PLAYTEST-R2','PLAYABILITY-STATUS','CAMP-BLENDER-R2','FLIGHT-R2','FLIGHT-ART-R2','NPC-DIALOG-R2','NPC-ACTIVITY-ART-R2','FLIGHT-HUD-R2','CAMP-V2-R2'].map(n=>'docs/development/'+n+'.md');
const files=[...walk('playable/src').filter(f=>f.endsWith('.mjs')&&!f.endsWith('.test.mjs')), ...walk('playable/css'),...['playable/assets/camp-v2','playable/assets/flight-r2'].flatMap(walk).filter(f=>/\.(glb|blend|json|mjs)$/.test(f)),...['docs/art/camp-v2','docs/art/flight-r2','tools/art/camp-v2','tools/art/flight-r2'].flatMap(walk).filter(f=>!f.endsWith('.log')&&!f.includes('__pycache__')), ...docs.filter(f=>fs.existsSync(f)),'playable/game.js','playable/checkpoint-worker.js'];
files.push(...(baseline.testFiles||[]));
files.push('docs/development/TERRAIN-STREAM-R2.md','docs/development/reports/R2-BROWSER-ACCEPTANCE.md','docs/development/reports/R2-INDEPENDENT-REVIEW.md');
const rows=[...new Set(files)].map(file=>({file,sourceSHA:sha(p.join(source,file)),destinationSHA:sha(p.join(destination,file)),baseline:baseline.hashes[file]??null})).filter(r=>r.sourceSHA!==r.destinationSHA);
for(const r of rows){r.conflict=r.destinationSHA!==r.baseline; if(r.file.startsWith('docs/')||r.file.startsWith('tools/'))r.conflict=r.destinationSHA!==null;}
const manifest={at:new Date().toISOString(),source,destination,files:rows};fs.writeFileSync('artifacts/r2-release-candidate.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({files:rows.length,conflicts:rows.filter(r=>r.conflict).map(r=>r.file),runtime:rows.filter(r=>r.file.startsWith('playable/src/')||r.file.endsWith('game.js')).map(r=>r.file)},null,2));
if(!process.argv.includes('--publish'))process.exit(0);
if(rows.some(r=>r.conflict))throw Error('Deployment conflict; no writes');
const build=JSON.parse(fs.readFileSync('artifacts/r2-build-inputs.json'));
if(build.bundleSHA!==sha('playable/game.js'))throw Error('Bundle changed since validated build');
for(const [file,hash]of Object.entries(build.hashes))if(sha(file)!==hash)throw Error('Source changed since build: '+file);
for(const file of ['artifacts/r2-integrated-browser/report.json','artifacts/r2-candidate-performance/report.json','artifacts/r2-browser-hud-final/report.json']){const evidence=JSON.parse(fs.readFileSync(file));if(!evidence.complete||evidence.bundleSHA!==build.bundleSHA||evidence.errors?.length)throw Error('Required evidence incomplete, has errors or wrong bundle: '+file);}
const backup=p.resolve('artifacts/r2-release-backup-'+Date.now());fs.mkdirSync(backup,{recursive:true});
for(const r of rows){if(sha(p.join(source,r.file))!==r.sourceSHA||sha(p.join(destination,r.file))!==r.destinationSHA)throw Error('File changed since preflight: '+r.file);if(r.destinationSHA){const b=p.join(backup,r.file);fs.mkdirSync(p.dirname(b),{recursive:true});fs.copyFileSync(p.join(destination,r.file),b);}}
const written=[];try{for(const r of rows){const target=p.resolve(destination,r.file);if(!target.startsWith(p.resolve(destination)+p.sep))throw Error('Path outside destination');if(sha(target)!==r.destinationSHA)throw Error('Destination changed: '+r.file);fs.mkdirSync(p.dirname(target),{recursive:true});fs.copyFileSync(p.join(source,r.file),target);written.push(r);if(sha(target)!==r.sourceSHA)throw Error('Copy verification failed: '+r.file);}}
catch(error){for(const r of written.reverse()){const target=p.resolve(destination,r.file);if(sha(target)!==r.sourceSHA)continue;if(r.destinationSHA)fs.copyFileSync(p.join(backup,r.file),target);else fs.unlinkSync(target);}throw error;}
manifest.backup=backup;manifest.published=new Date().toISOString();fs.writeFileSync('artifacts/r2-published.json',JSON.stringify(manifest,null,2));console.log('Published '+rows.length+' files; rollback backup '+backup);
