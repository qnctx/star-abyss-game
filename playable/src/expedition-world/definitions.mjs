const freeze = value => { if(value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const sites = [
 {id:'camp-fall',name:'营地东侧陨落带',x:80,z:100,radius:26,routeFrom:'beacon',kind:'iron'},
 {id:'west-seam',name:'断环外缘矿脉',x:-1068,z:682,radius:28,routeFrom:'survey-west',kind:'iron'},
 {id:'east-dew',name:'镜阵月露洼地',x:1168,z:682,radius:28,routeFrom:'survey-east',kind:'herb'},
 {id:'north-shard',name:'石柱南侧碎晶坡',x:1218,z:-1068,radius:28,routeFrom:'survey-north',kind:'iron'}
];
const resources=sites.flatMap(s=>[[0,0],[-9,6],[10,-7]].map(([dx,dz],i)=>({id:s.id+'-resource-'+i,siteId:s.id,anchorId:s.id,name:s.kind==='herb'?'月露苔':'铁陨矿簇',kind:s.kind,itemId:s.kind==='herb'?'moon-moss':'meteor-iron',x:s.x+dx,z:s.z+dz,count:3,capacity:3,radius:.65,interactionRadius:3})));
const enemies=sites.map(s=>({id:s.id+'-enemy',siteId:s.id,anchorId:s.id,home:{x:s.x+15,z:s.z-13},name:'后天掠兽',kind:'scavenger',realm:0,level:1,x:s.x+15,z:s.z-13,radius:.65,height:1.35,perceptionRadius:35,territoryRadius:65,moveSpeed:7.8}));
export const definitions=freeze({version:'ORIGINAL-WORLD-R1',safePoint:{x:0,z:190,radius:24},sites,resources,enemies});
