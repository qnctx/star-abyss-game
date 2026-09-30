require('esbuild').buildSync({entryPoints:['playable/src/performance/checkpoint-worker.mjs'],bundle:true,format:'iife',target:'chrome105',minify:true,outfile:'playable/checkpoint-worker.js'});
