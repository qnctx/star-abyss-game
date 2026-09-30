// Records image delivery metadata only; never loads or modifies game assets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const files = [
  ['01-walk.png', 'prompt-01-walk.txt', 'exec-eba9ad82-e279-4c3f-838d-a8da30f1d591.png'],
  ['02-alignment.png', 'prompt-02-alignment.txt', 'exec-79d3d3be-2073-477b-bce9-aad9ba855324.png'],
  ['03-jog.png', 'prompt-03-jog.txt', 'exec-127bf5de-e979-4a25-ac63-46c5058e297b.png'],
  ['04-acceleration.png', 'prompt-04-acceleration-final.txt', 'exec-815a4f85-41a1-4ddd-8b45-b311bbd7e393.png'],
];
const outputs = files.map(([file, prompt, source]) => {
  const data = fs.readFileSync(path.join(__dirname, file));
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Not PNG: ' + file);
  fs.readFileSync(path.join(__dirname, prompt), 'utf8');
  return {file, prompt, source, bytes: data.length, width: data.readUInt32BE(16), height: data.readUInt32BE(20), sha256: crypto.createHash('sha256').update(data).digest('hex'), approvedByUser: false};
});
const manifest = {date: '2026-09-29', tool: 'built-in image_gen', modelVersion: 'not exposed; image 2.5 not verified', calls: 4, callLimit: 4, scope: 'image design and review only', productionAllowed: false, identityReferences: ['artifacts/c2-lux3d-20260912-r2/references/front.png', 'artifacts/c2-lux3d-20260912-r2/references/left.png', 'artifacts/c2-lux3d-20260912-r2/references/back.png'], unusedPrompt: 'prompt-04-acceleration.txt (initial draft; never submitted)', outputs};
fs.writeFileSync(path.join(__dirname, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({calls: manifest.calls, outputs: outputs.map(({file, width, height, bytes}) => ({file, width, height, bytes})), status: 'FILES_RECORDED_NOT_ART_APPROVED'}, null, 2));
