const fs = require('node:fs');
const path = require('node:path');

function discoverCpuTests(root) {
  const files = [];
  function visit(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), {withFileTypes:true})) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(name);
      else if (/\.test\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(name);
    }
  }
  for (const directory of ['playable/tests', 'playable/src', 'tools']) visit(directory);
  return files.sort();
}
module.exports = {discoverCpuTests};
