const fs = require('node:fs');
const profile = JSON.parse(fs.readFileSync('artifacts/r2-browser-third-person-attempt2/high-flight.cpuprofile'));
const lines = fs.readFileSync('playable/game.js','utf8').split(/\r?\n/);
console.log([...new Set(profile.nodes.map(n => n.callFrame.url))].filter(Boolean).slice(0,12));
for (const name of ['loaded','Q','o','k3','y']) {
  const nodes = profile.nodes.filter(n => n.callFrame.functionName === name);
  for (const node of nodes.slice(0,3)) {
    const {lineNumber, columnNumber} = node.callFrame;
    const line = lines[lineNumber] || '';
    console.log(JSON.stringify({name, line:lineNumber+1, column:columnNumber+1, text:line.slice(Math.max(0,columnNumber-100),columnNumber+300)}));
  }
}
const nodes = new Map(profile.nodes.map(node => [node.id, node]));
const parents = new Map();
for (const node of profile.nodes) for (const child of node.children || []) parents.set(child, node.id);
for (const node of profile.nodes.filter(node => node.callFrame.functionName === 'oc').slice(0,5)) {
  const chain = [];
  let id = node.id;
  while (id && chain.length < 16) {
    const frame = nodes.get(id)?.callFrame;
    if (!frame) break;
    chain.push(`${frame.functionName}@${frame.lineNumber + 1}`);
    id = parents.get(id);
  }
  console.log('chain', chain.join(' <- '));
}
