const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const source = 'E:/myProject/star-abyss-game';
const rows = [];
for (const version of ['A-R2', 'B-R1', 'C-R2']) {
  const manifest = JSON.parse(fs.readFileSync(`${source}/docs/development/versions/INTEGRATED-${version}.json`));
  for (const file of manifest.files) {
    const relative = path.relative(source, file.target).replaceAll('\\', '/');
    const bytes = fs.readFileSync(file.target);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== file.sha256) throw Error(`Source mismatch: ${relative}`);
    if (!/^playable\/src\/(d3-combat|d3-inventory|world-director)\//.test(relative)) continue;
    const target = path.join(root, relative);
    if (!fs.existsSync(target)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); }
    if (!fs.readFileSync(target).equals(bytes)) throw Error(`Dependency mismatch: ${relative}`);
    rows.push({ relative, sha256 });
  }
}
console.log(JSON.stringify(rows, null, 2));
