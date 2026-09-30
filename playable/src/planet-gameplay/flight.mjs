import { BLINK_RULES, blinkRules, realmFlightRules } from './ascension-rules.mjs';

export const FLIGHT_RULES = Object.freeze({ maxStep: .05, clearance: .42, energy: 100, launchEnergy: 25, maxAgl:2000,
  drain: .03, boostDrain: 1.5, boostMinEnergy: 10, boostAcceleration: 300, recovery: .8, acceleration: 165,
  steeringAcceleration: 900, maxTurnRate: 1.8, braking: 420, knockbackMaxStep: 12,
  nearSpeed: 48, cruiseSpeed: 420, nearClimb: 24, cruiseClimb: 90,
  descent: 65, descentBraking: 6, verticalAcceleration: 90, verticalBraking: 220 });
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const validPosition = p => !!p && ['x', 'y', 'z'].every(k => Number.isFinite(p[k]));
export function validSample(s) {
  return s?.ready === true && Number.isFinite(s.altitude) && Number.isFinite(s.agl) && Number.isFinite(s.waterDepth);
}
export function validateWorld(world) {
  if (!world || !Number.isFinite(world.radius) || world.radius <= 0 || typeof world.id !== 'string' || !world.id ||
      !['sample', 'advance', 'sweep'].every(k => typeof world[k] === 'function')) throw new TypeError('Planet world adapter required');
}
export function createFlight(position) {
  if (!validPosition(position)) throw new TypeError('Canonical position required');
  return { position: { ...position }, energy: 100, active: false, liftHeld: false, speed: 0, verticalSpeed: 0, turnBank: 0, boosting: false,
    abilityTime: 0, blinkCooldownUntil: 0, blinkSerial: 0 };
}
// AGL controls terrain safety; sea-level altitude controls continental/whole-globe view.
// radius is owned by the architecture task, never silently inferred from WORLD.radius (avatar collision radius).
export function flightEnvelope(sample, radius, { realm = 4, boost = false } = {}) {
  if (!validSample(sample) || !Number.isFinite(radius) || radius <= 0) throw new TypeError('Valid surface sample/radius required');
  const t = smooth(0, 350, sample.agl);
  const rank = realmFlightRules(realm);
  return {speed:mix(FLIGHT_RULES.nearSpeed,boost ? rank.boost : rank.cruise,t),climb:mix(FLIGHT_RULES.nearClimb,FLIGHT_RULES.cruiseClimb,t),
    // Comfortable braking distance v²/(2a) replaces the slow linear tail.
    descent:Math.min(FLIGHT_RULES.descent,Math.max(2,Math.sqrt(2*FLIGHT_RULES.descentBraking*Math.max(0,sample.agl)))),acceleration:boost ? FLIGHT_RULES.boostAcceleration : FLIGHT_RULES.acceleration,
    verticalAcceleration:FLIGHT_RULES.verticalAcceleration,orbital:0,ceiling:FLIGHT_RULES.maxAgl};
}
export function cameraEnvelope(sample, radius) {
  const env = flightEnvelope(sample, radius), altitude = Math.max(0, sample.altitude);
  const continent = smooth(radius * .015, radius * .18, altitude);
  const globe = smooth(radius * .3, radius * 1.8, altitude);
  const horizon = Math.sqrt(altitude * (2 * radius + altitude));
  return { continent, globe, distance: mix(4.8, 6.2, smooth(10, 350, sample.agl)),
    fov: mix(68, 52, globe), near: mix(.05, .45, smooth(100, 2000, sample.agl)),
    far: Math.max(2000, horizon * 1.15, (radius * 2 + altitude) * globe), ceiling: env.ceiling };
}
export function chaseCameraPosition(previous, target, delta) {
  if (!validPosition(target)) throw new TypeError('Camera target required');
  if (!validPosition(previous) || Math.hypot(target.x-previous.x,target.y-previous.y,target.z-previous.z)>60) return {...target};
  const blend=1-Math.exp(-25*clamp(finite(delta,1/60),0,.1));
  const eased={x:mix(previous.x,target.x,blend),y:mix(previous.y,target.y,blend),z:mix(previous.z,target.z,blend)};
  const lag=Math.hypot(target.x-eased.x,target.y-eased.y,target.z-eased.z);
  if(lag<=1.5)return eased;
  return {x:target.x+(eased.x-target.x)*1.5/lag,y:target.y+(eased.y-target.y)*1.5/lag,z:target.z+(eased.z-target.z)*1.5/lag};
}
export const flightAvatarVisible = cameraMode => cameraMode !== 'first' && cameraMode !== 'vehicle-first';
export function clearFlightInput(state) { state.liftHeld = false; state.speed = 0; state.verticalSpeed = 0;state.eastSpeed=0;state.northSpeed=0;state.turnBank=0;state.boosting=false; }
// Call once from the owning simulation tick, including ground and vehicle ticks.
// Paused menus do not tick, so cooldown cannot be advanced by wall-clock time.
export function advanceFlightAbilityTime(state, delta) {
  const dt = clamp(finite(delta), 0, FLIGHT_RULES.maxStep);
  state.abilityTime = Math.max(0, finite(state.abilityTime)) + dt;
  return state.abilityTime;
}
// world.advance uses local east/north/up metres, world.sweep verifies the entire motion
// against the same loaded terrain and solids used for rendering. Missing data stops motion.
export function stepFlight(state, controls, delta, unlocked, world, { realm = 4, clockAdvanced = false } = {}) {
  validateWorld(world);
  const dt = clamp(finite(delta), 0, FLIGHT_RULES.maxStep);
  const result = (reason, handled = state.active) => ({ handled, reason, position: { ...state.position } });
  if (!dt) return result('paused');
  state.boosting = false;
  if (!clockAdvanced) advanceFlightAbilityTime(state, dt);
  const sample = world.sample(state.position);
  if (!validSample(sample)) { clearFlightInput(state); return result('terrain-pending'); }
  const held = controls?.lift === true, pressed = held && !state.liftHeld;
  state.liftHeld = held;
  if (!state.active) {
    if (!unlocked || !pressed || sample.grounded !== true || sample.waterDepth > .15 || state.energy < FLIGHT_RULES.launchEnergy) {
      if (sample.grounded === true && sample.atService === true) state.energy = Math.min(100, state.energy + dt * FLIGHT_RULES.recovery);
      return result('ground', false);
    }
    state.active = true;
  }
  const east = clamp(finite(controls?.east), -1, 1), north = clamp(finite(controls?.north), -1, 1);
  const boosted = unlocked && controls?.boost === true && state.energy >= FLIGHT_RULES.boostMinEnergy && Math.hypot(east, north) > 0;
  const env = flightEnvelope(sample, world.radius, { realm, boost: boosted });
  // Human-scale aerial footwork, selected by combat proximity or held slow-walk.
  if(controls?.precision===true&&!boosted){env.speed=Math.min(env.speed,5);env.acceleration=30;}
  const powered = unlocked && state.energy > 0;
  const norm = Math.max(1, Math.hypot(east, north));
   const targetSpeed = powered && Math.hypot(east, north) > 0 ? env.speed : 0;
   const currentEast=finite(state.eastSpeed,0),currentNorth=finite(state.northSpeed,0);
   const currentSpeed=Math.hypot(currentEast,currentNorth);
   const wantsDirection=targetSpeed>0;
   const desiredHeading=wantsDirection?Math.atan2(north,east):0;
   const currentHeading=currentSpeed>1e-6?Math.atan2(currentNorth,currentEast):desiredHeading;
   const angle=wantsDirection?Math.atan2(Math.sin(desiredHeading-currentHeading),Math.cos(desiredHeading-currentHeading)):0;
   const turnRate=Math.min(FLIGHT_RULES.maxTurnRate,FLIGHT_RULES.steeringAcceleration/Math.max(currentSpeed,1));
   const heading=currentHeading+clamp(angle,-turnRate*dt,turnRate*dt);
   const speedRate=targetSpeed<currentSpeed?FLIGHT_RULES.braking:env.acceleration;
   const speed=Math.max(0,currentSpeed+clamp(targetSpeed-currentSpeed,-speedRate*dt,speedRate*dt));
    // Held lateral input needs a sustained visual bank even after velocity
    // aligns with the requested course. Heading error alone decays to zero.
    const lateralBank=boosted?clamp(finite(controls?.bank),-1,1)*.65:0;
    const bankTarget=wantsDirection?clamp(lateralBank-Math.sin(angle)*.35,-1,1):0;
    state.turnBank=mix(finite(state.turnBank),bankTarget,1-Math.exp(-5*dt));
   state.eastSpeed=speed*Math.cos(heading);state.northSpeed=speed*Math.sin(heading);state.speed=speed;
  // A newly loaded flight has no held thrust and descends without a teleport.
   const aboveCeiling=sample.agl>FLIGHT_RULES.maxAgl+.01;
   const descending=controls?.descend===true||!powered||aboveCeiling;
   const targetVertical = descending ? -env.descent : held ? Math.min(env.climb,Math.sqrt(2*FLIGHT_RULES.verticalBraking*Math.max(0,FLIGHT_RULES.maxAgl-sample.agl))) : 0;
   const verticalRate=descending&&state.verticalSpeed<targetVertical?FLIGHT_RULES.verticalBraking:descending||targetVertical>0?env.verticalAcceleration:FLIGHT_RULES.verticalBraking;
  state.verticalSpeed += clamp(targetVertical - state.verticalSpeed, -verticalRate * dt, verticalRate * dt);
   const up = Math.min(state.verticalSpeed * dt, Math.max(0, env.ceiling - sample.agl));
   if(sample.agl>=env.ceiling-.001&&state.verticalSpeed>0)state.verticalSpeed=0;
   let candidate = world.advance(state.position, { east: aboveCeiling?0:state.eastSpeed*dt, north: aboveCeiling?0:state.northSpeed*dt, up });
  if (!validPosition(candidate)) { clearFlightInput(state); return result('invalid-frame'); }
   let next = world.sample(candidate);
   if (!validSample(next)) { clearFlightInput(state); return result('terrain-pending'); }
   // At the AGL ceiling, follow a gently falling surface down instead of
   // discarding horizontal input. A steep drop still blocks until descent.
   if(!aboveCeiling&&next.agl>env.ceiling+.00001){
     const drop=next.agl-env.ceiling+.000001;
     if(drop<=Math.max(0,env.descent*dt+up)+.01){
       const adjusted=world.advance(state.position,{east:state.eastSpeed*dt,north:state.northSpeed*dt,up:up-drop});
       const adjustedSample=validPosition(adjusted)?world.sample(adjusted):null;
       if(validSample(adjustedSample)&&adjustedSample.agl<=env.ceiling+.00001){candidate=adjusted;next=adjustedSample;}
     }
     if(next.agl>env.ceiling+.00001){candidate=world.advance(state.position,{east:0,north:0,up:Math.min(0,up)});next=world.sample(candidate);state.speed=0;state.eastSpeed=0;state.northSpeed=0;if(!validSample(next)){clearFlightInput(state);return result('terrain-pending');}}
   }
  const sweep = world.sweep(state.position, candidate, FLIGHT_RULES.clearance);
  if (sweep?.ready !== true || sweep.clear !== true) {
    clearFlightInput(state);
    return result(sweep?.ready === true ? 'collision' : 'terrain-pending');
  }
  // A grounded endpoint must be supplied by the adapter (including its landing snap),
  // never infer a safe landing through mountains or water from height alone.
   if (next.agl < -.01 || next.agl>Math.max(env.ceiling,sample.agl)+.01 || next.waterDepth > .15 && next.agl <= .15) {
    clearFlightInput(state); return result('unsafe-surface');
  }
  state.position = { ...candidate };
  state.boosting = boosted && !aboveCeiling && state.speed > 1e-6;
  if (powered) state.energy = Math.max(0, state.energy - (FLIGHT_RULES.drain + (state.boosting ? FLIGHT_RULES.boostDrain : 0)) * dt);
   if ((!held||descending) && next.grounded === true && next.agl <= .15 && state.verticalSpeed <= 0) {
    state.active = false; clearFlightInput(state);state.liftHeld=held;
    return result('landed', true);
  }
  return result(powered ? 'flight' : 'controlled-descent', true);
}

