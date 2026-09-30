import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from './layout.mjs';
import { sampleFooting } from './footing.mjs';
import { tailoredGeometry, mineralPlateGeometry, bootGeometry } from './avatar-shapes.mjs';
import {HUMANOID_RIG,MOTION_VERSION} from './humanoid-rig.mjs';
import {restingPose} from './authored-motion.mjs';
import {createExplorerSurfaceMaps} from './avatar-materials.mjs';
import {attachCharacterAsset} from './character-asset.mjs';
import characterData from '../assets/characters/c2-explorer-data.mjs';
import {seatedVehiclePose} from './tactical-pose.mjs';
import {steeringAngle} from './vehicle-rig.mjs';
import {createYuanYingFlightAnimator} from './yuan-ying-flight-pose.mjs';
import {applySkillPose} from './combat-skills/pose.mjs';
import {applyPulsePose} from './combat-pose.mjs';
import {createAerialMeleeAnimator} from './aerial-melee-animation.mjs';

// C / 玄壳共生服: a human in a tailored expedition garment, not a ceramic robot.
export function innateFlightBasePose(gait,flight,time=0){
  if(!flight?.active&&gait?.pose)return gait.pose;
  const idle=restingPose('idle',time/4);
  return {position:idle.position,rotations:idle.rotations.map(q=>q.toArray())};
}
export function createAvatar(materials,options={}) {
  const root=new THREE.Group();root.name='explorer-avatar';
  root.userData.proportions={height:1.85,helmetHeight:.244,shoulderWidth:.50,hipHeight:.975};
  root.userData.design='C2 turnaround / ivory mineral V mantle, tailored grey-brown textile, amber S spine';
  root.userData.surfaceBudget={textures:4,size:512,animatedTextures:false};
  const {weave,stone,weaveHeight,stoneHeight,textures}=createExplorerSurfaceMaps();
  const mat=options=>{const value=new THREE.MeshStandardMaterial(options);materials.push(value);return value;};
  // The albedo lives in the map; multiplying it by another dark brown made the old suit black.
  const textile=mat({color:'#c9c3b8',map:weave,bumpMap:weaveHeight,bumpScale:.0024,roughness:.97,metalness:0,emissive:'#675f52',emissiveIntensity:.04});
  const flex=mat({color:'#b4aa97',map:weave,bumpMap:weaveHeight,bumpScale:.0012,roughness:.98,metalness:0,emissive:'#554838',emissiveIntensity:.06});
  const seams=mat({color:'#625848',roughness:.94,metalness:.03});
  const seals=mat({color:'#33352f',roughness:.82,metalness:.1});
  const shell=mat({color:'#fff7e7',map:stone,bumpMap:stoneHeight,bumpScale:.0017,roughness:.78,metalness:.02});
  const rim=mat({color:'#a69b81',roughness:.65,metalness:.36});
  const visor=mat({color:'#111917',roughness:.14,metalness:.73});
  const amber=mat({color:'#b3945f',roughness:.54,metalness:.35,emissive:'#ba722a',emissiveIntensity:.48});
  const ion=mat({color:'#a1eff1',roughness:.32,emissive:'#44c5d9',emissiveIntensity:2.1});
  const mesh=(geometry,material,parent,x=0,y=0,z=0)=>{const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);part.receiveShadow=true;parent.add(part);return part;};
  const line=(points,width,material,parent)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*5),width,5,false),material,parent);
  const tailor=(parent,profile,folds=.003,seed=0,material=textile)=>mesh(tailoredGeometry(profile,{folds,seed}),material,parent);
  const plate=(parent,outline,{thickness=.007,crown=.006,reverse=false}={})=>{
    // Keep shoulder caps inside the anatomical silhouette and curve their outer
    // lip around the shoulder instead of projecting a flat triangular wing.
    const fitted=outline.map(([x,y,z])=>Math.abs(x)>.20?[Math.sign(x)*(.20+(Math.abs(x)-.20)*.55),y-Math.max(0,Math.abs(x)-.20)*.24,z-.012]:[x,y,z]);
    const part=mesh(mineralPlateGeometry(fitted,thickness,crown),shell,parent);if(reverse)part.rotation.y=Math.PI;return part;
  };
  const animated=new Set();
  const pivot=(parent,x,y,z)=>{const group=new THREE.Bone();group.position.set(x,y,z);parent.add(group);animated.add(group);return group;};
  // Pelvis carries the legs; the rib cage counter-rotates independently above it.
  const pelvis=pivot(root,...HUMANOID_RIG[0][2]);pelvis.name='explorer-pelvis';
  const body=pivot(pelvis,0,.04,0);body.name='explorer-ribcage';
  tailor(body,[[-.135,.111,.095],[-.105,.154,.106],[-.065,.172,.115],[-.02,.174,.116],[.03,.156,.104],[.075,.147,.100],[.115,.146,.103],[.16,.150,.107],[.21,.163,.113],[.26,.176,.118],[.31,.184,.117],[.36,.19,.119],[.41,.199,.117],[.455,.202,.110],[.49,.182,.097],[.525,.139,.080],[.555,.094,.067]],.0038,4);
  for(const side of [-1,1]){
    line([[side*.125,-.10,.089],[side*.149,.035,.107],[side*.13,.18,.10],[side*.174,.34,.102],[side*.16,.49,.08]],.0024,seams,body);
    line([[side*.115,-.09,-.091],[side*.132,.07,-.104],[side*.159,.23,-.102],[side*.186,.40,-.075]],.0024,seams,body);
    for(let i=0;i<5;i++)line([[side*.055,.11+i*.057,-.106],[side*.112,.088+i*.06,-.113],[side*.152,.09+i*.058,-.087]],.002,seams,body);
  }
  line([[-.14,.055,.099],[-.035,-.012,.117],[.07,-.053,.111],[.147,-.089,.079]],.006,flex,body);
  line([[-.147,.065,-.085],[-.055,.01,-.111],[.073,-.051,-.105],[.141,-.087,-.077]],.006,flex,body);
  tailor(body,[[.532,.069,.061],[.56,.074,.066],[.596,.070,.060],[.621,.066,.058]],.0012,0,flex);
  line([[-.06,.593,-.038],[0,.58,-.068],[.06,.593,-.038]],.003,seams,body);
  // Hand-shaped thin plates reproduce C's three broken diagonals around an exposed S spine.
  plate(body,[[-.235,.485,.059],[-.148,.552,.089],[-.061,.529,.119],[-.046,.482,.136],[-.084,.421,.144],[-.099,.344,.148],[-.093,.245,.137],[-.12,.197,.12],[-.176,.304,.112],[-.212,.377,.09],[-.264,.418,.04]]);
  plate(body,[[.047,.545,.10],[.108,.55,.099],[.193,.524,.086],[.255,.482,.055],[.286,.42,.018],[.217,.432,.078],[.144,.456,.116],[.079,.485,.131],[.038,.52,.125]],{crown:.009});
  plate(body,[[.174,.318,.094],[.18,.231,.115],[.134,.166,.137],[.076,.115,.148],[.068,.064,.142],[.109,-.012,.12],[.142,-.081,.075],[.068,-.052,.116],[-.002,.003,.13],[-.025,.07,.147],[.008,.148,.15],[.078,.211,.142]],{crown:.009});
  // The reference's front is an open mineral V, not three small shoulder
  // badges. Broad collar panels follow the rib cage down to the solar plexus.
  plate(body,[[.046,.542,.111],[.095,.57,.085],[.179,.547,.051],[.251,.479,.021],[.252,.423,.038],[.196,.438,.085],[.155,.379,.12],[.095,.273,.139],[.058,.188,.137],[.043,.262,.141],[.075,.389,.132],[.075,.474,.117]],{reverse:true,crown:.007});
  plate(body,[[-.047,.542,.109],[-.098,.564,.082],[-.182,.531,.056],[-.253,.469,.019],[-.243,.411,.045],[-.195,.429,.082],[-.154,.375,.119],[-.094,.269,.139],[-.060,.221,.137],[-.047,.294,.140],[-.078,.406,.128],[-.078,.481,.111]],{reverse:true,crown:.007});
  // Recessed edging articulates the mineral/cloth interface at side angles.
  for(const side of [-1,1])line([[side*.242,.434,-.047],[side*.189,.442,-.092],[side*.145,.369,-.132],[side*.092,.267,-.151],[side*.060,.216,-.145]],.0025,rim,body);
  const spine=[[0,.614,.063],[-.004,.551,.113],[-.020,.474,.137],[-.029,.397,.145],[-.015,.32,.148],[.019,.247,.155],[.022,.188,.158],[-.010,.112,.157],[-.033,.037,.145],[-.025,-.022,.127]];
  line(spine,.016,seals,body);line(spine.map(([x,y,z])=>[x-.005,y,z+.016]),.0015,amber,body);line(spine.map(([x,y,z])=>[x+.007,y,z+.015]),.0012,rim,body);
  for(let i=0;i<8;i++){const p=spine[Math.min(spine.length-2,i+1)];line([[p[0]-.019,p[1],p[2]+.012],[p[0]+.018,p[1]-.004,p[2]+.012]],.0025,flex,body);}
  const head=pivot(body,0,.711,-.006);head.name='explorer-helmet';
  mesh(new THREE.SphereGeometry(1,28,22),shell,head).scale.set(.096,.120,.108);
  mesh(new THREE.SphereGeometry(1,20,14),seals,head,0,-.092,.045).scale.set(.055,.034,.035);
  const face=mesh(new THREE.SphereGeometry(1,28,20,Math.PI*.11,Math.PI*.78,Math.PI*.15,Math.PI*.67),visor,head,0,-.008,-.012);face.scale.set(.094,.107,.110);face.rotation.y=Math.PI;
  line([[-.075,.056,-.075],[-.054,.081,-.092],[0,.089,-.10],[.054,.081,-.092],[.075,.056,-.075]],.004,seals,head);
  line([[-.077,-.02,-.071],[-.066,-.075,-.088],[-.038,-.101,-.097],[0,-.108,-.102],[.038,-.101,-.097],[.066,-.075,-.088],[.077,-.02,-.071]],.005,rim,head);
  for(const side of [-1,1]){mesh(new THREE.CylinderGeometry(.017,.017,.006,12),seals,head,side*.095,-.033,.006).rotation.z=Math.PI/2;line([[side*.063,.085,.041],[side*.083,.038,.052],[side*.075,-.01,.072],[side*.046,-.07,.081]],.0015,seams,head);}
  line([[0,.017,.115],[-.004,-.035,.117],[0,-.097,.075]],.009,seals,head);line([[0,-.019,.123],[0,-.068,.102]],.0018,amber,head);
  const arms=[],legs=[],boots=[];
  for(const side of [-1,1]){
    const clavicle=pivot(body,side*.170,.478,0);clavicle.name=side<0?'left-clavicle':'right-clavicle';
    const shoulder=pivot(clavicle,side*.045,-.020,0);
    tailor(shoulder,[[-.30,.046,.050],[-.265,.052,.057],[-.22,.059,.061],[-.18,.060,.063],[-.13,.065,.064],[-.08,.067,.065],[-.035,.070,.065],[.011,.059,.056],[.034,.037,.035]],.003,side);
    for(const z of [-.044,.048])line([[side*.034,-.035,z],[side*.052,-.13,z],[side*.044,-.225,z],[side*.032,-.28,z]],.002,seams,shoulder);
    const elbow=pivot(shoulder,0,-.30,0);
    tailor(elbow,[[-.275,.037,.035],[-.245,.039,.038],[-.205,.045,.043],[-.165,.050,.049],[-.12,.052,.051],[-.075,.051,.052],[-.04,.048,.051],[.005,.047,.05],[.035,.043,.046]],.0035,side+3);
    for(let i=0;i<3;i++)line([[-.033,-.026-i*.019,-.037],[0,-.018-i*.019,-.052],[.034,-.030-i*.019,-.036]],.002,seams,elbow);
    plate(elbow,[[side*.030,-.023,.04],[side*.072,-.069,.017],[side*.070,-.147,.025],[side*.04,-.241,.032],[side*.012,-.225,.044],[side*.017,-.137,.059]],{crown:.003}).rotation.y=side*.45;
    line([[side*.027,-.022,-.035],[side*.04,-.10,-.040],[side*.026,-.225,-.030]],.0022,seams,elbow);
    tailor(elbow,[[-.283,.039,.037],[-.266,.039,.037]],.0002,0,flex);
    const wrist=pivot(elbow,0,-.277,0);
    tailor(wrist,[[-.075,.028,.018],[-.049,.034,.024],[-.018,.033,.026],[0,.029,.027]],.001,side,flex);
    // Relaxed gloved fingers curl into a loose grip; straight fingers under a
    // flexed elbow looked like carrying a tray while running.
    for(let finger=0;finger<4;finger++){
      const x=-.021+finger*.014,shorter=finger===3?.004:0;
      mesh(new THREE.CapsuleGeometry(.007,.018-shorter,3,6),flex,wrist,x,-.080+shorter,-.012).rotation.x=.55;
      mesh(new THREE.CapsuleGeometry(.0065,.013-shorter,3,6),flex,wrist,x,-.093+shorter,-.024).rotation.x=1.30;
    }
    const thumb=mesh(new THREE.CapsuleGeometry(.009,.021,3,6),flex,wrist,side*-.031,-.047,-.020);thumb.rotation.set(.48,0,side*.45);
    arms.push({clavicle,shoulder,elbow,wrist,side});
    const hip=pivot(pelvis,side*.087,0,0);hip.name=side<0?'left-hip':'right-hip';
    tailor(hip,[[-.454,.056,.059],[-.41,.062,.065],[-.365,.067,.071],[-.32,.071,.072],[-.275,.079,.077],[-.23,.082,.082],[-.18,.086,.087],[-.12,.089,.092],[-.06,.088,.095],[-.015,.083,.087],[.038,.061,.058]],.0044,side+6);
    line([[side*.076,-.038,.05],[side*.084,-.16,.044],[side*.067,-.29,.044],[side*.047,-.424,.043]],.0023,seams,hip);
    line([[side*.039,-.055,-.078],[side*.058,-.20,-.062],[side*.05,-.324,-.053],[side*.036,-.412,-.045]],.0021,seams,hip);
    line([[side*.053,-.09,.078],[side*.068,-.17,.064],[side*.063,-.254,.06]],.005,flex,hip);
    const knee=pivot(hip,...HUMANOID_RIG[14][2]);knee.name=side<0?'left-knee':'right-knee';
    tailor(knee,[[-.424,.041,.042],[-.38,.045,.047],[-.33,.046,.05],[-.285,.051,.056],[-.24,.057,.065],[-.19,.061,.069],[-.14,.059,.069],[-.09,.055,.062],[-.045,.054,.059],[.005,.054,.062],[.035,.054,.058]],.0043,side+2);
    for(let i=0;i<4;i++)line([[-.036,-.021-i*.025,-.043],[0,-.012-i*.026,-.065],[.037,-.025-i*.025,-.040]],.002,seams,knee);
    // C's shin guards sit on the front/outer side. The calf at the back stays textile.
    const shinGuard=plate(knee,[[-.023,-.064,.062],[.021,-.095,.074],[.045,-.180,.064],[.035,-.296,.06],[.012,-.393,.052],[-.016,-.361,.051],[-.032,-.236,.067],[-.04,-.145,.06]],{crown:.004});
    shinGuard.rotation.y=Math.PI+side*-.50;shinGuard.position.z=-.016;
    line([[side*.038,-.072,.046],[side*.045,-.19,.058],[side*.033,-.30,.044],[side*.027,-.40,.035]],.0023,seams,knee);
    // The ankle is an articulated owner, so batching cannot weld the boot to the calf.
    const ankle=pivot(knee,...HUMANOID_RIG[15][2]);ankle.name=side<0?'left-ankle':'right-ankle';
    const boot=new THREE.Group();boot.position.set(0,-.107,0);ankle.add(boot);
    mesh(bootGeometry(),flex,boot);mesh(bootGeometry(true),seals,boot);tailor(boot,[[.12,.046,.044,0,.003],[.153,.042,.043,0,.006],[.183,.04,.043,0,.009]],.0014,3,flex);
    for(const z of [-.060,-.085,-.111])line([[-.046,.099,z],[0,.11,z-.004],[.046,.099,z]],.002,seams,boot);
    line([[-.058,.054,.043],[-.066,.052,-.061],[-.053,.05,-.158],[0,.050,-.181],[.053,.05,-.158],[.066,.052,-.061],[.058,.054,.043]],.0023,rim,boot);
    const footContact=new THREE.Object3D();footContact.position.set(0,.012,-.05);boot.add(footContact);boots.push(footContact);legs.push({hip,knee,ankle,side,contact:footContact,target:new THREE.Vector3(),anchor:new THREE.Vector3(),stance:true,phase:0});
  }
  const jets=new THREE.Group();body.add(jets);
  const jetMaterial=new THREE.MeshBasicMaterial({color:'#75e5ed',transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending});materials.push(jetMaterial);
  for(const side of [-1,1]){
    mesh(new THREE.CylinderGeometry(.020,.030,.073,10),seals,body,side*.125,.022,.117).rotation.z=side*-.16;
    mesh(new THREE.TorusGeometry(.024,.004,4,12),rim,body,side*.13,-.014,.117).rotation.x=Math.PI/2;
    mesh(new THREE.CircleGeometry(.018,10),ion,body,side*.13,-.019,.117).rotation.x=Math.PI/2;
    mesh(new THREE.ConeGeometry(.041,.40,10,1,true),jetMaterial,jets,side*.13,-.22,.117).rotation.z=Math.PI;
    mesh(new THREE.ConeGeometry(.016,.23,8,1,true),ion,jets,side*.13,-.133,.117).rotation.z=Math.PI;
  }
  const lumbarBone=pivot(body,0,.16,0),chestBone=pivot(lumbarBone,0,.20,0);
  lumbarBone.name='explorer-lumbar';chestBone.name='explorer-chest';
  root.updateMatrixWorld(true);
  chestBone.attach(head);for(const arm of arms)chestBone.attach(arm.clavicle);
  const bones=[pelvis,body,lumbarBone,chestBone,head,...arms.flatMap(a=>[a.clavicle,a.shoulder,a.elbow,a.wrist]),...legs.flatMap(l=>[l.hip,l.knee,l.ankle])];
  const skeleton=new THREE.Skeleton(bones),batches=new Map();
  const bindPositions=bones.map(b=>b.position.clone());
  root.updateMatrixWorld(true);
  // One full humanoid skin. Cloth shares weights across elbow, knee and spine
  // seams; hard mineral plates keep rigid ownership. No separate cylinder limbs.
  for(const owner of animated){
    const ownerIndex=bones.indexOf(owner),parentIndex=bones.indexOf(owner.parent);
    const collect=node=>{for(const child of [...node.children]){
      if(animated.has(child)||child===jets)continue;
      if(child.isMesh){
        const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrixWorld);
        const positions=geometry.attributes.position,indices=[],weights=[],local=new THREE.Vector3();
        for(let i=0;i<positions.count;i++){
          local.fromBufferAttribute(positions,i);owner.worldToLocal(local);
          let a=ownerIndex,b=a,w=0;
          if(owner===body){
            if(local.y<.16){a=1;b=2;w=THREE.MathUtils.smoothstep(local.y,.015,.20);}
            else{a=2;b=3;w=THREE.MathUtils.smoothstep(local.y,.20,.43);}
          }else if(child.material!==shell&&parentIndex>=0&&/elbow|wrist|knee|ankle/.test(HUMANOID_RIG[ownerIndex][0])){
            b=parentIndex;w=.5*THREE.MathUtils.smoothstep(local.y,-.065,.035);
          }else if(child.material!==shell&&/shoulder|hip/.test(HUMANOID_RIG[ownerIndex][0])){
            b=ownerIndex+1;const length=/hip/.test(HUMANOID_RIG[ownerIndex][0])?.445:.30;
            w=.5*(1-THREE.MathUtils.smoothstep(local.y,-length-.025,-length+.07));
          }
          indices.push(a,b,0,0);weights.push(1-w,w,0,0);
        }
        geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
        if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(geometry);node.remove(child);child.geometry.dispose();
      }
      else{collect(child);if(child.isGroup&&!child.children.length)node.remove(child);}
    }};collect(owner);
  }
  for(const[material,geometries]of batches){
    const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    // Weld only identical full vertex records, including normals, UVs and skin
    // weights. Keep seams and rigid armour boundaries; reuse GPU skinning work.
    const geometry=mergeVertices(merged,.00001);merged.dispose();
    const skinned=new THREE.SkinnedMesh(geometry,material);skinned.name='explorer-full-body-skin';skinned.receiveShadow=true;skinned.frustumCulled=false;root.add(skinned);skinned.bind(skeleton);
  }
  const contactGeometry=new THREE.PlaneGeometry(2.4,2.2,8,8);contactGeometry.rotateX(-Math.PI/2);
  const contactMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    uniforms:{footA:{value:new THREE.Vector3()},footB:{value:new THREE.Vector3()},strength:{value:1}},
    vertexShader:'varying vec2 groundPoint;void main(){groundPoint=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 groundPoint;uniform vec3 footA;uniform vec3 footB;uniform float strength;float footprint(vec3 foot){vec2 d=(groundPoint-foot.xy)*vec2(7.,4.7);return exp(-dot(d,d)*1.8)*foot.z;}void main(){vec2 p=(groundPoint-vec2(.05))*vec2(1.65,1.8);float a=(exp(-dot(p,p)*3.)*.22+max(footprint(footA),footprint(footB))*.44)*strength;gl_FragColor=vec4(.009,.012,.018,a);}'});
  materials.push(contactMaterial);const contact=mesh(contactGeometry,contactMaterial,root);contact.name='explorer-contact-shadow';contact.renderOrder=1;
  const bootPosition=new THREE.Vector3();let pose={phase:0,weight:0,runBlend:0,feet:[]};
  function correctLeg(leg,foot){
    leg.contact.position.z=foot.contactZ;leg.stance=!!foot.stance;leg.phase=foot.phase;
    root.updateMatrixWorld(true);
    const h=leg.hip.getWorldPosition(new THREE.Vector3()),k=leg.knee.getWorldPosition(new THREE.Vector3()),a=leg.ankle.getWorldPosition(new THREE.Vector3());
    const actual=leg.contact.getWorldPosition(new THREE.Vector3());
    leg.anchor.set(foot.x,foot.y,foot.z);
    leg.target.set(foot.raw.x+foot.correction.x,foot.raw.y+foot.correction.y,foot.raw.z+foot.correction.z);
    const correction=leg.target.clone().sub(actual);
    const target=a.clone().add(correction),direction=target.clone().sub(h),rawDistance=direction.length(),distance=THREE.MathUtils.clamp(rawDistance,.05,.888);
    direction.normalize();
    // Keep the knee plane from the animation. IK is only a small sole correction.
    const pole=k.clone().sub(h);pole.addScaledVector(direction,-pole.dot(direction));
    if(pole.lengthSq()<1e-7)pole.set(0,0,-1).applyQuaternion(leg.hip.getWorldQuaternion(new THREE.Quaternion()));
    pole.normalize();
    const bend=Math.sqrt(Math.max(0,.445**2-(distance*.5)**2));
    const newK=h.clone().addScaledVector(direction,distance*.5).addScaledVector(pole,bend),newA=h.clone().addScaledVector(direction,distance);
    const hipQ=leg.hip.getWorldQuaternion(new THREE.Quaternion()),kneeQ=leg.knee.getWorldQuaternion(new THREE.Quaternion()),ankleQ=leg.ankle.getWorldQuaternion(new THREE.Quaternion());
    hipQ.premultiply(new THREE.Quaternion().setFromUnitVectors(k.clone().sub(h).normalize(),newK.clone().sub(h).normalize()));
    kneeQ.premultiply(new THREE.Quaternion().setFromUnitVectors(a.clone().sub(k).normalize(),newA.clone().sub(newK).normalize()));
    const parentQ=leg.hip.parent.getWorldQuaternion(new THREE.Quaternion());
    leg.hip.quaternion.copy(parentQ.invert().multiply(hipQ));
    leg.knee.quaternion.copy(hipQ.clone().invert().multiply(kneeQ));
    leg.ankle.quaternion.copy(kneeQ.invert().multiply(ankleQ));
    leg.reachError=Math.max(0,rawDistance-distance);
  }
  function poseSnapshot(){
    root.updateMatrixWorld(true);
    const worldYaw=part=>new THREE.Euler().setFromQuaternion(part.getWorldQuaternion(new THREE.Quaternion()),'YXZ').y;
    return{...pose,characterAsset:{...root.userData.characterAsset},position:root.position.toArray(),pelvis:{position:pelvis.position.toArray(),rotation:pelvis.rotation.toArray().slice(0,3)},
      chest:chestBone.rotation.toArray().slice(0,3),pelvisWorldYaw:worldYaw(pelvis),chestWorldYaw:worldYaw(chestBone),
      torso:{lumbar:lumbarBone.rotation.toArray().slice(0,3),chest:chestBone.rotation.toArray().slice(0,3)},
      arms:arms.map(({side,clavicle,shoulder,elbow,wrist})=>({side,clavicle:clavicle.rotation.toArray().slice(0,3),shoulder:shoulder.rotation.toArray().slice(0,3),elbow:elbow.rotation.x,wrist:wrist.rotation.toArray().slice(0,3),
        joints:{shoulder:shoulder.getWorldPosition(new THREE.Vector3()).toArray(),elbow:elbow.getWorldPosition(new THREE.Vector3()).toArray(),wrist:wrist.getWorldPosition(new THREE.Vector3()).toArray()}})),
      feet:legs.map(leg=>{
        const actual=leg.contact.getWorldPosition(new THREE.Vector3()),worldPosition=part=>part.getWorldPosition(new THREE.Vector3()).toArray();
        return{side:leg.side,stance:leg.stance,phase:leg.phase,anchor:leg.anchor.toArray(),target:leg.target.toArray(),actual:actual.toArray(),
          soleCenter:leg.contact.parent.localToWorld(new THREE.Vector3(0,.012,-.05)).toArray(),
          joints:{hip:worldPosition(leg.hip),knee:worldPosition(leg.knee),ankle:worldPosition(leg.ankle)},
          error:actual.distanceTo(leg.target),reachError:leg.reachError||0,hip:leg.hip.rotation.toArray().slice(0,3),knee:leg.knee.rotation.toArray().slice(0,3),ankle:leg.ankle.rotation.toArray().slice(0,3)};
      })};
  }
  const assetUrl=options.assetUrl??(typeof document!=='undefined'?'embedded:c2-explorer.glb':null);
  const authored=assetUrl?attachCharacterAsset({root,skeleton,materials,url:assetUrl,data:options.assetUrl?null:characterData}):null;
  const palmPoint=new THREE.Vector3();
  const flightAnimator=createYuanYingFlightAnimator();
  const meleeAnimator=createAerialMeleeAnimator();
  return{root,poseSnapshot,palmPosition(){const hand=root.getObjectByName('c2-native-wristR')||bones[12];return hand.localToWorld(palmPoint.set(0,-.12,-.035));},eyePosition:()=>authored?.eyePosition(),assetReady:authored?.ready??Promise.resolve({status:'not-requested'}),dispose(){authored?.dispose();textures.forEach(texture=>texture.dispose());skeleton.dispose();},update(player,view,ground,dt){
    const mounted=!!view.mobility?.vehicle?.mounted,airborne=!!view.innateFlight?.active||!!view.mobility?.flight?.airborne||!!view.mobility?.jump?.airborne,feet=Number.isFinite(player.y)?player.y:ground;
    const prone=!view.innateFlight?.active&&(player.posture==='prone'||view.gait?.proneBlend>.02);
    const gait=view.gait,weight=gait?.weight||0,run=gait?.runBlend||0,phase=gait?.phase||0,facing=mounted?(view.mobility.vehicle.yaw||0):gait?.facing??player.heading??player.yaw??0;
    root.position.set(player.x,feet+(mounted?.14:0),player.z);root.rotation.y=facing;
    const seated=mounted?seatedVehiclePose(steeringAngle(view.drivingControls)):null;
    const groundPose=innateFlightBasePose(gait,view.innateFlight,view.time||0);
    const flightPose=flightAnimator.update(mounted?null:view.innateFlight,view.time,dt,groundPose);
    const locomotionPose=seated?{position:seated.position,rotations:seated.rotations.map(q=>q.toArray())}:flightPose||groundPose;
    const melee=view.combat?.aerialMelee,combatTime=view.combat?.time||0;
    const meleeActive=!mounted&&(melee?.guarding||melee?.end>combatTime||melee?.stunUntil>combatTime||melee?.reaction?.end>combatTime);
    const clipPose=meleeAnimator.update(locomotionPose,!mounted?melee:null,combatTime,dt);
    if(!airborne&&!mounted&&meleeActive){
      // Ground punches/guard keep their planted legs; the right-leg kick
      // retains one support leg instead of importing an airborne tuck.
      const kicking=['kick','uppercut'].includes(melee.move)&&melee.end>combatTime;
      for(let i=13;i<=18;i++)if(!kicking||i<16)clipPose.rotations[i]=[...groundPose.rotations[i]];
    }
    bones.forEach((bone,i)=>{bone.position.copy(bindPositions[i]);bone.quaternion.fromArray(clipPose.rotations[i]);});
    if(clipPose)pelvis.position.add(new THREE.Vector3(...clipPose.position));
    const combat=!meleeActive&&!mounted&&!airborne&&!prone&&!view.innateFlight?.active?(applySkillPose(bones,view.combat)||applyPulsePose(bones,view.combat)):null;
    if(combat)root.rotation.y=combat.yaw;
    // The camera can look over the shoulder; keep this additive look subtle.
    const lookYaw=THREE.MathUtils.clamp(Math.atan2(Math.sin((player.yaw||0)-facing),Math.cos((player.yaw||0)-facing)),-.55,.55);
    if(!mounted)head.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((player.pitch||0)*.25,lookYaw*.55,0,'YXZ')));
    root.updateMatrixWorld(true);
    let ikRootDrop=0;
    if(!mounted&&!airborne&&!prone)for(const leg of legs){
      const foot=gait?.feet?.find(f=>f.side===leg.side);if(!foot?.stance)continue;
      const hip=leg.hip.getWorldPosition(new THREE.Vector3()),ankle=leg.ankle.getWorldPosition(new THREE.Vector3());
      const ax=ankle.x+foot.correction.x,az=ankle.z+foot.correction.z,ay=ankle.y+foot.correction.y;
      const horizontal=(ax-hip.x)**2+(az-hip.z)**2;
      ikRootDrop=Math.max(ikRootDrop,hip.y-ay-Math.sqrt(Math.max(.02,.886**2-horizontal)));
    }
    ikRootDrop=THREE.MathUtils.clamp(ikRootDrop,0,.08);pelvis.position.y-=ikRootDrop;root.updateMatrixWorld(true);
    for(const leg of legs){
      const foot=gait?.feet?.find(f=>f.side===leg.side);
      if(foot&&!mounted&&!airborne&&!prone)correctLeg(leg,foot);
      else{leg.stance=false;leg.contact.getWorldPosition(leg.target);leg.reachError=0;}
    }
    authored?.update({mounted,prone:!mounted&&prone,proneBlend:mounted?0:view.gait?.proneBlend||0,firstPerson:view.cameraMode==='vehicle-first'||view.cameraMode==='first'&&(prone||!!combat||!!flightPose)});
    pose={version:MOTION_VERSION,source:'Quaternius UAL1 / full-body clips',bones:bones.length,phase,weight,runBlend:run,headingYaw:facing,ikRootDrop,
      style:{walk:gait?.walkBlend??1,jog:gait?.jogBlend??0,sprint:gait?.sprintBlend??0,direction:{...gait?.direction}},
      flight:flightAnimator.snapshot(),aerialMelee:meleeAnimator.snapshot(),transition:gait?.transition,mode:mounted?'seated':airborne?'flight':weight>.02?'locomotion':'idle'};
    amber.emissiveIntensity=.48+Math.min(2,view.evolution?.equipmentLevel||0)*.08;jets.visible=!!view.mobility?.flight?.thrusting&&!mounted&&!view.innateFlight?.active;jets.scale.y=.85+Math.sin((view.time||0)*37)*.12;
    contact.visible=!mounted&&!view.innateFlight?.active;contactMaterial.uniforms.strength.value=1/(1+Math.max(0,feet-ground)*.85);root.updateMatrixWorld(true);
    boots.forEach((boot,i)=>{boot.getWorldPosition(bootPosition);root.worldToLocal(bootPosition);contactMaterial.uniforms[i?'footB':'footA'].value.set(bootPosition.x,bootPosition.z,Math.max(0,1-Math.max(0,feet-ground+bootPosition.y-.08)*3));});
    const vertices=contactGeometry.attributes.position,cos=Math.cos(root.rotation.y),sin=Math.sin(root.rotation.y);
    if(root.visible&&!view.planetFrame){
      for(let i=0;i<vertices.count;i++){
        const x=vertices.getX(i),z=vertices.getZ(i),wx=player.x+x*cos+z*sin,wz=player.z-x*sin+z*cos;
        const support=sampleFooting(wx,wz,feet),height=support.height>feet+.35?terrainHeight(wx,wz):support.height;
        vertices.setY(i,height-root.position.y+.005);
      }
      vertices.needsUpdate=true;
    }
  }};
}
