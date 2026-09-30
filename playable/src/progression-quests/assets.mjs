// Mark ready only after delivery/inspection. Missing art must not cause network requests.
const yaw={N01:Math.atan2(9,4),N03:Math.atan2(12,-5),N04:Math.atan2(-12,-6),N05:Math.PI};
const hashes={N01:'ed00ca069c1dd777238c2e09eb3730edbd3312d1286fac90c36794c27de2ed82',N03:'12b22193f03d46ea3316d8f0f68da4398e369d78ae168e14808fecce86af13cb',N04:'72e9c72edda59b7ad5661385d077ddc036eb889c4d84453eb4c948feb220b7cf',N05:'d57748012c3b561aebb3df2a3c58bd641be61be0c9b4f96f84f1eb8ec516fe39'};
export const NPC_ASSETS=Object.freeze(Object.fromEntries(['N01','N03','N04','N05'].map(id=>[id,Object.freeze({status:'ready',url:`assets/progression-quests/${id}-original.glb`,sha256:hashes[id],height:1.78,yaw:yaw[id],source:'Lux3D original; local runtime skeletal binding'})])));
