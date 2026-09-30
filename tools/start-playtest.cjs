'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const url = 'http://127.0.0.1:4173/';
function listening() {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: 4173 });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}
(async () => {
  if (!await listening()) {
    const logs = path.join(root, 'artifacts', 'playtest-server');
    fs.mkdirSync(logs, { recursive: true });
    const out = fs.openSync(path.join(logs, 'server.log'), 'a');
    const child = spawn(process.execPath, [path.join(root, 'playable/tests/static-server.js')], {
      cwd: root, detached: true, windowsHide: true,
      env: { ...process.env, PORT: '4173' }, stdio: ['ignore', out, out],
    });
    child.unref();
    fs.closeSync(out);
    for (let i = 0; i < 20 && !await listening(); i++) await new Promise(r => setTimeout(r, 250));
  }
  const response = await fetch(url);
  if (!response.ok || !(await response.text()).includes('id="world"')) throw new Error('Game entry unavailable');
  console.log('Game ready: ' + url);
})().catch(error => { console.error(error); process.exitCode = 1; });
