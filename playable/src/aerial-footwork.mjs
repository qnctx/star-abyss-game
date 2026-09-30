export function aerialFootwork(controls,player,enemies=[]){
  if(controls.sprint||controls.boost)return controls;
  const near=enemies.some(e=>e.alive!==false&&Number.isFinite(e.y)&&Math.hypot(e.x-player.x,e.y-player.y,e.z-player.z)<8);
  return controls.walk||near?{...controls,precision:true}:controls;
}
