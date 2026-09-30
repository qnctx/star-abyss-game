// The old expedition root owns only the original basin. Its last safe pose is
// retained independently from the authoritative planet position.
const finitePose = p => p && ['x','y','z','yaw','pitch'].every(k=>Number.isFinite(p[k]));
export function isLegacyPose(player, airborne=false) {
  return !airborne && finitePose(player) && Math.max(Math.abs(player.x),Math.abs(player.z))<=2990;
}
export function createPlanetParking(snapshot) {
  if(!finitePose(snapshot?.player)||!snapshot?.mobility)throw new TypeError('Valid legacy snapshot required');
  let parked={player:structuredClone(snapshot.player),mobility:structuredClone(snapshot.mobility)};
  return {
    observe(snapshot,legacyActive) {
      if(!legacyActive||!isLegacyPose(snapshot?.player))return false;
      parked={player:structuredClone(snapshot.player),mobility:structuredClone(snapshot.mobility)};
      return true;
    },
    snapshot(snapshot,legacyActive) {
      this.observe(snapshot,legacyActive);
      return legacyActive?snapshot:{...snapshot,player:structuredClone(parked.player),mobility:structuredClone(parked.mobility)};
    },
    pose(){return structuredClone(parked.player);},
    rescue(player,mobility){
      if(!isLegacyPose(player))throw new TypeError('Rescue must resolve to the preserved basin');
      parked={player:structuredClone(player),mobility:structuredClone(mobility)};
    }
  };
}