// Aerial melee can apply a short canonical tangent-space displacement per tick.
// The entire segment must be loaded and collision-clear before any state changes.
export function applyFlightKnockback(state, displacement, world) {
  validateWorld(world);
  const reject = reason => ({ ok: false, reason });
  if (!state?.active || !validPosition(state.position)) return reject('flight-required');
  const east = displacement?.east, north = displacement?.north, up = displacement?.up ?? 0;
  const distance = Math.hypot(east, north, up);
  if (![east, north, up].every(Number.isFinite) || !Number.isFinite(distance) || distance <= 0 || distance > FLIGHT_RULES.knockbackMaxStep)
    return reject('invalid-displacement');
  const start = world.sample(state.position);
  if (!validSample(start)) return reject('terrain-pending');
  const nextPosition = world.advance(state.position, { east, north, up });
  if (!validPosition(nextPosition)) return reject('invalid-frame');
  const next = world.sample(nextPosition);
  if (!validSample(next)) return reject('terrain-pending');
  if (next.agl < -.01 || next.agl > FLIGHT_RULES.maxAgl + .01 || next.waterDepth > .15 && next.agl <= .15)
    return reject('unsafe-surface');
  const sweep = world.sweep(state.position, nextPosition, FLIGHT_RULES.clearance);
  if (sweep?.ready !== true) return reject('terrain-pending');
  if (sweep.clear !== true) return reject('blocked');
  state.position = { ...nextPosition };
  if (next.grounded === true && next.agl <= .15) { state.active = false; clearFlightInput(state); }
  return { ok: true, reason: 'moved', position: { ...state.position }, landed: state.active !== true };
}

