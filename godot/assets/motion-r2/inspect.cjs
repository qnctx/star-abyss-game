const fs=require('fs');
for (const dir of ['motion-r2','vfx-r2']) {
 const p='godot/assets/'+dir;fs.mkdirSync(p+'/source',{recursive:true});fs.writeFileSync(p+'/source/.gdignore','');
 for(const f of fs.readdirSync(p)) if(/\.blend\d*$/.test(f)) fs.renameSync(p+'/'+f,p+'/source/'+f);
}
