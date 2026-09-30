const fs = require('node:fs');
const path = require('node:path');
const old = 'C:/Users/HUAWEI/.codex/worktrees/cb21/star-abyss-game';
const files = ['docs/development/PLAYABILITY-STATUS.md','docs/development/SEVEN-MODELS-R1.md','docs/development/LOCAL-PREVIEW-RECOVERY.md','docs/development/reports/TEST-NPC-MODELS-GPU-R1.md','artifacts/npc-r1-published.json'];
for (const file of files) {
  if (fs.existsSync(file)) { console.log('preserved '+file); continue; }
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.copyFileSync(path.join(old,file),file,fs.constants.COPYFILE_EXCL);
  console.log('restored '+file);
}
