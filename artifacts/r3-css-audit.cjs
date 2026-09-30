const fs=require('fs');console.log(fs.readFileSync('playable/css/game.css','utf8').match(/[^{}]*\{[^{}]*backdrop-filter[^{}]*\}/g));
const bundle=fs.readFileSync('playable/game.js','utf8');let p=bundle.indexOf('.info.reset()');console.log(bundle.slice(p-200,p+400));