const samePosition = (a, b) => validPosition(a) && validPosition(b) &&
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-5;
const failedBlink = reason => ({ ok: false, reason });
const abilityNow = state => Math.max(0, finite(state?.abilityTime));

// Preview is pure. It checks every loaded segment against rendered terrain and
// scene solids; a missing chunk is a hard refusal, not a request to invent a floor.
export function previewAscensionStep(state, request, world, { realm } = {}) {
  validateWorld(world);
  if (!validPosition(state?.position)) return failedBlink('invalid-position');
  const mode = request?.mode;
  const rule = blinkRules(realm, mode);
  if (!rule) return failedBlink('realm-locked');
  const distance = request?.distance ?? rule.distance;
  if (!Number.isFinite(distance) || distance <= 0 || distance > rule.distance) return failedBlink('distance-limit');
  const east = request?.east, north = request?.north, up = request?.up ?? 0;
  const magnitude = Math.hypot(east, north, up);
  if (![east, north, up].every(Number.isFinite) || !Number.isFinite(magnitude) || magnitude < 1e-6) return failedBlink('invalid-direction');
  if (!Number.isFinite(state.energy) || state.energy < rule.energy) return failedBlink('insufficient-energy');
  if (abilityNow(state) + 1e-9 < Math.max(0, finite(state.blinkCooldownUntil))) return failedBlink('cooldown');
  const originSample = world.sample(state.position);
  if (!validSample(originSample)) return failedBlink('terrain-pending');
  if (originSample.agl < -.01 || originSample.agl > FLIGHT_RULES.maxAgl + .01) return failedBlink('unsafe-surface');
  let position = { ...state.position }, destination = originSample;
  const steps = Math.ceil(distance / BLINK_RULES.segment);
  const stride = distance / steps;
  for (let i = 0; i < steps; i++) {
    const next = world.advance(position, { east: east / magnitude * stride, north: north / magnitude * stride, up: up / magnitude * stride });
    if (!validPosition(next)) return failedBlink('invalid-frame');
    destination = world.sample(next);
    if (!validSample(destination)) return failedBlink('terrain-pending');
    if (destination.agl < -.01 || destination.agl > FLIGHT_RULES.maxAgl + .01 ||
        destination.waterDepth > .15 && destination.agl <= .15) return failedBlink('unsafe-surface');
    const sweep = world.sweep(position, next, FLIGHT_RULES.clearance);
    if (sweep?.ready !== true) return failedBlink('terrain-pending');
    if (sweep.clear !== true) return failedBlink('blocked');
    position = { ...next };
  }
  const safeRequest = { mode, distance, east: east / magnitude, north: north / magnitude, up: up / magnitude };
  const ticket = { realm, request: safeRequest, origin: { ...state.position }, target: { ...position },
    serial: Number.isSafeInteger(state.blinkSerial) && state.blinkSerial >= 0 ? state.blinkSerial : 0 };
  return { ok: true, reason: 'ready', target: { ...position }, energyCost: rule.energy,
    cooldown: rule.cooldown, destination: { agl: destination.agl, grounded: destination.grounded === true }, ticket };
}

