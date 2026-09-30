const r=require('./r2-candidate-performance-attempt2/report.json');const s=r.scenarios.find(x=>x.name==='high-flight-2000m').after;
console.log('top',Object.keys(s));for(const [k,v] of Object.entries(s))if(/terrain|chunk|planet|render|landing|ready/i.test(k))console.log(k,JSON.stringify(v).slice(0,1500));
