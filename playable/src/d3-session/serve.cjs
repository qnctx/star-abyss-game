const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'POST' && url.pathname === '/d3-session/evidence') {
    let data = ''; req.on('data', chunk => { data += chunk; if(data.length > 5000000) req.destroy(); });
    req.on('end', () => { try { JSON.parse(data); fs.writeFileSync(path.join(__dirname, 'browser-evidence.json'), data); res.end('saved'); } catch { res.writeHead(400); res.end(); } }); return;
  }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  const target = path.resolve(base, '.' + decodeURIComponent(url.pathname));
  if (!target.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(target, (err, bytes) => {
    if(err) {res.writeHead(404);res.end('not found');return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json'})[path.extname(target)] || 'text/plain');res.end(bytes);
  });
});
server.listen(4177,'127.0.0.1',()=>console.log('DEV-I verifier: http://127.0.0.1:4177/d3-session/verify.html'));
