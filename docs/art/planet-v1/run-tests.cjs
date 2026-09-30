const path=require('node:path');
const donor=path.resolve(process.argv[2]||process.cwd());
const result=require('node:child_process').spawnSync(process.execPath,['--test',path.resolve(__dirname,'../../../playable/tests/planet-art.test.mjs')],{stdio:'inherit',env:{...process.env,THREE_ROOT:path.join(donor,'node_modules/three')}});
process.exitCode=result.status??1;