// Confirm re-runs the path against current streaming/colliders and commits once.
// Nothing in state changes on rejection, including energy and cooldown.
export function commitAscensionStep(state, ticket, world, { realm } = {}) {
  validateWorld(world);
  const serial = Number.isSafeInteger(state?.blinkSerial) && state.blinkSerial >= 0 ? state.blinkSerial : 0;
  if (ticket?.realm !== realm || ticket?.serial !== serial || !samePosition(ticket?.origin, state?.position)) return failedBlink('stale-preview');
  const checked = previewAscensionStep(state, ticket.request, world, { realm });
  if (!checked.ok) return checked;
  if (!samePosition(ticket.target, checked.target)) return failedBlink('stale-preview');
  const rule = blinkRules(realm, ticket.request.mode);
  state.position = { ...checked.target };
  state.energy = Math.max(0, state.energy - rule.energy);
  state.blinkCooldownUntil = abilityNow(state) + rule.cooldown;
  state.blinkSerial = serial + 1;
  state.active = checked.destination.grounded !== true;
  state.speed = 0;
  state.eastSpeed = 0;
  state.northSpeed = 0;
  state.verticalSpeed = 0;
  state.turnBank = 0;
  state.boosting = false;
  return { ok: true, reason: 'committed', position: { ...state.position }, energy: state.energy,
    cooldownUntil: state.blinkCooldownUntil, serial: state.blinkSerial, active: state.active };
}
