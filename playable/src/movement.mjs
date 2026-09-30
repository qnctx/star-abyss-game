import { WORLD, collides, collidesAtHeight, terrainHeight, surfaceAt, WALLS, GATE } from './layout.mjs';
import {POSTURES,setPosture} from './tactical-control.mjs';

export function createPlayer() { return { ...WORLD.spawn, heading: 0, yaw: 0, pitch: 0, vx: 0, vz: 0 }; }
// Physical forward is independent from the camera. Legacy callers and saves
// without heading retain their last valid yaw until they are migrated.
export function movementHeading(player) { return Number.isFinite(player.heading) ? player.heading : Number.isFinite(player.yaw) ? player.yaw : 0; }
export function turnPlayerHeading(player, input, delta, { mounted = false } = {}) {
  if (mounted) return 0;
  const turn = Number(!!input.turnLeft) - Number(!!input.turnRight);
  const amount = turn * 1.65 * Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, .05));
  player.heading = (movementHeading(player) + amount) % (Math.PI * 2);
  // Keyboard turning carries the camera, preserving the user's free-look offset.
  player.yaw = ((Number.isFinite(player.yaw) ? player.yaw : player.heading - amount) + amount) % (Math.PI * 2);
  return amount;
}
export function movePlayer(player, input, delta, gateOpen = false, options = {}) {
  const dt = Math.max(0, Math.min(delta, .05));
  const forward = Number(input.forward || 0) - Number(input.backward || 0);
  const side = Number(input.right || 0) - Number(input.left || 0);
  const length = Math.hypot(forward, side) || 1;
  const posture=input.posture||player.posture||'stand';
  const sprinting = !!input.sprint && forward > 0 && !input.walk && posture==='stand';
  const frontSpeed = input.walk ? 1.65 : 4.7;
  const sideSpeed = input.walk ? 1.3 : input.tactical?3.2:2.4;
  const backSpeed = input.walk ? 1.2 : input.tactical?2.8:2.2;
  // Blend by direction, not input magnitude: diagonals cannot add speed.
  // Side steps and backward steps retain a human walking cadence, even if an
  // external caller accidentally supplies sprint without forward intent.
  const forwardWeight = forward * forward / (length * length);
  const directionalSpeed = sideSpeed + ((forward < 0 ? backSpeed : frontSpeed) - sideSpeed) * forwardWeight;
  const speed = (options.speed ?? (sprinting ? (input.tactical?6.3:8.6) : directionalSpeed*(POSTURES[posture]?.speed??1))) * Math.max(0,Math.min(1,input.actionSpeed??1));
  const heading = movementHeading(player);
  const tx = (-Math.sin(heading) * forward + Math.cos(heading) * side) / length * speed;
  const tz = (-Math.cos(heading) * forward - Math.sin(heading) * side) / length * speed;
  const reversing=player.vx*tx+player.vz*tz<0;
  const response=input.tactical?(forward||side?reversing?16:10:20):(forward||side?13:22);
  const blend = 1 - Math.exp(-dt * (options.acceleration ?? response));
  player.vx += (tx - player.vx) * blend;
  player.vz += (tz - player.vz) * blend;
  const oldX = player.x, oldZ = player.z;
  let blocked=false;
  const x = player.x + player.vx * dt;
  const blockedAt = options.collides || ((x,z) => collides(x,z,gateOpen));
  if (!blockedAt(x, player.z)) player.x = x; else { blocked ||= Math.abs(x-player.x)>.00001; player.vx = 0; }
  const z = player.z + player.vz * dt;
  if (!blockedAt(player.x, z)) player.z = z; else { blocked ||= Math.abs(z-player.z)>.00001; player.vz = 0; }
  const distance = Math.hypot(player.x - oldX, player.z - oldZ);
  return { distance, moving: distance > .0005, sprinting: sprinting && distance > .0005, blocked, surface:surfaceAt(player.x,player.z) };
}
export function eyePosition(player) { return { x: player.x, y: (Number.isFinite(player.y) ? player.y : terrainHeight(player.x, player.z)) + (player.eyeHeight??WORLD.eyeHeight), z: player.z }; }
export function restorePlayer(raw, gateOpen = false) {
  const p = createPlayer();
  if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.z)) return p;
  const ground=terrainHeight(raw.x,raw.z), elevated=Number.isFinite(raw.y)&&raw.y>ground+.05&&raw.y<=ground+WORLD.suitAltitude;
  if (elevated ? collidesAtHeight(raw.x,raw.z,raw.y,gateOpen) : collides(raw.x,raw.z,gateOpen)) return p;
  // A corrupt save must not place the player behind the still-locked seal.
  if (!gateOpen && Math.abs(raw.x) < 48 && raw.z < -711 && raw.z > -790) return p;
  p.x = raw.x; p.z = raw.z;
  if(elevated)p.y=raw.y;
  if (Number.isFinite(raw.yaw)) p.yaw = raw.yaw % (Math.PI * 2);
  p.heading = Number.isFinite(raw.heading) ? raw.heading % (Math.PI * 2) : p.yaw;
  if (Number.isFinite(raw.pitch)) p.pitch = Math.max(-1.35, Math.min(1.35, raw.pitch));
  if(raw.posture&&raw.posture!=='stand')setPosture(p,raw.posture,{gateOpen,airborne:elevated});
  return p;
}
export function hasLineOfSight(from, to, gateOpen) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.ceil(distance / .35);
  const solids = gateOpen ? WALLS : [...WALLS, GATE];
  for (let i = 1; i < steps; i++) {
    const x = from.x + (to.x - from.x) * i / steps, z = from.z + (to.z - from.z) * i / steps;
    if (solids.some(b => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2)) return false;
  }
  return true;
}
