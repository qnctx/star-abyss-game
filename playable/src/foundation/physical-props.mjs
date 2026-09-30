// Providers are installed only after their actual rendered geometry is available.
const providers=new Set();
export function registerPhysicalProps(provider){providers.add(provider);return ()=>providers.delete(provider);}
export function physicalPropSupport(x,z,maxHeight=Infinity){let y=-Infinity;for(const p of providers)y=Math.max(y,p.support(x,z,maxHeight));return y;}
export function physicalPropBlocked(x,z,feet,radius=.42,height=1.85){for(const p of providers)if(p.blocked(x,z,feet,radius,height))return true;return false;}
