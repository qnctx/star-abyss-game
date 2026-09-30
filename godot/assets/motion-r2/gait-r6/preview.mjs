import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#load-status');
const summary = document.querySelector('#playback-summary');
const playButton = document.querySelector('#toggle-play');
const motionButtons = [...document.querySelectorAll('[data-motion]')];
const viewButtons = [...document.querySelectorAll('[data-view]')];
const gaits = {
  walk: { label: '自然步行', speed: 1.6, stride: 1.4 },
  jog: { label: '跑步', speed: 6.8, stride: 4.0 },
  sprint: { label: '加速跑', speed: 10.0, stride: 4.6 },
};

let renderer;
let mixer;
let actions;
let activeAction;
let activeMotion = 'walk';
let paused = false;
let ready = false;

function showError(error) {
  ready = false;
  status.hidden = false;
  status.dataset.error = 'true';
  status.setAttribute('role', 'alert');
  status.textContent = `无法加载 3D 预览：${error?.message || String(error)}。请确认从项目本地 HTTP 服务打开本页，且 C2 模型和 Three.js 文件可访问。`;
  motionButtons.forEach((button) => { button.disabled = true; });
  playButton.disabled = true;
  summary.textContent = '加载失败，请查看上方原因。';
  console.error('C2 gait preview:', error);
}

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', '可拖动环视的 C2 角色动作');
  stage.append(renderer.domElement);
} catch (error) {
  showError(error);
}

if (renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#23343d');
  scene.fog = new THREE.Fog('#23343d', 8, 18);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 40);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.87, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 1.7;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.enablePan = false;

  const hemisphere = new THREE.HemisphereLight(0xd8e9f4, 0x62605c, 2.0);
  scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xfff0d5, 3.5);
  key.position.set(-3.5, 5, -3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.2;
  key.shadow.camera.right = 2.2;
  key.shadow.camera.top = 2.2;
  key.shadow.camera.bottom = -2.2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.normalBias = 0.003;
  key.shadow.bias = -0.00005;
  key.target.position.set(0, 0.75, 0);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xb8daee, 1.1);
  rim.position.set(2, 3, 3);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x344952, roughness: 0.95, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(20, 80, 0x536a73, 0x3d535e);
  grid.position.y = 0.0002;
  grid.material.transparent = true;
  grid.material.opacity = 0.4;
  scene.add(grid);

  function setView(view) {
    // The original C2 asset faces -Z. Camera labels follow that real axis.
    const positions = {
      side: [3.55, 1.04, 0],
      front: [0, 1.04, -3.55],
      back: [0, 1.04, 3.55],
    };
    controls.reset();
    controls.target.set(0, 0.87, 0);
    camera.position.set(...positions[view]);
    camera.lookAt(controls.target);
    controls.update();
    viewButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.view === view));
    });
  }
  viewButtons.forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  controls.addEventListener('start', () => {
    viewButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
  });
  setView('side');

  function updatePlaybackText() {
    const gait = gaits[activeMotion];
    summary.textContent = `${gait.label} · ${gait.speed.toFixed(1)} m/s 对应节奏 · ${paused ? '已暂停' : '正常速度播放'}`;
    playButton.textContent = paused ? '播放' : '暂停';
    playButton.setAttribute('aria-pressed', String(paused));
  }

  function selectMotion(name) {
    if (!ready || !actions[name]) return;
    if (activeAction) activeAction.stop();
    activeMotion = name;
    activeAction = actions[name];
    const gait = gaits[name];
    activeAction.reset();
    activeAction.setLoop(THREE.LoopRepeat, Infinity);
    // Match the gameplay cadence exactly despite integral source-frame lengths.
    activeAction.setEffectiveTimeScale(activeAction.getClip().duration * gait.speed / gait.stride);
    activeAction.setEffectiveWeight(1);
    activeAction.play();
    mixer.update(0);
    motionButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.motion === name));
    });
    updatePlaybackText();
  }
  motionButtons.forEach((button) => {
    button.addEventListener('click', () => selectMotion(button.dataset.motion));
  });
  playButton.addEventListener('click', () => {
    if (!ready) return;
    paused = !paused;
    updatePlaybackText();
  });

  const loader = new GLTFLoader();
  loader.load(
    new URL('../c2-motion-r2.glb', import.meta.url).href,
    (gltf) => {
      try {
        const model = gltf.scene;
        model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            // Keep the original geometry, materials, rest pose and skin intact.
            node.frustumCulled = false;
          }
        });
        mixer = new THREE.AnimationMixer(model);
        actions = {};
        for (const name of Object.keys(gaits)) {
          const clip = THREE.AnimationClip.findByName(gltf.animations, name);
          if (!clip || !(clip.duration > 0)) throw new Error(`模型缺少有效的 ${name} 动作片段`);
          actions[name] = mixer.clipAction(clip);
        }
        scene.add(model);
        ready = true;
        motionButtons.forEach((button) => { button.disabled = false; });
        playButton.disabled = false;
        status.hidden = true;
        selectMotion('walk');
      } catch (error) {
        showError(error);
      }
    },
    (progress) => {
      const loaded = (progress.loaded / (1024 * 1024)).toFixed(1);
      const total = progress.total ? ` / ${(progress.total / (1024 * 1024)).toFixed(1)}` : '';
      status.textContent = `正在加载真实 C2 角色与动作… ${loaded}${total} MB`;
    },
    showError,
  );

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();
  let previousTime;
  renderer.setAnimationLoop((time) => {
    const delta = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, 0.1);
    previousTime = time;
    if (ready && !paused) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
  });
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
  }, { once: true });
}
