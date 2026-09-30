const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {discoverCpuTests} = require('./cpu-test-files.cjs');
const root = path.resolve(__dirname, '..');
const files = discoverCpuTests(root);
if (!files.length) throw Error('No CPU tests discovered');
console.log(`CPU test files: ${files.length}`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...files], {
  cwd:root, stdio:'inherit', windowsHide:true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
