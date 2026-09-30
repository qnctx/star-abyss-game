const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'artifacts/tests/phase1-geology');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const build = await esbuild.build({ stdin: { contents: `
    import * as THREE from 'three';
    import { enhanceTerrainMaterial } from './playable/src/phase1-geology.mjs';
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(960,640); renderer.setClearColor('#171123');
    document.body.style.margin='0'; document.body.append(renderer.domElement);
    let shaderErrors=[];
    renderer.debug.onShaderError = (gl,program,vs,fs) => shaderErrors.push(gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(vs)+' '+gl.getShaderInfoLog(fs));
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#b7bad5','#342530',1.8));
    const light = new THREE.DirectionalLight('#ecccd2',2.1); light.position.set(-15,20,8);scene.add(light);
    const geo = new THREE.PlaneGeometry(90,90,220,220);geo.rotateX(-Math.PI/2);
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,12*Math.exp(-((x+12)**2)/52)*Math.exp(-z*z/1300)+7*Math.exp(-((x-18)**2+(z+7)**2)/100));}
    geo.computeVertexNormals();
    const colors=new Float32Array(p.count*3);colors.fill(.8);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const texture=new THREE.DataTexture(new Uint8Array([220,220,220,255]),1,1);texture.needsUpdate=true;
    let textureLoaded=false;THREE.DefaultLoadingManager.onLoad=()=>{textureLoaded=true;};
    const material = enhanceTerrainMaterial(new THREE.MeshStandardMaterial({color:'#716a76',roughness:1,metalness:.12,vertexColors:true,map:texture}));
    const same = enhanceTerrainMaterial(material)===material;
    scene.add(new THREE.Mesh(geo,material));
    const camera = new THREE.PerspectiveCamera(58,960/640,.1,300);camera.position.set(22,13,27);camera.lookAt(-6,5,0);
    // Compile/render all shader variants the scene integration can use.
    function frame(){renderer.render(scene,camera);if(textureLoaded){window.geologyTest={same,shaderErrors,programs:renderer.info.programs.length,drawCalls:renderer.info.render.calls,textureLoaded};}else requestAnimationFrame(frame);}
    frame();
  `, resolveDir: root }, bundle: true, format: 'iife', write: false });
  const js = build.outputFiles[0].text;
  const server = http.createServer((req,res) => {
    if(req.url==='/assets/environments/phase1/basalt-albedo.png'){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(path.join(root,'playable/assets/environments/phase1/basalt-albedo.png')));}
    else if(req.url==='/test.js'){res.setHeader('Content-Type','application/javascript');res.end(js);}
    else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><body><script src="/test.js"></script></body>');}
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
    const page = await browser.newPage({viewport:{width:960,height:640}});
    const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error(String(e));});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>window.geologyTest);
    const result=await page.evaluate(()=>window.geologyTest);
    assert.equal(errors.length,0);assert.equal(result.shaderErrors.length,0);assert.equal(result.same,true);assert.equal(result.drawCalls,1);assert.ok(result.programs>=1);
    await page.screenshot({path:path.join(output,'terrain-surface.png')});
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({status:'PASS',...result,errors},null,2));
    console.log(JSON.stringify({status:'PASS',...result,errors}));
  } finally { if(browser)await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
